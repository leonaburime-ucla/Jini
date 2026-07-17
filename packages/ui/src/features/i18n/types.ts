/**
 * Generic i18n type vocabulary.
 *
 * Origin (`i18n/types.ts` in the vendored OD web tree) hard-codes a single
 * `Locale` union of 19 language tags and a `Dict` interface with ~1,400
 * named keys — OD's actual translated product copy, not reusable content.
 * This module keeps only the *shape* of that pattern (a locale is a plain
 * string, a dictionary is a flat, string-keyed lookup) so a host supplies
 * its own locale union and its own dictionary type as a generic parameter.
 */

/** A BCP-47-ish locale tag (e.g. `'en'`, `'zh-CN'`). Any string a host defines. */
export type Locale = string;

/** Interpolation values substituted into a `{name}`-style placeholder. */
export type TranslationVars = Record<string, string | number>;

/**
 * Flat, string-keyed translation dictionary. Kept flat (not deeply nested)
 * for the same reason the origin's `Dict` was: a missing key surfaces as a
 * plain string-index miss instead of a structural type mismatch.
 *
 * A host narrows this via its own dictionary interface (mirroring OD's own
 * `Dict`) and passes `Record<Locale, ItsDict>` to {@link I18nProvider}.
 */
export interface TranslationDict {
  [key: string]: string;
}
