/**
 * Generic types for a "cron-lite" recurring-schedule value: hourly / daily /
 * weekdays / weekly, each carrying only the fields that kind actually needs.
 * Deliberately NOT the vendored `RoutineSchedule` contract type (r6 §1.19
 * flags that as the one OD-specific piece of the schedule editor) — this is
 * a standalone generic shape a host maps its own domain schedule onto.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleKind = 'hourly' | 'daily' | 'weekdays' | 'weekly';

export type ScheduleValue =
  | { kind: 'hourly'; minute: number }
  | { kind: 'daily'; time: string; timezone: string }
  | { kind: 'weekdays'; time: string; timezone: string }
  | { kind: 'weekly'; weekday: Weekday; time: string; timezone: string };

/** A schedule-kind tab: `label` is plain English, used directly as an
 *  `useT()` key by the caller (per this package's i18n convention). */
export interface ScheduleKindOption {
  kind: ScheduleKind;
  label: string;
}

/** A weekday option for the weekday grid: `short`/`long` are plain English,
 *  used directly as `useT()` keys by the caller. */
export interface WeekdayOption {
  value: Weekday;
  short: string;
  long: string;
}

/**
 * Editable working state for the schedule popover: unlike {@link ScheduleValue}
 * (a tagged union carrying only the active kind's fields), this carries every
 * field simultaneously so switching kind tabs doesn't lose whatever the user
 * already entered for another kind (matches the vendored `FormState`
 * schedule fields' behavior, minus everything else `FormState` carried).
 */
export interface ScheduleEditorState {
  kind: ScheduleKind;
  minute: number;
  time: string;
  weekday: Weekday;
  timezone: string;
}

/**
 * The decomposed, translation-ready pieces of a schedule summary. Produced
 * by the pure `decomposeSchedule` (no i18n) so both a plain-string
 * formatter and a structured-JSX renderer can share one source of truth;
 * every string field here is plain English, meant to be passed through
 * `useT()` at the call site (`rules.ts` stays hook-free by design).
 */
export type ScheduleSummaryParts =
  | { kind: 'hourly'; minute: string }
  | { kind: 'timed'; freq: string; time: string; tz: string };
