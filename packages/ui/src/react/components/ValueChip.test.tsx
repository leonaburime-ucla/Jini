// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValueChip } from './ValueChip.js';

describe('ValueChip', () => {
  it('renders the label and value', () => {
    render(<ValueChip label="fontSize" value="14" />);
    expect(screen.getByText('fontSize')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
  });
});
