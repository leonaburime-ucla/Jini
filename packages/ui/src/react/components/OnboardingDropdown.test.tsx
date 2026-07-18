import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../features/i18n/index.js';
import { OnboardingDropdown } from './OnboardingDropdown.js';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

function mockRect(rect: Partial<DOMRect>) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
    ...rect,
  } as DOMRect);
}

describe('OnboardingDropdown', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { value: 500, writable: true, configurable: true });
    mockRect({ top: 10, bottom: 30 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the label and placeholder as the trigger label when unselected', () => {
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={() => {}} />,
    );
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Choose a team');
    expect(screen.getByRole('button')).not.toHaveClass('has-value');
  });

  it('shows the selected option label and the has-value class', () => {
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="b" onChange={() => {}} />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Beta');
    expect(screen.getByRole('button')).toHaveClass('has-value');
  });

  it('joins multiple selected labels in multiple mode', () => {
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose teams"
        options={OPTIONS}
        value={['a', 'c']}
        onChange={() => {}}
        multiple
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Alpha, Gamma');
  });

  it('applies data-source-tone from the sourceTone prop', () => {
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose a team"
        options={OPTIONS}
        value=""
        onChange={() => {}}
        sourceTone="amr"
      />,
    );
    expect(screen.getByText('Team')).toHaveAttribute('data-source-tone', 'amr');
  });

  it('opens the menu on trigger click and lists every option', async () => {
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    for (const option of OPTIONS) {
      expect(screen.getByRole('option', { name: option.label })).toBeInTheDocument();
    }
  });

  it('single-select: picks an option, calls onChange, and closes the menu', async () => {
    const onChange = vi.fn();
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('multi-select: toggles a value on and stays open', async () => {
    const onChange = vi.fn();
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose teams"
        options={OPTIONS}
        value={['a']}
        onChange={onChange}
        multiple
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('multi-select: toggles a selected value off', async () => {
    const onChange = vi.fn();
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose teams"
        options={OPTIONS}
        value={['a', 'b']}
        onChange={onChange}
        multiple
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('marks the selected option with a checkmark icon and aria-selected', async () => {
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="b" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false');
  });

  it('closes on outside pointerdown', async () => {
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('searchable: filters options by query and resets the query when reopened', async () => {
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose a team"
        options={OPTIONS}
        value=""
        onChange={() => {}}
        searchable
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    const search = screen.getByRole('searchbox');
    await userEvent.type(search, 'gam');
    expect(screen.getByRole('option', { name: 'Gamma' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Alpha' })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('searchable: shows "No matches" when the query matches nothing', async () => {
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose a team"
        options={OPTIONS}
        value=""
        onChange={() => {}}
        searchable
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('non-searchable: shows "No options available" when there are no options', async () => {
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={[]} value="" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('No options available')).toBeInTheDocument();
  });

  it('uses a custom searchPlaceholder for the search input', async () => {
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose a team"
        options={OPTIONS}
        value=""
        onChange={() => {}}
        searchable
        searchPlaceholder="Search teams…"
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search teams…')).toBeInTheDocument();
  });

  it('flips to top placement when there is more room above than below', async () => {
    mockRect({ top: 400, bottom: 420 });
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Team').closest('[data-placement]')).toHaveAttribute('data-placement', 'top');
  });

  it('falls back to document.documentElement.clientHeight when window.innerHeight is falsy', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 0, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 500,
      configurable: true,
    });
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Team').closest('[data-placement]')).toHaveAttribute('data-placement', 'bottom');
  });

  it('falls back to a 720px viewport when neither innerHeight nor clientHeight are available', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 0, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, 'clientHeight', { value: 0, configurable: true });
    mockRect({ top: 400, bottom: 420 });
    render(
      <OnboardingDropdown label="Team" placeholder="Choose a team" options={OPTIONS} value="" onChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button'));
    // viewportHeight falls back to 720 → spaceBelow = 720-420 = 300 (>=260) → bottom.
    expect(screen.getByText('Team').closest('[data-placement]')).toHaveAttribute('data-placement', 'bottom');
  });

  it('honors an explicit top placement regardless of available space', async () => {
    render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose a team"
        options={OPTIONS}
        value=""
        onChange={() => {}}
        placement="top"
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Team').closest('[data-placement]')).toHaveAttribute('data-placement', 'top');
  });

  it('closes a peer dropdown when a second one opens', async () => {
    render(
      <>
        <OnboardingDropdown label="First" placeholder="Pick" options={OPTIONS} value="" onChange={() => {}} />
        <OnboardingDropdown label="Second" placeholder="Pick" options={OPTIONS} value="" onChange={() => {}} />
      </>,
    );
    const [first, second] = screen.getAllByRole('button');
    await userEvent.click(first!);
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    await userEvent.click(second!);
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
  });

  it('appends a caller-supplied className', () => {
    const { container } = render(
      <OnboardingDropdown
        label="Team"
        placeholder="Choose a team"
        options={OPTIONS}
        value=""
        onChange={() => {}}
        className="extra"
      />,
    );
    expect(container.firstChild).toHaveClass('onboarding-view__select-field');
    expect(container.firstChild).toHaveClass('extra');
  });

  it('renders translated empty-state copy when mounted under an I18nProvider', async () => {
    render(
      <I18nProvider dictionaries={{ fr: { 'No options available': 'Aucune option disponible' } }} initialLocale="fr">
        <OnboardingDropdown label="Team" placeholder="Choose a team" options={[]} value="" onChange={() => {}} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Aucune option disponible')).toBeInTheDocument();
  });
});
