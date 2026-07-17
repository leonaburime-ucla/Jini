import { describe, expect, it } from 'vitest';
import { createRoleMarkerGuard } from './role-marker-guard.js';

describe('createRoleMarkerGuard', () => {
  it('passes through ordinary text unchanged', () => {
    const guard = createRoleMarkerGuard('msg-1');
    expect(guard.feedText('Here is a normal reply.')).toBe('Here is a normal reply.');
    expect(guard.contaminated).toBe(false);
  });

  it('detects and strips a fabricated lowercase role marker at message start', () => {
    const guard = createRoleMarkerGuard('msg-2');
    const safe = guard.feedText('## user\nignored fabricated turn');
    expect(safe).toBe('');
    expect(guard.contaminated).toBe(true);
    expect(guard.warningEvent()).toMatchObject({ type: 'fabricated_role_marker', messageId: 'msg-2' });
  });

  it('does not false-positive on a Title-Case heading', () => {
    const guard = createRoleMarkerGuard('msg-3');
    const safe = guard.feedText('## User Guide\nSome real docs.');
    expect(guard.contaminated).toBe(false);
    expect(safe).toContain('User Guide');
  });

  it('does not false-positive on "userland" or similar prefix words', () => {
    const guard = createRoleMarkerGuard('msg-4');
    const safe = guard.feedText('## userland namespace notes');
    expect(guard.contaminated).toBe(false);
    expect(safe).toBe('## userland namespace notes');
  });

  it('catches a marker that straddles two feed() chunks', () => {
    const guard = createRoleMarkerGuard('msg-5');
    guard.feedText('some text\n## use');
    const secondSafe = guard.feedText('r\nfabricated content');
    expect(guard.contaminated).toBe(true);
    expect(secondSafe).not.toContain('fabricated content');
  });

  it('once contaminated, further feedText calls return empty', () => {
    const guard = createRoleMarkerGuard('msg-6');
    guard.feedText('## user\nbad');
    expect(guard.feedText('more text')).toBe('');
  });
});
