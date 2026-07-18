import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRecurringSchedulePicker } from '../../../react/hooks/useRecurringSchedulePicker.js';
import type { UseRecurringSchedulePickerResult } from '../../../react/hooks/useRecurringSchedulePicker.js';
import type { ScheduleValue } from '../../../types.js';

describe('useRecurringSchedulePicker', () => {
  it('starts closed and toggles open/closed', () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const { result } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn() }));
    expect(result.current.open).toBe(false);

    act(() => result.current.toggleOpen());
    expect(result.current.open).toBe(true);

    act(() => result.current.toggleOpen());
    expect(result.current.open).toBe(false);
  });

  it('close() forces the popover shut', () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const { result } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn() }));
    act(() => result.current.toggleOpen());
    expect(result.current.open).toBe(true);
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });

  it('initializes editor state from the given value', () => {
    const value: ScheduleValue = { kind: 'weekly', weekday: 4, time: '14:30', timezone: 'Europe/Berlin' };
    const { result } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn() }));
    expect(result.current.state).toEqual({
      kind: 'weekly',
      minute: 0,
      time: '14:30',
      weekday: 4,
      timezone: 'Europe/Berlin',
    });
  });

  it('setKind/setMinute/setTime/setWeekday/setTimezone update the editor state', () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const { result } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn() }));

    act(() => result.current.setKind('weekly'));
    expect(result.current.state.kind).toBe('weekly');

    act(() => result.current.setMinute(75)); // clamped
    expect(result.current.state.minute).toBe(59);

    act(() => result.current.setTime('17:45'));
    expect(result.current.state.time).toBe('17:45');

    act(() => result.current.setWeekday(6));
    expect(result.current.state.weekday).toBe(6);

    act(() => result.current.setTimezone('Asia/Tokyo'));
    expect(result.current.state.timezone).toBe('Asia/Tokyo');
  });

  it('commit() builds a ScheduleValue from the current state, calls onChange, and closes', () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const onChange = vi.fn();
    const { result } = renderHook(() => useRecurringSchedulePicker({ value, onChange }));

    act(() => result.current.toggleOpen());
    act(() => result.current.setTime('11:00'));
    act(() => result.current.commit());

    expect(onChange).toHaveBeenCalledWith({ kind: 'daily', time: '11:00', timezone: 'UTC' });
    expect(result.current.open).toBe(false);
  });

  it('re-syncs the editor state from the latest value each time the popover re-opens', () => {
    const initial: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const { result, rerender } = renderHook<UseRecurringSchedulePickerResult, { value: ScheduleValue }>(
      (props) => useRecurringSchedulePicker({ value: props.value, onChange: vi.fn() }),
      { initialProps: { value: initial } },
    );

    act(() => result.current.setTime('12:00'));
    expect(result.current.state.time).toBe('12:00');

    act(() => result.current.toggleOpen()); // open
    act(() => result.current.toggleOpen()); // close, discarding the unsaved edit

    const next: ScheduleValue = { kind: 'weekly', weekday: 2, time: '08:00', timezone: 'Asia/Tokyo' };
    rerender({ value: next });

    act(() => result.current.toggleOpen()); // re-open should re-sync from `next`
    expect(result.current.state).toEqual({
      kind: 'weekly',
      minute: 0,
      time: '08:00',
      weekday: 2,
      timezone: 'Asia/Tokyo',
    });
  });

  it('uses a custom timezones list when supplied, and falls back to the runtime list otherwise', () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const custom = ['UTC', 'Pacific/Auckland'];
    const { result } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn(), timezones: custom }));
    expect(result.current.timezones).toEqual(custom);

    const { result: result2 } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn() }));
    expect(result2.current.timezones.length).toBeGreaterThan(0);
    expect(new Set(result2.current.timezones).size).toBe(result2.current.timezones.length);

    // An explicit empty array is treated the same as "no override supplied".
    const { result: result3 } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn(), timezones: [] }));
    expect(result3.current.timezones.length).toBeGreaterThan(0);
  });

  it('closes on Escape while open', () => {
    const value: ScheduleValue = { kind: 'daily', time: '09:00', timezone: 'UTC' };
    const { result } = renderHook(() => useRecurringSchedulePicker({ value, onChange: vi.fn() }));
    act(() => result.current.toggleOpen());
    expect(result.current.open).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(result.current.open).toBe(false);
  });
});
