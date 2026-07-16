import { describe, expect, it } from 'vitest';
import {
  createArtifactParser,
  createHtmlArtifactManifest,
  inferLegacyManifest,
  matchPersistedArtifactFile,
  parseArtifactManifest,
  parseArtifacts,
  recoverHtmlDocumentFromMarkdownFence,
  recoverStandaloneHtmlDocument,
  resolveHtmlPointerArtifactTarget,
  serializeArtifactManifest,
  splitStreamingArtifact,
  stripArtifact,
  summarizeArtifactsForTranscript,
  validateHtmlArtifact,
  type ArtifactEvent,
} from './artifacts/index.js';

const HTML_DOC = '<!doctype html><html><head></head><body><h1>Hello there, world</h1></body></html>';

describe('artifacts/parser', () => {
  it('parses a complete artifact block via the one-shot parseArtifacts() convenience wrapper', () => {
    const content = `intro text <artifact identifier="a" type="text/html" title="Demo">${HTML_DOC}</artifact> outro`;
    const events = parseArtifacts(content);
    expect(events[0]).toEqual({ type: 'text', delta: 'intro text ' });
    expect(events[1]).toMatchObject({ type: 'artifact:start', identifier: 'a', artifactType: 'text/html', title: 'Demo' });
    const chunkEvents = events.filter((e): e is Extract<ArtifactEvent, { type: 'artifact:chunk' }> => e.type === 'artifact:chunk');
    expect(chunkEvents.map((e) => e.delta).join('')).toBe(HTML_DOC);
    expect(events.at(-2)).toMatchObject({ type: 'artifact:end', identifier: 'a', fullContent: HTML_DOC });
    expect(events.at(-1)).toEqual({ type: 'text', delta: ' outro' });
  });

  it('reassembles identically whether fed in one chunk or split byte-by-byte across the open tag', () => {
    const content = `<artifact identifier="x" type="text/html" title="T">${HTML_DOC}</artifact>`;
    const whole = parseArtifacts(content);

    const parser = createArtifactParser();
    const streamed: ArtifactEvent[] = [];
    for (const char of content) {
      streamed.push(...parser.feed(char));
    }
    streamed.push(...parser.flush());

    const wholeFull = whole.find((e) => e.type === 'artifact:end');
    const streamedFull = streamed.find((e) => e.type === 'artifact:end');
    expect(streamedFull).toEqual(wholeFull);
  });

  it('does not treat a literal "<artifact ...>" recited inside a fenced code block as a real tag', () => {
    const content = ['Here is the protocol:', '```', '<artifact identifier="demo" type="text/html" title="Demo">...</artifact>', '```', 'end of explanation'].join('\n');
    const events = parseArtifacts(content);
    expect(events.every((e) => e.type === 'text')).toBe(true);
    expect(events.map((e) => (e as { delta: string }).delta).join('')).toBe(content);
  });

  it('holds back an unresolved "<art" prefix at the tail instead of misreading it as plain text', () => {
    const parser = createArtifactParser();
    const first = [...parser.feed('hello <art')];
    // Nothing should flush past the ambiguous prefix yet.
    expect(first).toEqual([{ type: 'text', delta: 'hello ' }]);
    const second = [...parser.feed('ifact identifier="a" type="text/html" title="t">body</artifact>')];
    expect(second[0]).toMatchObject({ type: 'artifact:start', identifier: 'a' });
  });
});

describe('artifacts/strip', () => {
  it('removes a real artifact block and trims the surrounding whitespace', () => {
    const content = `before\n<artifact identifier="a" type="text/html" title="T">${HTML_DOC}</artifact>\nafter`;
    const stripped = stripArtifact(content);
    expect(stripped).not.toContain('<artifact');
    expect(stripped).toBe('before\n\nafter');
  });

  it('leaves a literal "<artifact>" recited in a fenced code block untouched', () => {
    const content = ['explaining the protocol:', '```', '<artifact identifier="a" type="text/html" title="t">body</artifact>', '```'].join('\n');
    expect(stripArtifact(content)).toBe(content);
  });

  it('refuses to strip a malformed block with a real open tag but no real close tag (fail-closed)', () => {
    const content = `text <artifact identifier="a" type="text/html" title="t">unterminated body`;
    expect(stripArtifact(content)).toBe(content);
  });

  it('summarizes only artifacts confirmed persisted, leaving unconfirmed ones verbatim (aggregate: mixed batch)', () => {
    const content = [
      '<artifact identifier="saved-one" type="text/html" title="Saved">' + HTML_DOC + '</artifact>',
      'and also',
      '<artifact identifier="unsaved-one" type="text/html" title="Unsaved">' + HTML_DOC + '</artifact>',
    ].join('\n');
    const result = summarizeArtifactsForTranscript(content, [{ name: 'saved.html', identifier: 'saved-one' }]);
    expect(result).toContain('saved.html');
    expect(result).not.toContain('<artifact identifier="saved-one"'); // the confirmed block's body was replaced with a summary
    expect(result).toContain('<artifact identifier="unsaved-one"'); // the unconfirmed block survives verbatim, tag and all
  });

  it('splitStreamingArtifact surfaces an in-flight block and hides its raw open tag from the Markdown head', () => {
    const content = `Building your page now.\n<artifact identifier="live" type="text/html" title="Live">${HTML_DOC.slice(0, 20)}`;
    const { head, live } = splitStreamingArtifact(content);
    expect(head).toBe('Building your page now.');
    expect(live).toMatchObject({ identifier: 'live', artifactType: 'text/html', title: 'Live' });
    expect(live?.content).toBe(HTML_DOC.slice(0, 20));
  });

  it('splitStreamingArtifact defers to stripArtifact once the close tag has already arrived', () => {
    const content = `head <artifact identifier="a" type="text/html" title="t">${HTML_DOC}</artifact>`;
    const { live } = splitStreamingArtifact(content);
    expect(live).toBeNull();
  });
});

