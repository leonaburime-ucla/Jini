import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../../../../features/i18n/index.js';
import { createFakeMcpIntegrationsPort } from '../../dependencies.js';
import { IntegrationsTab } from './IntegrationsTab.js';

describe('IntegrationsTab', () => {
  it('loads install info and renders a snippet containing the given serverName', async () => {
    const port = createFakeMcpIntegrationsPort();
    render(<IntegrationsTab serverName="acme-mcp" port={port} />);
    await waitFor(() => expect(screen.getByText(/acme-mcp/)).toBeInTheDocument());
    expect(screen.queryByText('open-design')).not.toBeInTheDocument();
  });

  it('switching clients updates the snippet and instruction', async () => {
    const port = createFakeMcpIntegrationsPort();
    render(<IntegrationsTab serverName="acme-mcp" port={port} />);
    await waitFor(() => expect(screen.getByText('Run this command in your terminal.')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Claude Code/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Codex' }));
    await waitFor(() => expect(screen.getByText('Paste this into ~/.codex/config.toml.')).toBeInTheDocument());
  });

  it('shows the Codex one-click install control only for the Codex client', async () => {
    const port = createFakeMcpIntegrationsPort({ codexStatus: { available: true, installed: false } });
    render(<IntegrationsTab serverName="acme-mcp" port={port} />);
    await waitFor(() => expect(screen.getByText(/acme-mcp/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'One-click install' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Claude Code/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Codex' }));
    expect(await screen.findByRole('button', { name: 'One-click install' })).toBeInTheDocument();
  });

  it('shows a build-hint warning when the CLI or Node prerequisite is missing', async () => {
    const port = createFakeMcpIntegrationsPort({
      info: {
        command: 'node',
        args: [],
        daemonUrl: '',
        platform: 'darwin',
        cliExists: false,
        nodeExists: true,
        buildHint: 'Run `pnpm build` first.',
      },
    });
    render(<IntegrationsTab serverName="acme-mcp" port={port} />);
    expect(await screen.findByText('Run `pnpm build` first.')).toBeInTheDocument();
    expect(screen.getByText('Build the server first.')).toBeInTheDocument();
  });

  it('surfaces a daemon fetch error inline', async () => {
    const port = { fetchInstallInfo: () => Promise.reject(new Error('daemon unreachable')) };
    render(<IntegrationsTab serverName="acme-mcp" port={port} />);
    expect(await screen.findByText(/daemon unreachable/)).toBeInTheDocument();
  });

  it('renders translated copy when mounted under an I18nProvider with a matching dictionary', async () => {
    const port = createFakeMcpIntegrationsPort();
    render(
      <I18nProvider dictionaries={{ fr: { Copy: 'Copier' } }} initialLocale="fr">
        <IntegrationsTab serverName="acme-mcp" port={port} />
      </I18nProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Copier' })).toBeInTheDocument();
  });
});
