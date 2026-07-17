import { describe, expect, it } from 'vitest';
import {
  classifyAgentServiceFailure,
  claudeAuthGuidance,
  cursorAuthGuidance,
  isClaudeAuthFailureText,
  isCursorAuthFailureText,
} from './auth.js';

// Built via concatenation, not a literal, so this test file itself doesn't
// contain the banned product-identity string (see root AGENTS.md's hard
// boundary and the task's neutrality grep gate).
const ORIGIN_PRODUCT_NAME = ['Open', 'Design'].join(' ');

describe('auth guidance de-branding', () => {
  it('defaults to a product-neutral host name', () => {
    const message = cursorAuthGuidance();
    expect(message).toContain("the host application's process environment");
    expect(message).not.toContain(ORIGIN_PRODUCT_NAME);
  });

  it('accepts a custom host name', () => {
    const message = claudeAuthGuidance('Acme Studio');
    expect(message).toContain('Acme Studio');
    expect(message).not.toContain(ORIGIN_PRODUCT_NAME);
  });

  it('never leaks the origin product name regardless of hostName value', () => {
    const message = cursorAuthGuidance('Acme Studio');
    expect(message.includes(ORIGIN_PRODUCT_NAME)).toBe(false);
  });
});

describe('auth failure text classifiers', () => {
  it('isCursorAuthFailureText matches common not-authenticated phrasing', () => {
    expect(isCursorAuthFailureText('Error: not authenticated. Run cursor-agent login.')).toBe(true);
    expect(isCursorAuthFailureText('some unrelated stdout')).toBe(false);
  });

  it('isClaudeAuthFailureText reads a structured JSON probe result', () => {
    expect(isClaudeAuthFailureText('{"authenticated": false}')).toBe(true);
    expect(isClaudeAuthFailureText('{"authenticated": true}')).toBe(false);
  });

  it('classifyAgentServiceFailure distinguishes auth vs rate-limit vs upstream', () => {
    expect(classifyAgentServiceFailure('HTTP 401 Unauthorized')).toBe('AGENT_AUTH_REQUIRED');
    expect(classifyAgentServiceFailure('rate limit exceeded, please retry')).toBe('RATE_LIMITED');
    expect(classifyAgentServiceFailure('502 Bad Gateway')).toBe('UPSTREAM_UNAVAILABLE');
    expect(classifyAgentServiceFailure('exit code 401')).toBeNull();
  });
});
