/**
 * Provider: OpenAI Images API (gpt-image-2, gpt-image-1.5, dall-e-3, ...)
 * and text-to-speech via `/v1/audio/speech`. Ported near-verbatim from
 * Open Design's `apps/daemon/src/media/index.ts` `renderOpenAIImage`/
 * `renderOpenAISpeech` — see `source-map.md`.
 *
 * Supports both the canonical OpenAI endpoint AND Azure-hosted OpenAI
 * deployments behind the same provider slot — Azure is detected from the
 * base URL (`*.azure.com` host or a `/deployments/<name>` path segment).
 * For Azure this additionally:
 *   - appends `?api-version=...` (default 2024-02-01, unless the caller
 *     already encoded one into the base URL),
 *   - sends the `api-key` header in addition to `Authorization` (Azure
 *     accepts either; some deployments only honor `api-key`),
 *   - drops the `model` field from the body, since the deployment in the
 *     path already names the model.
 *
 * Dropped from the origin: the local Codex-CLI-subscription image
 * fallback (`codex-gpt-image-2` etc.) — an OD-specific local-CLI-login
 * integration already excluded from `providers.ts`'s catalogue, not a REST
 * credential shape any other Jini consumer could use.
 */
import { Agent as UndiciAgent } from 'undici';
import {
  buildOpenAIImageUrl,
  buildOpenAISpeechUrl,
  detectAzureEndpoint,
  openaiSizeFor,
  OPENAI_TTS_VOICES,
  truncate,
  withRequestInit,
} from '../openai-compatible.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

// Image generation can legitimately take minutes (gpt-image-2 4K renders
// especially). A generous default headers/body timeout dispatcher is
// applied so a caller-configured global fetch default doesn't cut a
// legitimately-slow-but-succeeding generation short; a caller can still
// override via `requestInit.dispatcher`.
const OPENAI_IMAGE_HEADERS_TIMEOUT_MS = 10 * 60 * 1000;
const OPENAI_IMAGE_BODY_TIMEOUT_MS = 10 * 60 * 1000;
const openAIImageDispatcher = new UndiciAgent({
  headersTimeout: OPENAI_IMAGE_HEADERS_TIMEOUT_MS,
  bodyTimeout: OPENAI_IMAGE_BODY_TIMEOUT_MS,
});

const OPENAI_IMAGE_NO_CREDENTIAL_MESSAGE =
  'no OpenAI credential — configure an API key or set OPENAI_API_KEY.';

