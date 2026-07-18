// Smoke test for the feature's public barrel: proves every advertised export
// actually resolves through `index.js` (not just through each source file
// directly, which every other test in this directory exercises).
import { describe, expect, it } from 'vitest';
import * as SchedulePickerFeature from './index.js';

describe('schedule-picker index barrel', () => {
  it('re-exports the constants, rules, hook, and components it advertises', () => {
    const runtimeExports = [
      'DEFAULT_SCHEDULE_KINDS',
      'DEFAULT_WEEKDAYS',
      'DEFAULT_SCHEDULE_TIME',
      'DEFAULT_SCHEDULE_WEEKDAY',
      'DEFAULT_SCHEDULE_MINUTE',
      'clampMinute',
      'formatTime12h',
      'decomposeSchedule',
      'describeScheduleSummary',
      'defaultScheduleEditorState',
      'scheduleEditorStateFromValue',
      'buildScheduleValue',
      'showsWeekdayGrid',
      'showsTimeFields',
      'useRecurringSchedulePicker',
      'ScheduleKindTabs',
      'WeekdayGrid',
      'ScheduleFields',
      'ScheduleSummary',
      'translatedScheduleSummaryLabel',
      'RecurringSchedulePicker',
    ] as const;

    for (const name of runtimeExports) {
      expect(SchedulePickerFeature[name], `expected index.js to export ${name}`).toBeDefined();
    }
  });
});
