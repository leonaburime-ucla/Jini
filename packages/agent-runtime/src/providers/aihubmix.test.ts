import { describe, expect, it, vi } from 'vitest';
import {
  AIHUBMIX_APP_CODE,
  AIHUBMIX_DEFAULT_BASE_URL,
  AIHUBMIX_IMAGE_ASPECT_TO_SIZE,
  aihubmixAppCodeHeader,
  aihubmixCatalogUrl,
  aihubmixGeminiImageBytes,
  aihubmixGeminiImageUrl,
  aihubmixHeaders,
  aihubmixOriginFromBase,
  aihubmixVideoSeconds,
  aihubmixWireModel,
  classifyAIHubMixModel,
  parseAIHubMixCatalog,
} from './aihubmix.js';

describe('aihubmixHeaders / aihubmixAppCodeHeader', () => {
  it('includes bearer auth and the APP-Code header', () => {
    expect(aihubmixHeaders('key1')).toEqual({
      authorization: 'Bearer key1',
      'APP-Code': AIHUBMIX_APP_CODE,
    });
  });

  it('aihubmixAppCodeHeader returns just the attribution header', () => {
    expect(aihubmixAppCodeHeader()).toEqual({ 'APP-Code': AIHUBMIX_APP_CODE });
  });
});

describe('classifyAIHubMixModel', () => {
  it('routes gemini*/imagen* to gemini', () => {
    expect(classifyAIHubMixModel('gemini-2.0-flash')).toBe('gemini');
    expect(classifyAIHubMixModel('imagen-3')).toBe('gemini');
  });

  it('excludes -nothink/-search suffixes and embedding models from gemini', () => {
    expect(classifyAIHubMixModel('gemini-2.0-nothink')).toBe('openai');
    expect(classifyAIHubMixModel('gemini-2.0-search')).toBe('openai');
    expect(classifyAIHubMixModel('gemini-embedding-001')).toBe('openai');
  });

  it('routes claude* to anthropic', () => {
    expect(classifyAIHubMixModel('claude-3-5-sonnet')).toBe('anthropic');
  });

  it('defaults everything else to openai, handling empty/undefined input', () => {
    expect(classifyAIHubMixModel('gpt-4o')).toBe('openai');
    expect(classifyAIHubMixModel('')).toBe('openai');
    expect(classifyAIHubMixModel(undefined as unknown as string)).toBe('openai');
  });
});

describe('aihubmixOriginFromBase', () => {
  it('returns the origin of a valid base url', () => {
    expect(aihubmixOriginFromBase('https://aihubmix.com/v1')).toBe('https://aihubmix.com');
  });

  it('falls back to the default base url origin when empty', () => {
    expect(aihubmixOriginFromBase('')).toBe('https://aihubmix.com');
  });

  it('falls back to the hardcoded origin on an invalid url', () => {
    expect(aihubmixOriginFromBase('not a url')).toBe('https://aihubmix.com');
  });
});

describe('aihubmixGeminiImageUrl', () => {
  it('builds the gemini-native generateContent endpoint', () => {
    expect(aihubmixGeminiImageUrl(AIHUBMIX_DEFAULT_BASE_URL, 'gemini-2.5-flash-image')).toBe(
      'https://aihubmix.com/gemini/v1beta/models/gemini-2.5-flash-image:generateContent',
    );
  });
});

describe('aihubmixGeminiImageBytes', () => {
  it('returns decoded image bytes on success (inlineData)', async () => {
    const b64 = Buffer.from('hello').toString('base64');
    const doFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inlineData: { data: b64 } }] } }],
      }),
    });
    const bytes = await aihubmixGeminiImageBytes(
      { baseUrl: AIHUBMIX_DEFAULT_BASE_URL, apiKey: 'k', wireModel: 'm', prompt: 'p', aspect: '1:1' },
      doFetch,
    );
    expect(bytes.toString('utf8')).toBe('hello');
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('supports the snake_case inline_data field', async () => {
    const b64 = Buffer.from('snake').toString('base64');
    const doFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ inline_data: { data: b64 } }] } }],
      }),
    });
    const bytes = await aihubmixGeminiImageBytes(
      { baseUrl: AIHUBMIX_DEFAULT_BASE_URL, apiKey: 'k', wireModel: 'm', prompt: 'p', aspect: '1:1' },
      doFetch,
    );
    expect(bytes.toString('utf8')).toBe('snake');
  });

  it('throws with response text on a non-ok response', async () => {
    const doFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    });
    await expect(
      aihubmixGeminiImageBytes(
        { baseUrl: AIHUBMIX_DEFAULT_BASE_URL, apiKey: 'k', wireModel: 'm', prompt: 'p', aspect: '1:1' },
        doFetch,
      ),
    ).rejects.toThrow(/aihubmix image \(gemini\) 400/);
  });

  it('throws when text() itself rejects on a non-ok response', async () => {
    const doFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error('boom');
      },
    });
    await expect(
      aihubmixGeminiImageBytes(
        { baseUrl: AIHUBMIX_DEFAULT_BASE_URL, apiKey: 'k', wireModel: 'm', prompt: 'p', aspect: '1:1' },
        doFetch,
      ),
    ).rejects.toThrow(/aihubmix image \(gemini\) 500/);
  });

  it('throws when the response has no inline image data', async () => {
    const doFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    await expect(
      aihubmixGeminiImageBytes(
        { baseUrl: AIHUBMIX_DEFAULT_BASE_URL, apiKey: 'k', wireModel: 'm', prompt: 'p', aspect: '1:1' },
        doFetch,
      ),
    ).rejects.toThrow(/no inline image data/);
  });
});