export async function renderOpenAIImage(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(OPENAI_IMAGE_NO_CREDENTIAL_MESSAGE);
  }
  const rawBase = credentials.baseUrl || 'https://api.openai.com/v1';
  const azure = detectAzureEndpoint(rawBase);
  const url = buildOpenAIImageUrl(rawBase, azure);

  const body: Record<string, unknown> = {
    prompt: ctx.prompt || 'A high-quality reference image.',
    n: 1,
    size: openaiSizeFor(ctx.model, ctx.aspect),
  };
  // For non-Azure calls, include `model` in the body. Azure infers it from
  // the deployment in the path so omitting it keeps payloads compatible
  // across both flavors. The wire-name (post-alias) goes on the body so a
  // host's model-aliasing layer, if any, reaches the API.
  if (!azure) {
    body.model = ctx.wireModel;
  }
  // Capability branches key off the CATALOG id (not the wire alias) so a
  // host that aliased `dall-e-3` to a custom Azure/proxy deployment still
  // gets the DALL-E-specific quality + response_format flags.
  if (ctx.model.startsWith('dall-e-')) {
    body.response_format = 'b64_json';
    body.quality = ctx.model === 'dall-e-3' ? 'hd' : 'standard';
  } else {
    // gpt-image-* accepts quality 'high' | 'medium' | 'low'.
    body.quality = 'high';
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${credentials.apiKey}`,
    'content-type': 'application/json',
  };
  if (azure) {
    // Azure's canonical auth header. Some deployments accept Bearer too,
    // but api-key is what their docs document, so both are sent. OpenAI
    // ignores unknown headers, so this is harmless on the standard
    // endpoint too.
    headers['api-key'] = credentials.apiKey;
  }

  const resp = await fetch(
    url,
    withRequestInit(ctx, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      dispatcher: ctx.requestInit.dispatcher ?? (openAIImageDispatcher as unknown as NonNullable<RequestInit['dispatcher']>),
      signal: AbortSignal.timeout(Math.max(OPENAI_IMAGE_HEADERS_TIMEOUT_MS, OPENAI_IMAGE_BODY_TIMEOUT_MS)),
    }),
  );
  const text = await resp.text();
  if (!resp.ok) {
    const tag = azure ? 'azure-openai' : 'openai';
    throw new Error(`${tag} ${resp.status}: ${truncate(text, 240)}`);
  }
  let data: { data?: Array<{ b64_json?: string; url?: string }> };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`openai non-JSON response: ${truncate(text, 200)}`);
  }
  const entry = Array.isArray(data.data) ? data.data[0] : null;
  if (!entry) throw new Error('openai response had no data[0]');
  let bytes: Buffer;
  if (entry.b64_json) {
    bytes = Buffer.from(entry.b64_json, 'base64');
  } else if (entry.url) {
    const imgResp = await fetch(entry.url, withRequestInit(ctx));
    if (!imgResp.ok) throw new Error(`openai image fetch ${imgResp.status}`);
    const arr = await imgResp.arrayBuffer();
    bytes = Buffer.from(arr);
  } else {
    throw new Error('openai response had neither b64_json nor url');
  }

  const tag = azure ? 'azure-openai' : 'openai';
  return {
    bytes,
    providerNote: `${tag}/${ctx.wireModel} · ${ctx.aspect} · ${bytes.length} bytes`,
    suggestedExt: '.png',
  };
}

export async function renderOpenAISpeech(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error('no OpenAI credential — configure an API key or set OPENAI_API_KEY');
  }
  const rawBase = credentials.baseUrl || 'https://api.openai.com/v1';
  const azure = detectAzureEndpoint(rawBase);
  const url = buildOpenAISpeechUrl(rawBase, azure);
  const format = ctx.speechFormat;
  const text = (ctx.prompt && ctx.prompt.trim()) || 'This is a test.';

  let voiceId = 'alloy';
  let instructions = '';
  const requestedVoice = (ctx.voice && ctx.voice.trim()) || '';
  if (requestedVoice) {
    if (OPENAI_TTS_VOICES.has(requestedVoice)) {
      voiceId = requestedVoice;
    } else {
      // gpt-4o-mini-tts accepts free-form speaking-style instructions. If
      // the caller passed prose rather than a concrete voice id, preserve
      // it here instead of surfacing a provider error.
      instructions = requestedVoice;
    }
  }

  const body: Record<string, unknown> = {
    input: text,
    voice: voiceId,
    response_format: format,
  };
  if (!azure) {
    body.model = ctx.wireModel;
  }
  if (instructions && ctx.model === 'gpt-4o-mini-tts') {
    body.instructions = instructions;
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${credentials.apiKey}`,
    'content-type': 'application/json',
  };
  if (azure) {
    headers['api-key'] = credentials.apiKey;
  }

  const resp = await fetch(
    url,
    withRequestInit(ctx, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
  if (!resp.ok) {
    const errorText = await resp.text();
    const tag = azure ? 'azure-openai' : 'openai';
    throw new Error(`${tag} speech ${resp.status}: ${truncate(errorText, 240)}`);
  }
  const arr = await resp.arrayBuffer();
  const bytes = Buffer.from(arr);
  if (bytes.length === 0) {
    throw new Error('openai speech returned zero bytes');
  }
  const tag = azure ? 'azure-openai' : 'openai';
  const noteBits = [`${tag}/${ctx.wireModel}`, voiceId, format, `${bytes.length} bytes`];
  if (instructions) noteBits.splice(2, 0, 'styled');
  return {
    bytes,
    providerNote: noteBits.join(' · '),
    suggestedExt: format === 'opus' ? '.ogg' : `.${format}`,
  };
}
