/**
 * Provider: `custom-image` — a user-supplied OpenAI-compatible
 * `/v1/images/generations` + `/v1/images/edits` endpoint. Ported
 * near-verbatim from Open Design's `apps/daemon/src/media/index.ts`
 * `renderCustomOpenAIImage`/`customImageOverridesOpenAIModel` — see
 * `source-map.md`.
 */
import { buildOpenAIImageEditUrl, buildOpenAIImageUrl, bytesFromOpenAICompatibleData, openaiSizeFor, parseOpenAICompatibleJson, sniffImageExt, withRequestInit } from '../openai-compatible.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

export const CUSTOM_IMAGE_MODEL_ID = 'custom-image';

export async function renderCustomOpenAIImage(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  const baseUrl = (credentials.baseUrl || '').trim();
  if (!baseUrl) {
    throw new Error('Custom Image API base URL required — configure an OpenAI-compatible /v1/images/generations or /v1/images/edits endpoint');
  }
  const wireModel = (credentials.model || (ctx.wireModel !== CUSTOM_IMAGE_MODEL_ID ? ctx.wireModel : '')).trim();
  if (!wireModel) {
    throw new Error('Custom Image API model required — configure the provider model');
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (credentials.apiKey) {
    headers.authorization = `Bearer ${credentials.apiKey}`;
  }
  const size = openaiSizeFor('gpt-image-1', ctx.aspect);
  const body: Record<string, unknown> = {
    prompt: ctx.prompt || 'A high-quality reference image.',
    model: wireModel,
    n: 1,
    size,
  };
  let url = buildOpenAIImageUrl(baseUrl, false);
  if (ctx.imageRef?.dataUrl) {
    body.response_format = 'b64_json';
    body.images = [{ image_url: ctx.imageRef.dataUrl }];
    url = buildOpenAIImageEditUrl(baseUrl);
  }

  const resp = await fetch(
    url,
    withRequestInit(ctx, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  );
  const data = await parseOpenAICompatibleJson(resp, 'custom image');
  const bytes = await bytesFromOpenAICompatibleData(data, 'custom image', ctx.requestInit);
  return {
    bytes,
    providerNote: `custom-image/${wireModel} · ${size} · ${bytes.length} bytes`,
    suggestedExt: sniffImageExt(bytes),
  };
}

/** Whether the caller's `custom-image` credentials should override an `openai`-provider request (same model configured on both). */
export function customImageOverridesOpenAIModel(ctx: RenderContext, credentials: ProviderCredentials | null): credentials is ProviderCredentials {
  const baseUrl = credentials?.baseUrl?.trim();
  const model = credentials?.model?.trim();
  if (!baseUrl || !model) return false;
  return model === ctx.model || model === ctx.wireModel;
}
