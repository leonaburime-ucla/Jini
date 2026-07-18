import type { ScheduleKindOption, WeekdayOption } from './types.js';

/** Default schedule-kind tabs, in display order. A host may supply its own
 *  subset/order/labels instead — this is just the default for a drop-in
 *  `RecurringSchedulePicker`. */
export const DEFAULT_SCHEDULE_KINDS: ScheduleKindOption[] = [
  { kind: 'hourly', label: 'Hourly' },
  { kind: 'daily', label: 'Daily' },
  { kind: 'weekdays', label: 'Weekdays' },
  { kind: 'weekly', label: 'Weekly' },
];

/** Default weekday grid, Sunday-first (index 0 = Sunday), matching the
 *  `Weekday` numbering convention. */
export const DEFAULT_WEEKDAYS: WeekdayOption[] = [
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
];

export const DEFAULT_SCHEDULE_TIME = '09:00';
export const DEFAULT_SCHEDULE_WEEKDAY: WeekdayOption['value'] = 1;
export const DEFAULT_SCHEDULE_MINUTE = 0;
