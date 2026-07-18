import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorAlertList } from '../../components/ConnectorAlertList.js';

describe('ConnectorAlertList', () => {
  it('renders nothing when there are no alerts', () => {
    const { container } = render(<ConnectorAlertList alerts={[]} onOpenDetails={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders each alert and opens details for the clicked one', async () => {
    const onOpenDetails = vi.fn();
    render(
      <ConnectorAlertList
        alerts={[{ connectorId: 'a', connectorName: 'A', message: 'boom' }]}
        onOpenDetails={onOpenDetails}
      />,
    );
    expect(screen.getByText('boom')).toBeTruthy();
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenDetails).toHaveBeenCalledWith('a');
  });
});
