import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { createFakeSourceConfigDependencies } from '../../dependencies.js';
import { SourceConfigList } from './SourceConfigList.js';
import type { SourceConfigItem, SourceFieldSpec, SourceTrustOption } from '../../types.js';

/**
 * Proof that the generic `SourceConfigList<TSource>` primitive really holds
 * across the two most different origin shapes it consolidates: an
 * MCP-server-shaped source (a `url` field + a trust level, no secret) and a
 * BYOK-key-shaped source (an `apiKey` field, no trust concept at all) — same
 * component, different injected `dependencies`/`fieldSpecs`/`trustOptions`.
 */

interface McpServerSource extends SourceConfigItem {
  fields: { url: string };
}

const MCP_FIELD_SPECS: SourceFieldSpec[] = [{ key: 'url', label: 'URL', kind: 'url', required: true }];
const MCP_TRUST_OPTIONS: SourceTrustOption[] = [
  { value: 'restricted', label: 'Restricted' },
  { value: 'trusted', label: 'Trusted' },
];

function mcpDependencies(seed: McpServerSource[] = []) {
  return createFakeSourceConfigDependencies<McpServerSource>({
    sources: seed,
    createSource: (input) => ({
      id: `mcp-${Object.keys(input.fields).length}-${input.fields.url}`,
      fields: { url: input.fields.url ?? '' },
      ...(input.trust !== undefined ? { trust: input.trust } : {}),
    }),
    supportsTrust: true,
    supportsRefresh: true,
    supportsTest: false,
  });
}

interface ByokKeySource extends SourceConfigItem {
  fields: { apiKey: string; model: string };
}

const BYOK_FIELD_SPECS: SourceFieldSpec[] = [
  { key: 'apiKey', label: 'API Key', kind: 'password', required: true },
  { key: 'model', label: 'Model', kind: 'text', required: true },
];

function byokDependencies(seed: ByokKeySource[] = []) {
  let nextId = 0;
  return createFakeSourceConfigDependencies<ByokKeySource>({
    sources: seed,
    createSource: (input) => ({
      id: `byok-${nextId++}`,
      fields: { apiKey: input.fields.apiKey ?? '', model: input.fields.model ?? '' },
    }),
    supportsTrust: false,
    supportsRefresh: false,
    supportsTest: true,
    onTest: () => ({ ok: true, message: 'Connected in 12ms.' }),
  });
}

describe('SourceConfigList — MCP-server-shaped source', () => {
  it('loads existing sources and renders trust badges', async () => {
    const dependencies = mcpDependencies([{ id: 'a', fields: { url: 'https://mcp.example/a' }, trust: 'trusted' }]);
    render(
      <SourceConfigList<McpServerSource>
        dependencies={dependencies}
        fieldSpecs={MCP_FIELD_SPECS}
        trustOptions={MCP_TRUST_OPTIONS}
      />,
    );
    expect(await screen.findByText('https://mcp.example/a')).toBeInTheDocument();
    const card = screen.getByTestId('source-config-item-card');
    expect(card.querySelector('.source-config-item-card-trust-badge')?.textContent).toBe('Trusted');
  });

  it('adds a new MCP-shaped source with a trust level through the generic add form', async () => {
    const dependencies = mcpDependencies();
    render(
      <SourceConfigList<McpServerSource>
        dependencies={dependencies}
        fieldSpecs={MCP_FIELD_SPECS}
        trustOptions={MCP_TRUST_OPTIONS}
      />,
    );
    await waitFor(() => expect(screen.getByText('No sources configured yet.')).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText('URL', { exact: false }), 'https://mcp.example/new');
    await userEvent.selectOptions(screen.getByLabelText('Trust level'), 'trusted');
    await userEvent.click(screen.getByRole('button', { name: 'Add source' }));

    expect(await screen.findByText('https://mcp.example/new')).toBeInTheDocument();
    const card = screen.getByTestId('source-config-item-card');
    expect(card.querySelector('.source-config-item-card-trust-badge')?.textContent).toBe('Trusted');
    expect((await dependencies.port.fetchSources())).toHaveLength(1);
  });

  it('changes an existing item\'s trust level through its own per-item select', async () => {
    const dependencies = mcpDependencies([{ id: 'a', fields: { url: 'https://mcp.example/a' }, trust: 'restricted' }]);
    render(
      <SourceConfigList<McpServerSource>
        dependencies={dependencies}
        fieldSpecs={MCP_FIELD_SPECS}
        trustOptions={MCP_TRUST_OPTIONS}
      />,
    );
    await screen.findByText('https://mcp.example/a');
    const card = screen.getByTestId('source-config-item-card');
    await userEvent.selectOptions(within(card).getByRole('combobox', { name: /Trust level for/ }), 'trusted');
    await waitFor(() =>
      expect(card.querySelector('.source-config-item-card-trust-badge')?.textContent).toBe('Trusted'),
    );
    const persisted = await dependencies.port.fetchSources();
    expect(persisted[0]?.trust).toBe('trusted');
  });

  it('refreshes and removes an item, and never renders a test control (this shape has no test capability)', async () => {
    const dependencies = mcpDependencies([{ id: 'a', fields: { url: 'https://mcp.example/a' } }]);
    render(<SourceConfigList<McpServerSource> dependencies={dependencies} fieldSpecs={MCP_FIELD_SPECS} />);
    await screen.findByText('https://mcp.example/a');

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).not.toBeDisabled());

    await userEvent.click(screen.getByRole('button', { name: 'https://mcp.example/a' }));
    expect(screen.queryByRole('button', { name: 'Test' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('https://mcp.example/a')).toBeNull());
    expect(screen.getByText('No sources configured yet.')).toBeInTheDocument();
  });
});

