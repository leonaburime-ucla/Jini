import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMediaDispatchEngine } from '../engine.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createMediaDispatchEngine — validation', () => {
  it('rejects an unsupported surface', async () => {
    const engine = createMediaDispatchEngine();
    await expect(engine.generate({ surface: 'unknown' as never, model: 'x' })).rejects.toThrow(/unsupported surface/);
  });

  it('rejects a missing model', async () => {
    const engine = createMediaDispatchEngine();
    await expect(engine.generate({ surface: 'image', model: '' })).rejects.toThrow(/model required/);
  });

  it('rejects an unknown model id', async () => {
    const engine = createMediaDispatchEngine();
    await expect(engine.generate({ surface: 'image', model: 'not-a-real-model' })).rejects.toThrow(/unknown model/);
  });

  it('rejects a model not registered for the given surface', async () => {
    const engine = createMediaDispatchEngine();
    // gpt-image-2 is an image model, not a video model.
    await expect(engine.generate({ surface: 'video', model: 'gpt-image-2' })).rejects.toThrow(/not registered for surface "video"/);
  });

  it('rejects an invalid audioKind', async () => {
    const engine = createMediaDispatchEngine();
    await expect(engine.generate({ surface: 'audio', model: 'gpt-4o-mini-tts', audioKind: 'bogus' as never })).rejects.toThrow(/unsupported audioKind/);
  });

  it('rejects a model not registered for the resolved audioKind', async () => {
    const engine = createMediaDispatchEngine();
    // gpt-4o-mini-tts is a 'speech' model, not registered under 'music'.
    await expect(engine.generate({ surface: 'audio', model: 'gpt-4o-mini-tts', audioKind: 'music' })).rejects.toThrow(/not registered for surface "audio · music"/);
  });

  it('defaults audioKind to "music" when omitted entirely', async () => {
    const engine = createMediaDispatchEngine();
    // Same assertion as the explicit-'music' case above, but proves the
    // `request.audioKind || 'music'` default itself, not just that 'music'
    // works when passed explicitly.
    await expect(engine.generate({ surface: 'audio', model: 'gpt-4o-mini-tts' })).rejects.toThrow(/not registered for surface "audio · music"/);
  });
});

describe('createMediaDispatchEngine — clamping', () => {
  it('clamps an out-of-range video length and reports a warning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('vid').toString('base64') }] }), { status: 200 })),
    );
    const engine = createMediaDispatchEngine({ credentials: { imagerouter: { apiKey: 'k' } } });
    const result = await engine.generate({ surface: 'video', model: 'bytedance/seedance-1.5-pro', length: 9999 });
    expect(result.warnings.some((w) => w.includes('clamped'))).toBe(true);
  });

  it('does not warn when length is already an allowed value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('vid').toString('base64') }] }), { status: 200 })),
    );
    const engine = createMediaDispatchEngine({ credentials: { imagerouter: { apiKey: 'k' } } });
    const result = await engine.generate({ surface: 'video', model: 'bytedance/seedance-1.5-pro', length: 8 });
    expect(result.warnings).toEqual([]);
  });

  it('clamps an out-of-range audio duration and reports a warning', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from('audio'), { status: 200 })));
    const engine = createMediaDispatchEngine({ credentials: { openai: { apiKey: 'sk-test' } } });
    const result = await engine.generate({ surface: 'audio', audioKind: 'speech', model: 'gpt-4o-mini-tts', duration: 9999 });
    expect(result.warnings.some((w) => w.includes('duration'))).toBe(true);
  });
});

