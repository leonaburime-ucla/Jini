export interface ValueChipProps {
  label: string;
  /** The raw value itself, rendered as the chip's glyph (e.g. `"14"`, `"0.5rem"`). */
  value: string;
}

/** A labeled non-color value chip — the `TokenChip` sibling for numeric/string tokens (font size, radius, spacing, …). */
export function ValueChip({ label, value }: ValueChipProps) {
  return (
    <span className="jini-token-chip jini-token-chip--value">
      <i className="jini-token-chip__swatch" aria-hidden="true">{value}</i>
      <span className="jini-token-chip__body">
        <strong className="jini-token-chip__label">{label}</strong>
      </span>
    </span>
  );
}
