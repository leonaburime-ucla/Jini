/**
 * Provider: SenseAudio — `senseaudio-tts-1.5` text-to-speech
 * (`renderSenseAudioTTS`, `POST /v1/t2a_v2`) and text-to-image
 * (`renderSenseAudioImage`, `POST /v1/image/sync`), both synchronous.
 * Ported near-verbatim from Open Design's
 * `apps/daemon/src/media/index.ts` `renderSenseAudioTTS`/
 * `renderSenseAudioImage` — see `source-map.md`.
 *
 * Neither endpoint is OpenAI-wire-compatible: TTS mirrors MiniMax's own
 * `voice_setting`/`audio_setting` body shape and `base_resp` response
 * envelope (an HTTP 200 can still be a logical failure), and image returns
 * `{ url }` rather than `{ data: [...] }`, so only the generic
 * `truncate`/`withRequestInit` helpers are reused from
 * `openai-compatible.ts` (matching `minimax.ts`'s reasoning).
 *
 * `renderSenseAudioImage`'s `url` is fetched through `ssrf-guard.ts`'s
 * `assertAndFetchExternalAsset` — same as the real origin — because it is
 * attacker-controllable inside an otherwise-successful response (a
 * compromised/misconfigured gateway could point it at internal
 * infrastructure); `assertAndFetchExternalAsset` DNS-resolves the host,
 * rejects loopback/RFC1918/link-local/CGNAT/metadata-service addresses,
 * and pins `redirect: 'error'` so a validated public URL can't 302 into
 * private space either.
 *
 * Dropped from the origin's no-credential error messages (both
 * functions): the `OD_`-prefixed override env var
 * (`OD_SENSEAUDIO_API_KEY`) — `providers.ts`'s
 * `PROVIDER_CREDENTIAL_ENV_VARS.senseaudio` already de-branded this to
 * plain `SENSEAUDIO_API_KEY`.
 */
import { truncate, withRequestInit } from '../openai-compatible.js';
import { assertAndFetchExternalAsset } from '../ssrf-guard.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

const SENSEAUDIO_DEFAULT_BASE_URL = 'https://api.senseaudio.cn';
const SENSEAUDIO_DEFAULT_VOICE_ID = 'female_0033_b';
const SENSEAUDIO_IMAGE_PROMPT_LIMIT = 2000;

const SENSEAUDIO_TTS_MODEL_MAP: Record<string, string> = {
  'senseaudio-tts': 'senseaudio-tts-1.5-260319',
};

const NO_CREDENTIAL_MESSAGE = 'no SenseAudio credential — configure an API key or set SENSEAUDIO_API_KEY.';

interface SenseAudioBaseResp {
  readonly status_code?: number;
  readonly status_msg?: string;
}

interface SenseAudioTTSResponse {
  readonly base_resp?: SenseAudioBaseResp;
  readonly data?: { readonly audio?: string };
  readonly extra_info?: { readonly audio_length?: number };
}

export async function renderSenseAudioTTS(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || SENSEAUDIO_DEFAULT_BASE_URL).replace(/\/$/, '');
  const wireModel = SENSEAUDIO_TTS_MODEL_MAP[ctx.model] || ctx.model;
  const text = (ctx.prompt && ctx.prompt.trim()) || 'This is a test.';
  const voiceId = (ctx.voice && ctx.voice.trim()) || SENSEAUDIO_DEFAULT_VOICE_ID;

  const body = {
    model: wireModel,
    text,
    stream: false,
    voice_setting: {
      voice_id: voiceId,
      speed: 1,
      vol: 1,
      pitch: 0,
    },
    audio_setting: {
      format: 'mp3',
      sample_rate: 32000,
      bitrate: 128000,
      channel: 2,
    },
  };

  const resp = await fetch(
    `${baseUrl}/v1/t2a_v2`,
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  const respText = await resp.text();
  if (!resp.ok) {
    throw new Error(`senseaudio tts ${resp.status}: ${truncate(respText, 240)}`);
  }
  let data: SenseAudioTTSResponse;
  try {
    data = JSON.parse(respText);
  } catch {
    throw new Error(`senseaudio tts non-JSON: ${truncate(respText, 200)}`);
  }
  // SenseAudio mirrors MiniMax's base_resp envelope: HTTP 200 can still be
  // a logical failure (auth, quota, an unrecognized voice_id, ...).
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`senseaudio tts api error ${data.base_resp.status_code}: ${data.base_resp.status_msg || 'unknown'}`);
  }
  const hex = data.data?.audio;
  if (typeof hex !== 'string' || !hex) {
    throw new Error('senseaudio tts response missing data.audio');
  }
  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length === 0) {
    throw new Error('senseaudio tts decoded zero bytes');
  }
  const audioLength = data.extra_info?.audio_length;
  const seconds = audioLength ? Math.round(audioLength / 100) / 10 : '?';

  return {
    bytes,
    providerNote: `senseaudio/${wireModel} · ${voiceId} · ${seconds}s · ${bytes.length} bytes`,
    suggestedExt: '.mp3',
  };
}

