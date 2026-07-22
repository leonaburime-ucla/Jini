/**
 * Provider: ImageRouter — OpenAI-compatible image + video generation
 * routing (`https://api.imagerouter.io/v1/openai`). Ported near-verbatim
 * from Open Design's `apps/daemon/src/media/index.ts`
 * `renderImageRouterImage`/`renderImageRouterVideo` — see `source-map.md`.
 */
import {
  buildOpenAIImageUrl,
  buildOpenAIVideoUrl,
  bytesFromOpenAICompatibleData,
  parseOpenAICompatibleJson,
  sniffImageExt,
  withRequestInit,
} from '../openai-compatible.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

/** ImageRouter's image/video generation `size` string for a given aspect ratio. */
export function imageRouterSizeFor(aspect: string | undefined, surface: 'image' | 'video'): string {
  if (surface === 'video') {
    if (aspect === '1:1') return '1024x1024';
    if (aspect === '9:16') return '576x1024';
    if (aspect === '4:3') return '1024x768';
    if (aspect === '3:4') return '768x1024';
    return '1024x576';
  }
  if (aspect === '16:9') return '1024x576';
  if (aspect === '9:16') return '576x1024';
  if (aspect === '4:3') return '1024x768';
  if (aspect === '3:4') return '768x1024';
  return '1024x1024';
}

const NO_CREDENTIAL_MESSAGE = 'no ImageRouter API key — configure it or set IMAGEROUTER_API_KEY';

export async function renderImageRouterImage(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || 'https://api.imagerouter.io/v1/openai').trim();
  const wireModel = (credentials.model || ctx.wireModel).trim();
  const url = buildOpenAIImageUrl(baseUrl, false);
  const size = imageRouterSizeFor(ctx.aspect, 'image');
  const body: Record<string, unknown> = {
    prompt: ctx.prompt || 'A high-quality reference image.',
    model: wireModel,
    quality: 'auto',
    size,
    response_format: 'b64_json',
    output_format: 'png',
  };

  const resp = await fetch(
    url,
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  const data = await parseOpenAICompatibleJson(resp, 'imagerouter image');
  const bytes = await bytesFromOpenAICompatibleData(data, 'imagerouter image', ctx.requestInit);
  return {
    bytes,
    providerNote: `imagerouter/${wireModel} · ${size} · ${bytes.length} bytes`,
    suggestedExt: sniffImageExt(bytes),
  };
}

export async function renderImageRouterVideo(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || 'https://api.imagerouter.io/v1/openai').trim();
  const wireModel = (credentials.model || ctx.wireModel).trim();
  const url = buildOpenAIVideoUrl(baseUrl);
  const seconds = typeof ctx.length === 'number' ? ctx.length : 'auto';
  const size = imageRouterSizeFor(ctx.aspect, 'video');
  const body: Record<string, unknown> = {
    prompt: ctx.prompt || 'A short cinematic clip.',
    model: wireModel,
    size,
    seconds,
    response_format: 'b64_json',
  };

  const resp = await fetch(
    url,
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  const data = await parseOpenAICompatibleJson(resp, 'imagerouter video');
  const bytes = await bytesFromOpenAICompatibleData(data, 'imagerouter video', ctx.requestInit);
  return {
    bytes,
    providerNote: `imagerouter/${wireModel} · ${size} · ${seconds === 'auto' ? 'auto' : `${seconds}s`} · ${bytes.length} bytes`,
    suggestedExt: '.mp4',
  };
}
