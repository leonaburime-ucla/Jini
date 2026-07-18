// Flat toggleable-chip field: every choice is visible at once and a
// selection takes one tap instead of opening a dropdown first — a
// single-select or multi-select variant sharing one component. Origin:
// `OnboardingChipField` in `EntryShell.tsx` (Open Design), verbatim
// structural port — label/options come entirely from props, so there was
// nothing product-specific to strip. See packages/ui/source-map.md.

export interface OnboardingChipFieldOption {
  value: string;
  label: string;
}

export type OnboardingChipFieldProps =
  | {
      label: string;
      options: OnboardingChipFieldOption[];
      value: string;
      onChange: (value: string) => void;
      multiple?: false;
      className?: string;
    }
  | {
      label: string;
      options: OnboardingChipFieldOption[];
      value: string[];
      onChange: (value: string[]) => void;
      multiple: true;
      className?: string;
    };

export function OnboardingChipField(props: OnboardingChipFieldProps) {
  const { label, options, className } = props;
  const selected = props.multiple ? props.value : props.value ? [props.value] : [];

  return (
    <div className={['onboarding-chip-field', className].filter(Boolean).join(' ')}>
      <span className="onboarding-chip-field__label">{label}</span>
      <div className="onboarding-chip-field__chips">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              type="button"
              key={option.value}
              className={`onboarding-chip${active ? ' is-selected' : ''}`}
              aria-pressed={active}
              onClick={() => {
                if (props.multiple) {
                  props.onChange(
                    active
                      ? props.value.filter((value) => value !== option.value)
                      : [...props.value, option.value],
                  );
                } else {
                  props.onChange(active ? '' : option.value);
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