describe('createMediaDispatchEngine — dispatch routing', () => {
  it('routes openai + image to renderOpenAIImage with the configured credentials', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe('gpt-image-2');
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('img').toString('base64') }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const engine = createMediaDispatchEngine({ credentials: { openai: { apiKey: 'sk-test' } } });
    const result = await engine.generate({ surface: 'image', model: 'gpt-image-2', prompt: 'x' });
    expect(result.providerId).toBe('openai');
    expect(result.usedStubFallback).toBe(false);
    expect(result.bytes.toString('utf8')).toBe('img');
  });

  it('routes openai + audio:speech to renderOpenAISpeech', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from('audio'), { status: 200 })));
    const engine = createMediaDispatchEngine({ credentials: { openai: { apiKey: 'sk-test' } } });
    const result = await engine.generate({ surface: 'audio', audioKind: 'speech', model: 'gpt-4o-mini-tts' });
    expect(result.providerId).toBe('openai');
    expect(result.bytes.toString('utf8')).toBe('audio');
  });

  it('routes imagerouter + image and imagerouter + video', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('x').toString('base64') }] }), { status: 200 })),
    );
    const engine = createMediaDispatchEngine({ credentials: { imagerouter: { apiKey: 'k' } } });
    const imageResult = await engine.generate({ surface: 'image', model: 'openai/gpt-image-2' });
    expect(imageResult.providerId).toBe('imagerouter');
    const videoResult = await engine.generate({ surface: 'video', model: 'bytedance/seedance-1.5-pro' });
    expect(videoResult.providerId).toBe('imagerouter');
  });

  it('routes custom-image + image to renderCustomOpenAIImage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('x').toString('base64') }] }), { status: 200 })),
    );
    const engine = createMediaDispatchEngine({ credentials: { 'custom-image': { baseUrl: 'https://x.example.com', model: 'm' } } });
    const result = await engine.generate({ surface: 'image', model: 'custom-image' });
    expect(result.providerId).toBe('custom-image');
  });

  it('threads a single imageRef through to a renderer that consumes it (custom-image -> /images/edits)', async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://x.example.com/images/edits');
      const body = JSON.parse(init.body as string);
      expect(body.images).toEqual([{ image_url: 'data:image/png;base64,REF' }]);
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('x').toString('base64') }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const engine = createMediaDispatchEngine({ credentials: { 'custom-image': { baseUrl: 'https://x.example.com', model: 'm' } } });
    const result = await engine.generate({
      surface: 'image',
      model: 'custom-image',
      imageRef: { dataUrl: 'data:image/png;base64,REF' },
    });
    expect(result.providerId).toBe('custom-image');
  });

  it('overrides an openai+image request to custom-image when custom-image credentials name the same model', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('https://custom.example.com/images/generations');
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('x').toString('base64') }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const engine = createMediaDispatchEngine({
      credentials: {
        openai: { apiKey: 'sk-should-not-be-used' },
        'custom-image': { baseUrl: 'https://custom.example.com', model: 'dall-e-3' },
      },
    });
    const result = await engine.generate({ surface: 'image', model: 'dall-e-3' });
    expect(result.providerId).toBe('custom-image');
  });

  it('does not override when custom-image credentials name a different model', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.openai.com/v1/images/generations');
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('x').toString('base64') }] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const engine = createMediaDispatchEngine({
      credentials: {
        openai: { apiKey: 'sk-test' },
        'custom-image': { baseUrl: 'https://custom.example.com', model: 'some-other-model' },
      },
    });
    const result = await engine.generate({ surface: 'image', model: 'dall-e-3' });
    expect(result.providerId).toBe('openai');
  });
});

describe('createMediaDispatchEngine — stub fallback', () => {
  it('throws a clear error when no renderer is wired and allowStubFallback is not set (fail closed by default)', async () => {
    const engine = createMediaDispatchEngine();
    // grok+image has no renderer in this pass.
    await expect(engine.generate({ surface: 'image', model: 'grok-imagine-image' })).rejects.toThrow(/no renderer configured/);
  });

  it('returns placeholder bytes when allowStubFallback is true and no renderer is wired', async () => {
    const engine = createMediaDispatchEngine({ allowStubFallback: true });
    const result = await engine.generate({ surface: 'image', model: 'grok-imagine-image' });
    expect(result.usedStubFallback).toBe(true);
    expect(result.providerId).toBe('grok');
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  it('never falls back to a stub for a (provider, surface) pair that IS wired, even with allowStubFallback true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('real').toString('base64') }] }), { status: 200 })),
    );
    const engine = createMediaDispatchEngine({ allowStubFallback: true, credentials: { openai: { apiKey: 'sk-test' } } });
    const result = await engine.generate({ surface: 'image', model: 'gpt-image-2' });
    expect(result.usedStubFallback).toBe(false);
    expect(result.bytes.toString('utf8')).toBe('real');
  });
});