describe('aihubmixWireModel', () => {
  it('maps known catalogue ids to their upstream wire name', () => {
    expect(aihubmixWireModel('aihubmix-gpt-image-1')).toBe('gpt-image-1');
    expect(aihubmixWireModel('aihubmix-dall-e-3')).toBe('dall-e-3');
    expect(aihubmixWireModel('aihubmix-tts-1')).toBe('tts-1');
  });

  it('falls back to stripping the aihubmix- prefix for unknown ids', () => {
    expect(aihubmixWireModel('aihubmix-some-new-model')).toBe('some-new-model');
  });

  it('returns the id unchanged when it has no prefix', () => {
    expect(aihubmixWireModel('gpt-4o')).toBe('gpt-4o');
  });
});

describe('aihubmixVideoSeconds', () => {
  it('snaps veo durations to the nearest allowed value', () => {
    expect(aihubmixVideoSeconds('veo-3', 5)).toBe('4');
    expect(aihubmixVideoSeconds('veo-3', 7)).toBe('6');
    expect(aihubmixVideoSeconds('veo-3', 9)).toBe('8');
  });

  it('snaps sora durations', () => {
    expect(aihubmixVideoSeconds('sora-2', 1)).toBe('4');
    expect(aihubmixVideoSeconds('sora-2', 10)).toBe('8');
  });

  it('snaps wan durations', () => {
    expect(aihubmixVideoSeconds('wan-2.1', 1)).toBe('5');
    expect(aihubmixVideoSeconds('wan-2.1', 20)).toBe('10');
  });

  it('picks the smaller value on an exact tie', () => {
    // veo allows 4,6,8 — 5 is equidistant from 4 and 6, expect 4 (first wins on tie).
    expect(aihubmixVideoSeconds('veo-3', 5)).toBe('4');
  });

  it('clamps unknown/seedance families to [3, 12]', () => {
    expect(aihubmixVideoSeconds('seedance-1', 1)).toBe('3');
    expect(aihubmixVideoSeconds('seedance-1', 20)).toBe('12');
    expect(aihubmixVideoSeconds('unknown-model', 7)).toBe('7');
  });

  it('defaults a non-finite requested duration to 5', () => {
    expect(aihubmixVideoSeconds('unknown-model', Number.NaN)).toBe('5');
  });

  it('is case-insensitive and tolerates an empty wire model', () => {
    expect(aihubmixVideoSeconds('VEO-3', 8)).toBe('8');
    expect(aihubmixVideoSeconds('', 5)).toBe('5');
  });
});

describe('aihubmixCatalogUrl', () => {
  it('builds the catalogue url from a valid base url origin', () => {
    expect(aihubmixCatalogUrl('https://aihubmix.com/v1', 'llm')).toBe(
      'https://aihubmix.com/api/v1/models?type=llm',
    );
  });

  it('falls back to the default origin when base url is empty or invalid', () => {
    expect(aihubmixCatalogUrl('', 'image_generation')).toBe(
      'https://aihubmix.com/api/v1/models?type=image_generation',
    );
    expect(aihubmixCatalogUrl('not a url', 'tts')).toBe('https://aihubmix.com/api/v1/models?type=tts');
  });
});

describe('parseAIHubMixCatalog', () => {
  it('returns an empty array when data.data is not an array', () => {
    expect(parseAIHubMixCatalog({})).toEqual([]);
    expect(parseAIHubMixCatalog(null)).toEqual([]);
  });

  it('parses model_id/model_name rows, de-duplicating by id', () => {
    const data = {
      data: [
        { model_id: 'gpt-4o', model_name: 'GPT-4o' },
        { model_id: 'gpt-4o', model_name: 'dup' },
        { model_id: '', model_name: 'skip-empty-id' },
        { model_id: 'no-name' },
        { model_name: 'no model_id field at all' },
      ],
    };
    expect(parseAIHubMixCatalog(data)).toEqual([
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'no-name', label: 'no-name' },
    ]);
  });

  it('drops media-generation rows when chatOnly is set', () => {
    const data = {
      data: [
        { model_id: 'gpt-4o', model_name: 'GPT-4o', types: 'llm' },
        { model_id: 'gpt-image-2', model_name: 'GPT Image 2', types: 'image_generation,llm' },
        { model_id: 'no-types-row', model_name: 'Kept (no metadata)' },
      ],
    };
    expect(parseAIHubMixCatalog(data, { chatOnly: true })).toEqual([
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'no-types-row', label: 'Kept (no metadata)' },
    ]);
  });

  it('keeps media rows when chatOnly is not set', () => {
    const data = { data: [{ model_id: 'gpt-image-2', model_name: 'x', types: 'image_generation' }] };
    expect(parseAIHubMixCatalog(data)).toEqual([{ id: 'gpt-image-2', label: 'x' }]);
  });

  it('tolerates a non-string types field', () => {
    const data = { data: [{ model_id: 'a', model_name: 'A', types: 42 }] };
    expect(parseAIHubMixCatalog(data, { chatOnly: true })).toEqual([{ id: 'a', label: 'A' }]);
  });
});

describe('AIHUBMIX_IMAGE_ASPECT_TO_SIZE', () => {
  it('has an entry for every documented aspect ratio', () => {
    expect(Object.keys(AIHUBMIX_IMAGE_ASPECT_TO_SIZE).sort()).toEqual(
      ['1:1', '16:9', '3:4', '4:3', '9:16'].sort(),
    );
  });
});
