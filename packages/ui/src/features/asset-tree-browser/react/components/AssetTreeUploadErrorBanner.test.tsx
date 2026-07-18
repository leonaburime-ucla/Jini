// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeUploadErrorBanner } from './AssetTreeUploadErrorBanner.js';

describe('AssetTreeUploadErrorBanner', () => {
  it('shows the message', () => {
    render(<AssetTreeUploadErrorBanner message="Could not read one or more dropped files." />);
    expect(screen.getByText('Could not read one or more dropped files.')).toBeInTheDocument();
  });

  it('hides the dismiss button when onDismiss is omitted', () => {
    render(<AssetTreeUploadErrorBanner message="err" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('wires the dismiss button when onDismiss is supplied', async () => {
    const onDismiss = vi.fn();
    render(<AssetTreeUploadErrorBanner message="err" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByTestId('asset-tree-upload-error-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
