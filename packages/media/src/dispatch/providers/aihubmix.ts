/**
 * Provider: AIHubMix — an OpenAI-wire-compatible aggregator gateway.
 * `renderAIHubMixImage` (`POST /images/generations`, OpenAI shape) with an
 * internal redirect to a Gemini-native path for gemini/imagen-family
 * catalog ids, and `renderAIHubMixTTS` (`POST /audio/speech`, OpenAI
 * shape). Ported near-verbatim from Open Design's
 * `apps/daemon/src/media/index.ts` `renderAIHubMixImage`/
 * `renderAIHubMixGeminiImage`/`renderAIHubMixTTS` — see `source-map.md`.
 *
 * The non-Gemini image path and the TTS path route through
 * `openai-compatible.ts`'s shared helpers since AIHubMix's default wire
 * shape is genuinely OpenAI-compatible (the whole point of the
 * aggregator). The Gemini-family image path does not — see
 * `aihubmix-shared.ts`'s `aihubmixGeminiImageBytes` doc comment.
 *
 * `renderAIHubMixImage`'s `entry.url` fallback is downloaded through
 * `ssrf-guard.ts`'s `assertAndFetchExternalAsset`, matching the real
 * origin exactly and `senseaudio.ts`'s identical reasoning: the URL is
 * attacker-controllable inside an otherwise-successful response.
 *
 * Simplified from the origin (proven dead code, not assumed): the origin
 * defines `renderAIHubMixGeminiImage` as its own top-level function taking
 * the full `credentials: ProviderConfig` and re-checking
 * `credentials.apiKey` — but it has exactly one call site
 * (`renderAIHubMixImage`, immediately after that same check already threw
 * on a missing key), so the second check can never fire. This port keeps
 * the Gemini path as a private helper (not part of the public surface,
 * since the origin never called it from anywhere else either) and passes
 * the already-validated `apiKey: string` directly instead of the whole
 * optional-`apiKey` credentials object — eliminating the dead branch via
 * the type system rather than leaving an untested `if` or writing a test
 * that fakes a call path the real dispatcher never takes.
 *
 * Dropped from the origin's no-credential error messages (both exported
 * functions): the `OD_`-prefixed override env var
 * (`OD_AIHUBMIX_API_KEY`) — `providers.ts`'s
 * `PROVIDER_CREDENTIAL_ENV_VARS.aihubmix` already de-branded this to plain
 * `AIHUBMIX_API_KEY`.
 */
import { buildOpenAIImageUrl, buildOpenAISpeechUrl, openaiSizeFor, OPENAI_TTS_VOICES, resolveSpeechFormat, truncate, withRequestInit } from '../openai-compatible.js';
import { assertAndFetchExternalAsset } from '../ssrf-guard.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';
import { aihubmixGeminiImageBytes, aihubmixHeaders, AIHUBMIX_DEFAULT_BASE_URL, aihubmixWireModel, classifyAIHubMixModel } from './aihubmix-shared.js';

const NO_CREDENTIAL_MESSAGE = 'no AIHubMix credential — configure an API key or set AIHUBMIX_API_KEY.';

async function renderAIHubMixGeminiImage(ctx: RenderContext, apiKey: string, baseUrl: string, wireModel: string): Promise<RenderResult> {
  const aspect = ctx.aspect || '1:1';
  const bytes = await aihubmixGeminiImageBytes(
    { baseUrl, apiKey, wireModel, prompt: ctx.prompt || 'A high-quality reference image.', aspect },
    (url, init) => fetch(url, withRequestInit(ctx, init)),
  );
  return {
    bytes,
    providerNote: `aihubmix/${wireModel} · ${aspect} · ${bytes.length} bytes (gemini-native)`,
    suggestedExt: '.png',
  };
}

export async function renderAIHubMixImage(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = credentials.baseUrl || AIHUBMIX_DEFAULT_BASE_URL;
  const wireModel = aihubmixWireModel(credentials.model || ctx.wireModel);

  if (classifyAIHubMixModel(wireModel) === 'gemini') {
    return renderAIHubMixGeminiImage(ctx, credentials.apiKey, baseUrl, wireModel);
  }

  const url = buildOpenAIImageUrl(baseUrl, false);
  const body: Record<string, unknown> = {
    model: wireModel,
    prompt: ctx.prompt || 'A high-quality reference image.',
    n: 1,
    size: openaiSizeFor(wireModel, ctx.aspect),
  };
  if (wireModel.startsWith('dall-e-')) {
    body.response_format = 'b64_json';
    body.quality = wireModel === 'dall-e-3' ? 'hd' : 'standard';
  } else {
    body.quality = 'high';
  }

  const resp = await fetch(
    url,
    withRequestInit(ctx, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...aihubmixHeaders(credentials.apiKey) },
      body: JSON.stringify(body),
    }),
  );
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`aihubmix ${resp.status}: ${truncate(text, 240)}`);
  }
  let data: { data?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`aihubmix non-JSON response: ${truncate(text, 200)}`);
  }
  const entry = Array.isArray(data.data) ? (data.data[0] as { b64_json?: string; url?: string } | undefined) : undefined;
  if (!entry) throw new Error('aihubmix response had no data[0]');
  let bytes: Buffer;
  if (entry.b64_json) {
    bytes = Buffer.from(entry.b64_json, 'base64');
  } else if (entry.url) {
    const imgResp = await assertAndFetchExternalAsset(entry.url, withRequestInit(ctx));
    if (!imgResp.ok) throw new Error(`aihubmix image fetch ${imgResp.status}`);
    bytes = Buffer.from(await imgResp.arrayBuffer());
  } else {
    throw new Error('aihubmix response had neither b64_json nor url');
  }
  return {
    bytes,
    providerNote: `aihubmix/${wireModel} · ${ctx.aspect} · ${bytes.length} bytes`,
    suggestedExt: '.png',
  };
}

export async function renderAIHubMixTTS(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = credentials.baseUrl || AIHUBMIX_DEFAULT_BASE_URL;
  const wireModel = aihubmixWireModel(credentials.model || ctx.wireModel);
  const url = buildOpenAISpeechUrl(baseUrl, false);
  const format = resolveSpeechFormat(ctx.speechFormat);
  const text = (ctx.prompt && ctx.prompt.trim()) || 'This is a test.';
  const requestedVoice = (ctx.voice && ctx.voice.trim()) || '';
  const voice = requestedVoice && OPENAI_TTS_VOICES.has(requestedVoice) ? requestedVoice : 'alloy';

  const resp = await fetch(
    url,
    withRequestInit(ctx, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...aihubmixHeaders(credentials.apiKey) },
      body: JSON.stringify({ model: wireModel, input: text, voice, response_format: format }),
    }),
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`aihubmix speech ${resp.status}: ${truncate(errText, 240)}`);
  }
  const bytes = Buffer.from(await resp.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('aihubmix speech returned zero bytes');
  }
  return {
    bytes,
    providerNote: `aihubmix/${wireModel} · ${voice} · ${format} · ${bytes.length} bytes`,
    suggestedExt: format === 'opus' ? '.ogg' : `.${format}`,
  };
}
