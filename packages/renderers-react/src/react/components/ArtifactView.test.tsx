import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArtifactView } from './ArtifactView.js';
import { createDefaultRendererRegistry } from '../../renderers/index.js';
import { RendererRegistry } from '../../registry.js';
import { I18nProvider } from '../i18n.js';
import type { ArtifactFile } from '../../types.js';
import { createFakeAnnotationCanvasPort } from '../../annotation-canvas/index.js';

const registry = createDefaultRendererRegistry();

describe('ArtifactView', () => {
  it('shows a fallback message when no renderer resolves', () => {
    const file: ArtifactFile = { name: 'data.bin', kind: 'binary', content: '' };
    render(<ArtifactView file={file} registry={registry} />);
    expect(screen.getByRole('status')).toHaveTextContent('No renderer is registered for this artifact.');
  });

  it('renders markdown artifacts inline via renderMarkdownToSafeHtml', () => {
    const file: ArtifactFile = { name: 'notes.md', kind: 'text', content: '# Hello' };
    const { container } = render(<ArtifactView file={file} registry={registry} />);
    expect(container.querySelector('h1')).toHaveTextContent('Hello');
  });

  it('renders html artifacts through the sandboxed iframe', () => {
    const file: ArtifactFile = { name: 'index.html', kind: 'html', content: '<p>hi</p>' };
    render(<ArtifactView file={file} registry={registry} />);
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.srcdoc).toContain('<p>hi</p>');
  });

  it('shows a fallback for a renderer id with no built-in and no slot', () => {
    const file: ArtifactFile = {
      name: 'Widget.tsx',
      kind: 'text',
      content: '',
      manifest: {
        version: 1,
        kind: 'react-component',
        title: 'Widget',
        entry: 'Widget.tsx',
        renderer: 'react-component',
        exports: [],
      },
    };
    render(<ArtifactView file={file} registry={registry} />);
    expect(screen.getByRole('status')).toHaveTextContent('No renderer registered for "react-component"');
  });

  it('prefers a host-supplied slot over built-in rendering', () => {
    const file: ArtifactFile = { name: 'index.html', kind: 'html', content: '<p>hi</p>' };
    render(
      <ArtifactView
        file={file}
        registry={registry}
        slots={{ renderers: { html: ({ file: f }) => <div data-testid="slot">{f.name}</div> } }}
      />,
    );
    expect(screen.getByTestId('slot')).toHaveTextContent('index.html');
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('translates the fallback message when an I18nProvider dictionary is mounted', () => {
    const file: ArtifactFile = { name: 'data.bin', kind: 'binary', content: '' };
    render(
      <I18nProvider dictionary={{ 'No renderer is registered for this artifact.': 'Aucun moteur de rendu enregistré.' }}>
        <ArtifactView file={file} registry={registry} />
      </I18nProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Aucun moteur de rendu enregistré.');
  });

  it('wraps the resolved rendering in an AnnotationCanvas overlay when `annotation` is supplied — the renderer-registry integration point, not a standalone bolt-on', () => {
    const file: ArtifactFile = { name: 'index.html', kind: 'html', content: '<p>hi</p>' };
    render(
      <ArtifactView
        file={file}
        registry={registry}
        annotation={{ active: true, port: createFakeAnnotationCanvasPort() }}
      />,
    );
    expect(screen.getByRole('toolbar', { name: 'Annotation tools' })).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeInTheDocument();
  });

  it('wraps even the fallback message in the annotation overlay', () => {
    const file: ArtifactFile = { name: 'data.bin', kind: 'binary', content: '' };
    render(
      <ArtifactView
        file={file}
        registry={registry}
        annotation={{ active: true, port: createFakeAnnotationCanvasPort() }}
      />,
    );
    expect(screen.getByRole('toolbar', { name: 'Annotation tools' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No renderer is registered for this artifact.');
  });

  it('renders without any annotation overlay when `annotation` is omitted', () => {
    const file: ArtifactFile = { name: 'index.html', kind: 'html', content: '<p>hi</p>' };
    render(<ArtifactView file={file} registry={registry} />);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('treats a missing `content` as an empty document for the sandboxed html/svg renderer', () => {
    const file: ArtifactFile = { name: 'index.html', kind: 'html' };
    render(<ArtifactView file={file} registry={registry} />);
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    // The bare shell is still produced (doctype/body), just with no injected fragment.
    expect(iframe.srcdoc).toContain('<!doctype html>');
    expect(iframe.srcdoc).not.toContain('undefined');
  });

  it('treats a missing `content` as empty markdown rather than rendering the literal string "undefined"', () => {
    const file: ArtifactFile = { name: 'notes.md', kind: 'text' };
    const { container } = render(<ArtifactView file={file} registry={registry} />);
    expect(container.textContent).not.toContain('undefined');
  });

  it('falls back to the built-in safe-markdown converter when the resolved renderer declares id "markdown" but supplies no renderPartial of its own', () => {
    // A host can register its own renderer under the "markdown" id (e.g. to
    // change canRender/supportsStreaming) without also supplying a
    // renderPartial — ArtifactView must still safely convert the content
    // itself rather than passing raw markdown through unconverted.
    const customRegistry = registry.register({
      id: 'markdown',
      supportsStreaming: false,
      canRender: ({ file }) => file.name.endsWith('.md'),
    });
    const file: ArtifactFile = { name: 'notes.md', kind: 'text', content: '# Fallback works' };
    const { container } = render(<ArtifactView file={file} registry={customRegistry} />);
    expect(container.querySelector('h1')).toHaveTextContent('Fallback works');
  });
});
