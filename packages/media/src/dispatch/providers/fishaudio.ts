/**
 * Provider: FishAudio — Speech-1.x family text-to-speech (synchronous,
 * `POST /v1/tts`). Ported near-verbatim from Open Design's
 * `apps/daemon/src/media/index.ts` `renderFishAudioTTS` — see
 * `source-map.md`.
 *
 * Returns raw audio bytes directly (not wrapped in JSON, unlike
 * MiniMax/SenseAudio's hex-in-JSON shape, and not the OpenAI
 * `/audio/speech` shape either), so this reuses only the generic
 * `truncate`/`withRequestInit` helpers from `openai-compatible.ts`.
 *
 * Dropped from the origin's no-credential error message: the `OD_`-
 * prefixed override env var (`OD_FISHAUDIO_API_KEY`) — `providers.ts`'s
 * `PROVIDER_CREDENTIAL_ENV_VARS.fishaudio` already de-branded this to
 * plain `FISH_AUDIO_API_KEY`.
 */
import { truncate, withRequestInit } from '../openai-compatible.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

const FISHAUDIO_DEFAULT_BASE_URL = 'https://api.fish.audio';

const FISHAUDIO_TTS_MODEL_MAP: Record<string, string> = {
  'fish-speech-2': 'speech-1.6',
};

const NO_CREDENTIAL_MESSAGE = 'no FishAudio credential — configure an API key or set FISH_AUDIO_API_KEY.';

export async function renderFishAudioTTS(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || FISHAUDIO_DEFAULT_BASE_URL).replace(/\/$/, '');
  // Same precedence as minimax.ts's renderMinimaxTTS: an explicit caller
  // alias (ctx.wireModel set to something other than the catalog id) wins
  // over the project's hardcoded FishAudio rename map, which in turn wins
  // over passing the catalog id through unchanged.
  const wireModel = ctx.wireModel !== ctx.model ? ctx.wireModel : FISHAUDIO_TTS_MODEL_MAP[ctx.model] || ctx.model;
  const text = (ctx.prompt && ctx.prompt.trim()) || 'This is a test.';

  const body: Record<string, unknown> = {
    text,
    format: 'mp3',
    mp3_bitrate: 128,
    model: wireModel,
    normalize: true,
    latency: 'normal',
  };
  // FishAudio's `reference_id` slot pins which voice the synth uses;
  // empty/absent means FishAudio falls back to its own default voice for
  // the chosen model.
  if (ctx.voice && ctx.voice.trim()) {
    body.reference_id = ctx.voice.trim();
  }

  const resp = await fetch(
    `${baseUrl}/v1/tts`,
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credentials.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`fishaudio tts ${resp.status}: ${truncate(errText, 240)}`);
  }
  const bytes = Buffer.from(await resp.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('fishaudio tts returned zero bytes');
  }
  return {
    bytes,
    providerNote: `fishaudio/${wireModel} · ${bytes.length} bytes`,
    suggestedExt: '.mp3',
  };
}
