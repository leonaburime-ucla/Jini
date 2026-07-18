import { useT } from '../../../i18n/index.js';
import { issueForField } from '../../rules.js';
import { SourceConfigField } from './SourceConfigField.js';
import type { SourceDraftValidation, SourceFieldSpec, SourceFieldValues, SourceTrustOption } from '../../types.js';

export interface SourceConfigAddFormProps {
  fieldSpecs: readonly SourceFieldSpec[];
  trustOptions?: readonly SourceTrustOption[];
  values: SourceFieldValues;
  trust?: string | undefined;
  validation: SourceDraftValidation;
  submitAttempted: boolean;
  submitting: boolean;
  submitError?: string | null | undefined;
  addLabel?: string;
  onFieldChange: (key: string, value: string) => void;
  onTrustChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * The "add a source" form: one `SourceConfigField` per host-supplied field
 * spec, an optional trust selector (rendered only when `trustOptions` is
 * given — the origin MCP-server shape has no trust concept at all), and a
 * submit button. Dumb/presentational — the draft state lives in
 * `useSourceConfigAddForm`. Field errors only render once a submit has been
 * attempted, matching the origin sources' "don't yell at the user before
 * they've tried to submit" UX.
 */
export function SourceConfigAddForm({
  fieldSpecs,
  trustOptions,
  values,
  trust,
  validation,
  submitAttempted,
  submitting,
  submitError,
  addLabel,
  onFieldChange,
  onTrustChange,
  onSubmit,
}: SourceConfigAddFormProps) {
  const t = useT();
  const hasTrustOptions = Boolean(trustOptions && trustOptions.length > 0);

  return (
    <form
      className="source-config-add-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {fieldSpecs.map((spec) => {
        const issue = submitAttempted ? issueForField(validation, spec.key) : undefined;
        return (
          <SourceConfigField
            key={spec.key}
            spec={spec}
            value={values[spec.key] ?? ''}
            disabled={submitting}
            onChange={(value) => onFieldChange(spec.key, value)}
            {...(issue ? { error: issue.message } : {})}
          />
        );
      })}
      {hasTrustOptions ? (
        <label className="source-config-field" htmlFor="source-config-add-form-trust">
          <span className="source-config-field-label">{t('Trust level')}</span>
          <select
            id="source-config-add-form-trust"
            value={trust ?? ''}
            disabled={submitting}
            aria-label={t('Trust level')}
            onChange={(event) => onTrustChange(event.target.value)}
          >
            {(trustOptions ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {submitError ? (
        <div className="source-config-add-form-error" role="alert">
          {submitError}
        </div>
      ) : null}
      <button type="submit" className="source-config-add-form-submit" disabled={submitting}>
        {submitting ? t('Adding…') : (addLabel ?? t('Add source'))}
      </button>
    </form>
  );
}
