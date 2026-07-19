import { describe, expect, it } from 'vitest';
import {
  ACP_PROTOCOL_VERSION,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  DEFAULT_STAGE_TIMEOUT_MS,
  ACP_ARTIFACT_OPEN_PATTERN,
  ACP_GENERATED_FILE_PREFIX_PATTERN,
  ACP_ARTIFACT_ECHO_START_RE,
  ACP_RAW_EVENT_SHAPE_DIAGNOSTIC_LIMIT,
  AMR_STDERR_RETRY_TAIL_LIMIT,
  MODEL_CONFIG_OPTION_IDS,
} from '../constants.js';

describe('acp/constants', () => {
  it('exposes the expected protocol and timeout constants', () => {
    expect(ACP_PROTOCOL_VERSION).toBe(1);
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
    expect(MAX_TIMEOUT_MS).toBe(24 * 60 * 60 * 1000);
    expect(DEFAULT_STAGE_TIMEOUT_MS).toBe(10 * 60 * 1000);
    expect(ACP_RAW_EVENT_SHAPE_DIAGNOSTIC_LIMIT).toBe(8);
    expect(AMR_STDERR_RETRY_TAIL_LIMIT).toBe(16_000);
  });

  it('MODEL_CONFIG_OPTION_IDS contains the expected normalised tokens', () => {
    expect(MODEL_CONFIG_OPTION_IDS.has('model')).toBe(true);
    expect(MODEL_CONFIG_OPTION_IDS.has('models')).toBe(true);
    expect(MODEL_CONFIG_OPTION_IDS.has('modelid')).toBe(true);
    expect(MODEL_CONFIG_OPTION_IDS.has('modelids')).toBe(true);
    expect(MODEL_CONFIG_OPTION_IDS.has('bogus')).toBe(false);
  });

  it('ACP_ARTIFACT_ECHO_START_RE matches a plain artifact open tag at the start of text', () => {
    expect(ACP_ARTIFACT_ECHO_START_RE.test('<artifact>')).toBe(true);
    expect(ACP_ARTIFACT_ECHO_START_RE.test('<|DSML, artifact|>')).toBe(true);
  });

  it('ACP_ARTIFACT_ECHO_START_RE matches a generated-file preamble before the open tag', () => {
    expect(ACP_ARTIFACT_ECHO_START_RE.test("here is the generated file:\n<artifact>")).toBe(true);
    expect(ACP_ARTIFACT_ECHO_START_RE.test("here's the generated file: <artifact>")).toBe(true);
  });

  it('ACP_ARTIFACT_ECHO_START_RE does not match unrelated text', () => {
    expect(ACP_ARTIFACT_ECHO_START_RE.test('just some regular text')).toBe(false);
  });

  it('the open-pattern and generated-file-prefix fragments compile as valid regex source', () => {
    expect(() => new RegExp(ACP_ARTIFACT_OPEN_PATTERN)).not.toThrow();
    expect(() => new RegExp(ACP_GENERATED_FILE_PREFIX_PATTERN)).not.toThrow();
  });
});
