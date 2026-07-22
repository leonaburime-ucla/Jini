export interface TokenChipProps {
  label: string;
  /** A `#rrggbb`-shaped (or similar) CSS color value, swatched via a small filled square. */
  hex: string;
}

/** A labeled color-swatch chip: a filled square + the token's name and raw value. */
export function TokenChip({ label, hex }: TokenChipProps) {
  return (
    <span className="jini-token-chip">
      <i className="jini-token-chip__swatch" style={{ background: hex }} aria-hidden="true" />
      <span className="jini-token-chip__body">
        <strong className="jini-token-chip__label">{label}</strong>
        <small className="jini-token-chip__value">{hex}</small>
      </span>
    </span>
  );
}