describe('artifacts/validate', () => {
  it('accepts a complete HTML document', () => {
    expect(validateHtmlArtifact(HTML_DOC)).toEqual({ ok: true });
  });

  it('rejects prose that merely mentions <html> mid-sentence', () => {
    const result = validateHtmlArtifact('I updated the <html lang> attribute for you, all set!');
    expect(result.ok).toBe(false);
  });

  it('rejects a too-short empty-body document (fixture-grade, not a real deliverable)', () => {
    const result = validateHtmlArtifact('<!doctype html><html><body></body></html>');
    expect(result.ok).toBe(false);
  });

  it('rejects a document whose asset URL points at a reserved workspace-storage path', () => {
    const doc = '<!doctype html><html><body><img src=".workspace/secret.png" alt="leaked-asset-reference-padding"></body></html>';
    const result = validateHtmlArtifact(doc);
    expect(result.ok).toBe(false);
  });
});

describe('artifacts/manifest', () => {
  it('creates, serializes, and round-trips a manifest', () => {
    const manifest = createHtmlArtifactManifest({ entry: 'index.html', title: 'My Page' });
    const parsed = parseArtifactManifest(serializeArtifactManifest(manifest));
    expect(parsed).toEqual(manifest);
  });

  it('rejects a manifest whose exports array contains an unknown export kind', () => {
    const tampered = JSON.stringify({ version: 1, kind: 'html', title: 't', entry: 'e.html', renderer: 'html', exports: ['html', 'exe'] });
    expect(parseArtifactManifest(tampered)).toBeNull();
  });

  it('rejects a manifest with an empty exports array', () => {
    const tampered = JSON.stringify({ version: 1, kind: 'html', title: 't', entry: 'e.html', renderer: 'html', exports: [] });
    expect(parseArtifactManifest(tampered)).toBeNull();
  });

  it('rejects a manifest at an unsupported version', () => {
    const tampered = JSON.stringify({ version: 2, kind: 'html', title: 't', entry: 'e.html', renderer: 'html', exports: ['html'] });
    expect(parseArtifactManifest(tampered)).toBeNull();
  });

  it('infers a legacy manifest kind/renderer from a bare file name, including the deck-name heuristic', () => {
    expect(inferLegacyManifest({ entry: 'notes.md' })).toMatchObject({ kind: 'markdown-document', renderer: 'markdown' });
    expect(inferLegacyManifest({ entry: 'pitch-deck.html' })).toMatchObject({ kind: 'deck', renderer: 'deck-html' });
    expect(inferLegacyManifest({ entry: 'unknownfile.bin' })).toBeNull();
  });

  it('matches a persisted file by manifest identifier even when the file name was collision-renamed', () => {
    const attrs = { identifier: 'my-artifact', type: 'text/html', title: 'T' };
    const files = [{ name: 'my-artifact-2.html', identifier: 'my-artifact' }];
    expect(matchPersistedArtifactFile(attrs, files)).toEqual(files[0]);
  });

  it('falls back to slug/extension matching when no identifier is present', () => {
    const attrs = { title: 'My Cool Page', type: 'text/html' };
    const files = [{ name: 'my-cool-page-3.html' }];
    expect(matchPersistedArtifactFile(attrs, files)).toEqual(files[0]);
  });
});

describe('artifacts/recover', () => {
  it('recovers a standalone HTML document reply as-is', () => {
    expect(recoverStandaloneHtmlDocument(HTML_DOC)).toBe(HTML_DOC);
    expect(recoverStandaloneHtmlDocument('just some prose')).toBeNull();
  });

  it('recovers HTML from a single fenced ```html block but refuses when there are two candidates (ambiguous)', () => {
    const single = '```html\n' + HTML_DOC + '\n```';
    expect(recoverHtmlDocumentFromMarkdownFence(single)).toBe(HTML_DOC);

    const doubled = single + '\n\n' + single;
    expect(recoverHtmlDocumentFromMarkdownFence(doubled)).toBeNull();
  });
});

describe('artifacts/pointer', () => {
  it('resolves a bare "see foo.html" reply to the unambiguous matching project file', () => {
    const target = resolveHtmlPointerArtifactTarget({
      content: 'see design.html',
      candidateFileName: 'response.html',
      projectFiles: [{ name: 'design.html' }, { name: 'notes.md' }],
    });
    expect(target).toBe('design.html');
  });

  it('refuses to resolve when the pointer basename matches more than one project file (ambiguous)', () => {
    const target = resolveHtmlPointerArtifactTarget({
      content: 'see design.html',
      candidateFileName: 'response.html',
      projectFiles: [{ name: 'v1/design.html' }, { name: 'v2/design.html' }],
    });
    expect(target).toBeNull();
  });

  it('is not fooled by a long prose reply that happens to end in a filename mention', () => {
    const longProse = `${'x'.repeat(200)} see design.html`;
    const target = resolveHtmlPointerArtifactTarget({
      content: longProse,
      candidateFileName: 'response.html',
      projectFiles: [{ name: 'design.html' }],
    });
    expect(target).toBeNull();
  });
});
