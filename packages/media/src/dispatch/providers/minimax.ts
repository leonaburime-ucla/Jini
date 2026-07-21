/**
 * Provider: MiniMax — Speech-02 family text-to-speech (synchronous,
 * `POST /t2a_v2`). Ported near-verbatim from Open Design's
 * `apps/daemon/src/media/index.ts` `renderMinimaxTTS` — see
 * `source-map.md`.
 *
 * Not OpenAI-wire-compatible — MiniMax's request body
 * (`voice_setting`/`audio_setting`) and response shape (hex-encoded audio
 * under `data.audio`, wrapped in a `base_resp` envelope that can carry a
 * *logical* failure on an HTTP 200) share nothing with `/audio/speech`, so
 * this does not route through `openai-compatible.ts`'s JSON-parsing
 * helpers — only the genuinely vendor-agnostic `truncate`/`withRequestInit`
 * are reused (matching `nanobanana.ts`'s/`openrouter.ts`'s reasoning for
 * the same call).
 *
 * `renderMinimaxImage` (a *different* surface on the same provider slot,
 * gated behind its own `OD_MINIMAX_IMAGE_BASE_URL` env var read directly
 * from `process.env` in the origin) is intentionally not ported — this
 * package never reads `process.env` itself (see `providers.ts`'s standing
 * invariant) and the task for this pass only covers MiniMax TTS.
 *
 * Dropped from the origin's no-credential error message: the `OD_`-
 * prefixed override env var (`OD_MINIMAX_API_KEY`) — `providers.ts`'s
 * `PROVIDER_CREDENTIAL_ENV_VARS.minimax` already de-branded this to plain
 * `MINIMAX_API_KEY`.
 */
import { truncate, withRequestInit } from '../openai-compatible.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimaxi.chat/v1';
const MINIMAX_DEFAULT_VOICE_ID = 'male-qn-qingse';

const MINIMAX_TTS_MODEL_MAP: Record<string, string> = {
  'minimax-tts': 'speech-02-turbo',
};

const NO_CREDENTIAL_MESSAGE = 'no MiniMax credential — configure an API key or set MINIMAX_API_KEY.';

interface MinimaxTTSResponse {
  readonly base_resp?: { readonly status_code?: number; readonly status_msg?: string };
  readonly data?: { readonly audio?: string };
  readonly extra_info?: { readonly audio_length?: number };
}

export async function renderMinimaxTTS(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || MINIMAX_DEFAULT_BASE_URL).replace(/\/$/, '');
  // Precedence: an explicit caller alias (ctx.wireModel set to something
  // other than the catalog id) wins over the legacy MiniMax rename map,
  // which in turn wins over passing the catalog id through unchanged.
  const wireModel = ctx.wireModel !== ctx.model ? ctx.wireModel : MINIMAX_TTS_MODEL_MAP[ctx.model] || ctx.model;
  const text = (ctx.prompt && ctx.prompt.trim()) || 'This is a test.';
  const voiceId = (ctx.voice && ctx.voice.trim()) || MINIMAX_DEFAULT_VOICE_ID;
  const languageBoost = ctx.language.trim();

  const body: Record<string, unknown> = {
    model: wireModel,
    text,
    stream: false,
    ...(languageBoost ? { language_boost: languageBoost } : {}),
    voice_setting: {
      voice_id: voiceId,
      speed: 1.0,
      vol: 1.0,
      pitch: 0,
    },
    audio_setting: {
      sample_rate: 32000,
      format: 'mp3',
    },
  };

  const resp = await fetch(
    `${baseUrl}/t2a_v2`,
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
    throw new Error(`minimax tts ${resp.status}: ${truncate(respText, 240)}`);
  }
  let data: MinimaxTTSResponse;
  try {
    data = JSON.parse(respText);
  } catch {
    throw new Error(`minimax tts non-JSON: ${truncate(respText, 200)}`);
  }
  // MiniMax wraps every response in `base_resp`; an HTTP 200 can still be
  // a logical failure (auth, quota, an unrecognized voice_id, ...).
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`minimax tts api error ${data.base_resp.status_code}: ${data.base_resp.status_msg || 'unknown'}`);
  }
  const hex = data.data?.audio;
  if (typeof hex !== 'string' || !hex) {
    throw new Error('minimax tts response missing data.audio');
  }
  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length === 0) {
    throw new Error('minimax tts decoded zero bytes');
  }
  const audioLength = data.extra_info?.audio_length;
  const seconds = audioLength ? Math.round(audioLength / 100) / 10 : '?';

  return {
    bytes,
    providerNote: `minimax/${wireModel} · ${voiceId} · ${seconds}s · ${bytes.length} bytes`,
    suggestedExt: '.mp3',
  };
}
