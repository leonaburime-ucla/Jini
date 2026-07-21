/**
 * Provider: ElevenLabs — v3 text-to-speech (`renderElevenLabsTTS`) and
 * text-to-sound-effect (`renderElevenLabsSfx`), both synchronous. Ported
 * near-verbatim from Open Design's `apps/daemon/src/media/index.ts`
 * `renderElevenLabsTTS`/`renderElevenLabsSfx` — see `source-map.md`.
 *
 * Neither endpoint returns the OpenAI-images/audio wire shape (both are
 * ElevenLabs-specific JSON-body-in, raw-audio-bytes-out POSTs), so this
 * does not route through `openai-compatible.ts`'s OpenAI-shape helpers —
 * only the generic `truncate`/`withRequestInit` are reused.
 *
 * Dropped from the origin's no-credential error message: the `OD_`-
 * prefixed project-scoped override env var (`OD_ELEVENLABS_API_KEY`) —
 * `providers.ts`'s `PROVIDER_CREDENTIAL_ENV_VARS.elevenlabs` already
 * de-branded this to plain `ELEVENLABS_API_KEY`, matching every other
 * ported provider.
 *
 * Reworded from the origin: both prompt-validation error messages
 * referenced a `--prompt` CLI flag ("Pass --prompt before retrying" /
 * "Shorten --prompt before retrying") — an assumption that the caller is
 * OD's own `hermes` CLI. This package's `MediaGenerationRequest.prompt` is
 * a plain request field with no CLI-flag concept attached to it for every
 * possible host, so both messages were reworded to describe the
 * constraint without assuming how the caller sets it. The underlying
 * validation (non-empty prompt; SFX prompt <= 450 chars) is unchanged.
 */
import { truncate, withRequestInit } from '../openai-compatible.js';
import type { ProviderCredentials, RenderContext, RenderResult } from '../types.js';

const ELEVENLABS_DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
const ELEVENLABS_DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

const ELEVENLABS_TTS_MODEL_MAP: Record<string, string> = {
  'elevenlabs-v3': 'eleven_v3',
};

const ELEVENLABS_SFX_MODEL_MAP: Record<string, string> = {
  'elevenlabs-sfx': 'eleven_text_to_sound_v2',
};

const ELEVENLABS_SFX_MAX_PROMPT_CHARS = 450;
const ELEVENLABS_SFX_DEFAULT_PROMPT_INFLUENCE = 0.3;

const NO_CREDENTIAL_MESSAGE = 'no ElevenLabs credential — configure an API key or set ELEVENLABS_API_KEY.';

function clampElevenLabsSfxDuration(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 5;
  return Math.min(30, Math.max(0.5, value));
}

function clampElevenLabsSfxPromptInfluence(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ELEVENLABS_SFX_DEFAULT_PROMPT_INFLUENCE;
  }
  return Math.min(1, Math.max(0, value));
}

function requireElevenLabsPrompt(text: string, kind: 'TTS' | 'SFX'): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`ElevenLabs ${kind} prompt must not be empty.`);
  }
  return trimmed;
}

function assertElevenLabsSfxPromptLength(text: string): void {
  const promptChars = Array.from(text).length;
  if (promptChars > ELEVENLABS_SFX_MAX_PROMPT_CHARS) {
    throw new Error(`ElevenLabs SFX prompt exceeds ${ELEVENLABS_SFX_MAX_PROMPT_CHARS} characters (${promptChars}). Shorten the prompt before retrying.`);
  }
}

export async function renderElevenLabsTTS(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || ELEVENLABS_DEFAULT_BASE_URL).replace(/\/$/, '');
  const wireModel = ELEVENLABS_TTS_MODEL_MAP[ctx.model] || ctx.model;
  const text = requireElevenLabsPrompt(ctx.prompt, 'TTS');
  const voiceId = (ctx.voice && ctx.voice.trim()) || ELEVENLABS_DEFAULT_VOICE_ID;
  const body = {
    text,
    model_id: wireModel,
    voice_settings: {
      stability: 1,
      similarity_boost: 1,
      style: 0,
      speed: 1,
      use_speaker_boost: true,
    },
  };

  const resp = await fetch(
    `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        'xi-api-key': credentials.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`elevenlabs tts ${resp.status}: ${truncate(errText, 240)}`);
  }
  const bytes = Buffer.from(await resp.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('elevenlabs tts returned zero bytes');
  }
  return {
    bytes,
    providerNote: `elevenlabs/${wireModel} · ${voiceId} · ${bytes.length} bytes`,
    suggestedExt: '.mp3',
  };
}

export async function renderElevenLabsSfx(ctx: RenderContext, credentials: ProviderCredentials): Promise<RenderResult> {
  if (!credentials.apiKey) {
    throw new Error(NO_CREDENTIAL_MESSAGE);
  }
  const baseUrl = (credentials.baseUrl || ELEVENLABS_DEFAULT_BASE_URL).replace(/\/$/, '');
  const wireModel = ELEVENLABS_SFX_MODEL_MAP[ctx.model] || ctx.model;
  const text = requireElevenLabsPrompt(ctx.prompt, 'SFX');
  assertElevenLabsSfxPromptLength(text);
  const durationSeconds = clampElevenLabsSfxDuration(ctx.duration);
  const promptInfluence = clampElevenLabsSfxPromptInfluence(ctx.promptInfluence);
  const body = {
    text,
    duration_seconds: durationSeconds,
    prompt_influence: promptInfluence,
    ...(ctx.loop ? { loop: true } : {}),
    model_id: wireModel,
  };

  const resp = await fetch(
    `${baseUrl}/v1/sound-generation?output_format=mp3_44100_128`,
    withRequestInit(ctx, {
      method: 'POST',
      headers: {
        'xi-api-key': credentials.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`elevenlabs sfx ${resp.status}: ${truncate(errText, 240)}`);
  }
  const bytes = Buffer.from(await resp.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('elevenlabs sfx returned zero bytes');
  }
  return {
    bytes,
    providerNote: `elevenlabs/${wireModel} · ${durationSeconds}s${ctx.loop ? ' · loop' : ''} · ${bytes.length} bytes`,
    suggestedExt: '.mp3',
  };
}
