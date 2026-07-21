/**
 * Provider: xAI Grok Imagine — image generation via an OpenAI-images-
 * compatible `/images/generations` endpoint. Ported near-verbatim from Open
 * Design's `apps/daemon/src/media/index.ts` `renderGrokImage` — see
 * `source-map.md`.
 *
 * The response shape (`{ data: [{ b64_json | url }] }`) is identical to
 * OpenAI's images API, so this routes through `openai-compatible.ts`'s
 * already-ported JSON-parsing/byte-extraction/URL-building helpers rather
 * than re-implementing them.
 *
 * Dropped from the origin's no-credential error message: the
 * OD-specific "sign in with your SuperGrok subscription (in OD or via
 * `hermes auth add xai-oauth`)" OAuth guidance — this package has no OAuth
 * chain or local-CLI-login concept; credentials are always host-injected
 * (see `types.ts`'s `ProviderCredentials`), matching every other ported
 * provider's error-message style (e.g. `openai.ts`'s
 * `OPENAI_IMAGE_NO_CREDENTIAL_MESSAGE`).
 */
import { buildOpenAIImageUrl, bytesFromOpenAICompatibleData, parseOpenAICompatibleJson, sniffImageExt, withRequestInit } from '../openai-compatible.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

/**
 * xAI's Imagine API accepts a wide list of aspect ratios (1:1, 16:9, 9:16,
 * 4:3, 3:4, 3:2, 2:3, 2:1, 1:2, 19.5:9, 9:19.5, 20:9, 9:20, auto) —
 * `providers.ts`'s `MEDIA_ASPECTS` is a strict subset, so a recognized
 * value passes through and anything else defaults to 16:9. Written as
 * independent `if` returns (rather than the origin's one `||`-chained
 * condition) to match this package's established aspect-mapping style
 * (see `imagerouter.ts`'s `imageRouterSizeFor`) — same input -> output
 * mapping for every case, not a behavior change.
 */
export function grokAspectFor(aspect: string | undefined): string {
  if (aspect === '1:1') return '1:1';
  if (aspect === '16:9') return '16:9';
  if (aspect === '9:16') return '9:16';
  if (aspect === '4:3') return '4:3';
  if (aspect === '3:4') return '3:4';
  return '16:9';
}

const NO_CREDENTIAL_MESSAGE = 'no xAI credential — configure an API key or set XAI_API_KEY.';

export async function renderGrokImage(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || 'https://api.x.ai/v1').replace(/\/$/, '');
  const aspectRatio = grokAspectFor(ctx.aspect);
  const body: Record<string, unknown> = {
    model: ctx.wireModel,
    prompt: ctx.prompt || 'A high-quality reference image.',
    n: 1,
    aspect_ratio: aspectRatio,
    response_format: 'b64_json',
  };

  const resp = await fetch(
    buildOpenAIImageUrl(baseUrl, false),
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  const data = await parseOpenAICompatibleJson(resp, 'grok image');
  const bytes = await bytesFromOpenAICompatibleData(data, 'grok image', ctx.requestInit);
  return {
    bytes,
    providerNote: `grok/${ctx.wireModel} · ${aspectRatio} · ${bytes.length} bytes`,
    suggestedExt: sniffImageExt(bytes),
  };
}
