import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSketchEditorEngine } from '../../../react/dependencies-fake.js';
import { SketchMainMenu } from '../../../react/components/SketchMainMenu.js';

const t = (key: string) => key;
const engine = createFakeSketchEditorEngine();

function baseProps(overrides: Partial<Parameters<typeof SketchMainMenu>[0]> = {}) {
  return {
    MainMenu: engine.MainMenu,
    t,
    saving: false,
    showSaved: false,
    canSave: true,
    onSave: vi.fn(),
    exportAvailable: true,
    exporting: false,
    canExport: true,
    onExportImage: vi.fn(),
    canClear: true,
    onClear: vi.fn(),
    ...overrides,
  };
}

function button(testId: string): HTMLButtonElement {
  return screen.getByTestId(testId) as HTMLButtonElement;
}

describe('SketchMainMenu', () => {
  it('renders Save/Export image/Clear canvas items', () => {
    render(<SketchMainMenu {...baseProps()} />);
    expect(button('sketch-menu-save').textContent).toContain('Save');
    expect(button('sketch-menu-export-image').textContent).toContain('Export image');
    expect(button('sketch-menu-clear').textContent).toContain('Clear canvas');
  });

  it('omits the export item entirely when the host provided no onExportImage', () => {
    render(<SketchMainMenu {...baseProps({ exportAvailable: false })} />);
    expect(screen.queryByTestId('sketch-menu-export-image')).toBeNull();
  });

  it('shows "Saving…" and disables Save while saving', () => {
    render(<SketchMainMenu {...baseProps({ saving: true })} />);
    const item = button('sketch-menu-save');
    expect(item.textContent).toContain('Saving…');
    expect(item.disabled).toBe(true);
  });

  it('shows "Saved" when showSaved is true and not saving', () => {
    render(<SketchMainMenu {...baseProps({ showSaved: true })} />);
    expect(button('sketch-menu-save').textContent).toContain('Saved');
  });

  it('disables Save when canSave is false', () => {
    render(<SketchMainMenu {...baseProps({ canSave: false })} />);
    expect(button('sketch-menu-save').disabled).toBe(true);
  });

  it('calls onSave when Save is clicked', async () => {
    const onSave = vi.fn();
    render(<SketchMainMenu {...baseProps({ onSave })} />);
    await userEvent.click(button('sketch-menu-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables Export image while exporting or when canExport is false', () => {
    const { rerender } = render(<SketchMainMenu {...baseProps({ exporting: true })} />);
    expect(button('sketch-menu-export-image').disabled).toBe(true);
    expect(button('sketch-menu-export-image').textContent).toContain('Exporting image…');

    rerender(<SketchMainMenu {...baseProps({ canExport: false })} />);
    expect(button('sketch-menu-export-image').disabled).toBe(true);
  });

  it('calls onExportImage when Export image is clicked', async () => {
    const onExportImage = vi.fn();
    render(<SketchMainMenu {...baseProps({ onExportImage })} />);
    await userEvent.click(button('sketch-menu-export-image'));
    expect(onExportImage).toHaveBeenCalledTimes(1);
  });

  it('disables Clear canvas when canClear is false, and calls onClear when enabled', async () => {
    const onClear = vi.fn();
    const { rerender } = render(<SketchMainMenu {...baseProps({ canClear: false, onClear })} />);
    expect(button('sketch-menu-clear').disabled).toBe(true);

    rerender(<SketchMainMenu {...baseProps({ canClear: true, onClear })} />);
    await userEvent.click(button('sketch-menu-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
