/** Character used to mask a `password`-kind field value in list/summary display. */
export const MASK_CHAR = '•';

/** How many trailing characters of a masked `password`-kind field stay visible (e.g. `••••••wxyz`) — same convention as showing a card's last 4 digits. */
export const MASKED_VALUE_VISIBLE_SUFFIX_LENGTH = 4;

/** Minimum number of mask characters rendered even for very short values, so a 1-character secret doesn't visually leak its own length. */
export const MASKED_VALUE_MIN_MASK_LENGTH = 6;