describe('SourceConfigList — BYOK-key-shaped source (same component, different fields/adapter)', () => {
  it('adds a new API-key-shaped source, masks the key, and never renders a trust control', async () => {
    const dependencies = byokDependencies();
    render(<SourceConfigList<ByokKeySource> dependencies={dependencies} fieldSpecs={BYOK_FIELD_SPECS} />);
    await waitFor(() => expect(screen.getByText('No sources configured yet.')).toBeInTheDocument());

    expect(screen.queryByLabelText('Trust level')).toBeNull();

    await userEvent.type(screen.getByLabelText('API Key', { exact: false }), 'sk-ant-1234567890wxyz');
    await userEvent.type(screen.getByLabelText('Model', { exact: false }), 'claude-sonnet-4-5');
    await userEvent.click(screen.getByRole('button', { name: 'Add source' }));

    // No explicit `label`, so the summary shows the masked first field (apiKey).
    const card = await screen.findByTestId('source-config-item-card');
    expect(within(card).queryByText('sk-ant-1234567890wxyz')).toBeNull();
    expect(within(card).getByText(/wxyz$/)).toBeInTheDocument();
    expect(within(card).queryByRole('combobox')).toBeNull();
  });

  it('runs a per-item connection test using the injected byok-shaped test adapter', async () => {
    const dependencies = byokDependencies([{ id: 'k1', fields: { apiKey: 'sk-ant-1', model: 'claude-sonnet-4-5' } }]);
    render(<SourceConfigList<ByokKeySource> dependencies={dependencies} fieldSpecs={BYOK_FIELD_SPECS} />);
    const card = await screen.findByTestId('source-config-item-card');
    await userEvent.click(within(card).getByRole('button', { name: /wxyz$|1$/ }));
    await userEvent.click(within(card).getByRole('button', { name: 'Test' }));
    expect(await within(card).findByRole('status')).toHaveTextContent('Connected in 12ms.');
    // No refresh capability for this shape.
    expect(within(card).queryByRole('button', { name: /Refresh/ })).toBeNull();
  });
});

describe('SourceConfigList — i18n wiring', () => {
  it('renders translated copy when mounted under an I18nProvider with a matching dictionary', async () => {
    const dependencies = mcpDependencies();
    render(
      <I18nProvider
        dictionaries={{
          fr: {
            'Add source': 'Ajouter une source',
            'No sources configured yet.': 'Aucune source configurée.',
            URL: 'URL',
          },
        }}
        initialLocale="fr"
      >
        <SourceConfigList<McpServerSource> dependencies={dependencies} fieldSpecs={MCP_FIELD_SPECS} />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText('Aucune source configurée.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Ajouter une source' })).toBeInTheDocument();
  });

  /**
   * Regression for the audit finding that the original i18n smoke test's
   * identity `URL -> URL` dictionary entry, and its lack of an invalid
   * submission, could never detect a hardcoded/unwrapped validation message:
   * `rules.ts`'s `validateSourceDraft` used to build a pre-baked English
   * sentence (`` `${spec.label} is required.` ``) that rendered straight
   * through `SourceConfigField`'s `error` prop with no `t()` wrapping
   * anywhere in the chain. This submits the form empty (a real invalid
   * submission) under a dictionary that translates BOTH the field label and
   * the now-templated validation message, and asserts the fully-translated
   * sentence renders — not just the field label alone.
   */
  it('translates a real validation error (not just passthrough copy) on an invalid submission', async () => {
    const dependencies = mcpDependencies();
    render(
      <I18nProvider
        dictionaries={{
          fr: {
            URL: 'Adresse URL',
            '{label} is required.': '{label} est requis.',
          },
        }}
        initialLocale="fr"
      >
        <SourceConfigList<McpServerSource> dependencies={dependencies} fieldSpecs={MCP_FIELD_SPECS} />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText('Adresse URL', { exact: false })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Add source' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Adresse URL est requis.');
  });

  /** Regression for host-supplied field placeholders/select-option labels rendering raw. */
  it('translates host-supplied field placeholder and select option labels under a matching dictionary', async () => {
    interface ProtocolSource extends SourceConfigItem {
      fields: { protocol: string };
    }
    const fieldSpecs: SourceFieldSpec[] = [
      {
        key: 'protocol',
        label: 'Protocol',
        kind: 'select',
        placeholder: 'Choose a protocol',
        options: [{ value: 'anthropic', label: 'Anthropic' }],
      },
    ];
    const dependencies = createFakeSourceConfigDependencies<ProtocolSource>({
      createSource: (input) => ({ id: 'p1', fields: { protocol: input.fields.protocol ?? '' } }),
    });
    render(
      <I18nProvider dictionaries={{ fr: { Protocol: 'Protocole', Anthropic: 'Anthropique' } }} initialLocale="fr">
        <SourceConfigList<ProtocolSource> dependencies={dependencies} fieldSpecs={fieldSpecs} />
      </I18nProvider>,
    );
    expect(await screen.findByLabelText('Protocole', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Anthropique' })).toBeInTheDocument();
  });
});

describe('SourceConfigList — title/subtitle/emptyMessage/addLabel passthrough', () => {
  it('forwards optional presentational props to the view', async () => {
    const dependencies = mcpDependencies();
    render(
      <SourceConfigList<McpServerSource>
        dependencies={dependencies}
        fieldSpecs={MCP_FIELD_SPECS}
        title="MCP servers"
        subtitle="Connect external tools."
        emptyMessage="No servers yet."
        addLabel="Add server"
      />,
    );
    expect(screen.getByRole('heading', { name: 'MCP servers' })).toBeInTheDocument();
    expect(screen.getByText('Connect external tools.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('No servers yet.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add server' })).toBeInTheDocument();
  });
});