/** SenseAudio's image gateway rejects non-standard pixel sizes with a 400; keep this mapping in sync with any other SenseAudio-image call site a future host adds. */
function senseAudioImageSize(aspect: string | undefined): string {
  if (aspect === '16:9') return '1280x720';
  if (aspect === '9:16') return '720x1280';
  if (aspect === '4:3') return '1024x768';
  if (aspect === '3:4') return '768x1024';
  return '1024x1024';
}

interface SenseAudioImageResponse {
  readonly base_resp?: SenseAudioBaseResp;
  readonly error_message?: string;
  readonly url?: string;
}

export async function renderSenseAudioImage(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || SENSEAUDIO_DEFAULT_BASE_URL).replace(/\/$/, '');
  const promptRaw = (ctx.prompt && ctx.prompt.trim()) || 'A high-quality reference image.';
  // SenseAudio rejects prompts over 2000 chars with a 4xx; trim
  // defensively so a verbose caller doesn't dead-end the generation.
  const prompt = promptRaw.length > SENSEAUDIO_IMAGE_PROMPT_LIMIT ? promptRaw.slice(0, SENSEAUDIO_IMAGE_PROMPT_LIMIT) : promptRaw;
  const size = senseAudioImageSize(ctx.aspect);
  const reference = ctx.imageRef?.dataUrl;

  const body: Record<string, unknown> = {
    model: ctx.wireModel,
    prompt,
    size,
  };
  if (reference) {
    // The API documents `size` as optional when a reference image is
    // supplied; it is still sent so output dimensions stay deterministic
    // across t2i/i2i calls for the same model.
    body.reference = reference;
  }

  const resp = await fetch(
    `${baseUrl}/v1/image/sync`,
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  const respText = await resp.text();
  if (!resp.ok) {
    throw new Error(`senseaudio image ${resp.status}: ${truncate(respText, 240)}`);
  }
  let data: SenseAudioImageResponse;
  try {
    data = JSON.parse(respText);
  } catch {
    throw new Error(`senseaudio image non-JSON: ${truncate(respText, 200)}`);
  }
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`senseaudio image api error ${data.base_resp.status_code}: ${data.base_resp.status_msg || 'unknown'}`);
  }
  if (typeof data.error_message === 'string' && data.error_message) {
    throw new Error(`senseaudio image api error: ${data.error_message}`);
  }
  const url = typeof data.url === 'string' ? data.url : '';
  if (!url) {
    throw new Error('senseaudio image response missing url');
  }
  const imgResp = await assertAndFetchExternalAsset(url, withRequestInit(ctx));
  if (!imgResp.ok) {
    throw new Error(`senseaudio image fetch ${imgResp.status}`);
  }
  const bytes = Buffer.from(await imgResp.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('senseaudio image fetch returned zero bytes');
  }

  return {
    bytes,
    providerNote: `senseaudio/${ctx.wireModel} · ${size}${reference ? ' · i2i' : ''} · ${bytes.length} bytes`,
    suggestedExt: '.png',
  };
}
