// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, type IconName } from '../../components/Icon.js';

describe('Icon', () => {
  it('renders an svg with the requested size for a known name', () => {
    const { container } = render(<Icon name="check" size={20} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
  });

  it('applies the icon-spin class for the spinner icon', () => {
    const { container } = render(<Icon name="spinner" className="extra" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toBe('icon-spin extra');
  });

  it('defaults to a 14px stroke icon', () => {
    const { container } = render(<Icon name="close" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('14');
    expect(svg?.getAttribute('stroke-width')).toBe('1.6');
  });

  // Every case arm of the switch — the whole icon set must render an svg.
  const ALL_ICON_NAMES: IconName[] = [
    'alert-triangle', 'arrow-left', 'arrow-up', 'attach', 'bell', 'blocks', 'check',
    'chevron-down', 'chevron-left', 'chevron-right', 'close', 'copy', 'comment',
    'message-circle', 'discord', 'download', 'draw', 'edit', 'eye', 'eye-off',
    'external-link', 'log-out', 'file', 'file-code', 'folder', 'fork', 'folder-filled',
    'github', 'github-filled', 'grip-vertical', 'grid', 'globe', 'puzzle', 'hammer',
    'help-circle', 'history', 'home', 'home-filled', 'image', 'panel-left', 'slides',
    'import', 'info', 'kanban', 'layers-filled', 'languages', 'lightbulb', 'link',
    'lock', 'integrations-filled', 'mic', 'minus', 'more-horizontal', 'orbit',
    'paint-bucket', 'palette', 'palette-filled', 'pencil', 'layout', 'smartphone',
    'file-text', 'plus', 'plus-filled', 'play', 'present', 'refresh', 'reload',
    'search', 'send', 'settings', 'share', 'sliders', 'spinner', 'sparkles', 'star',
    'stop', 'swatchbook', 'sun', 'moon', 'sun-moon', 'terminal', 'thumbs-up',
    'thumbs-down', 'tweaks', 'upload', 'volume', 'maximize', 'minimize', 'zoom-in',
    'zoom-out', 'trash',
  ];

  it('renders an svg for every icon name', () => {
    for (const name of ALL_ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('renders nothing for an unhandled name', () => {
    const { container } = render(<Icon name={'not-a-real-icon' as IconName} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('honors an explicit strokeWidth', () => {
    const { container } = render(<Icon name="check" strokeWidth={3} />);
    expect(container.querySelector('svg')?.getAttribute('stroke-width')).toBe('3');
  });
});
