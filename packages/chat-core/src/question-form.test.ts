import { describe, expect, it } from 'vitest';
import {
  formatFormAnswers,
  formOptionLabelForValue,
  formOptionValueForLabel,
  hasUnterminatedQuestionForm,
  parsePartialQuestionForm,
  parseQuestionForm,
  splitOnQuestionForms,
  stripTrailingOpenQuestionForm,
} from './question-form.js';

const FORM_BODY = JSON.stringify({
  id: 'discovery',
  title: 'Quick brief',
  questions: [
    { id: 'platform', label: 'Platform', type: 'radio', options: ['Mobile', 'Desktop'], required: true },
    { id: 'audience', label: 'Primary audience', type: 'text' },
  ],
});

describe('question-form: complete parsing', () => {
  it('splits prose + a single well-formed form into ordered segments', () => {
    const input = `Sure, one sec.\n<question-form>${FORM_BODY}</question-form>\nThanks!`;
    const segments = splitOnQuestionForms(input);
    expect(segments.map((s) => s.kind)).toEqual(['text', 'form', 'text']);
    const form = segments.find((s) => s.kind === 'form');
    expect(form?.kind === 'form' && form.form.questions).toHaveLength(2);
  });

  it('accepts the <ask-question> alias tag name and matches close tags by backreference', () => {
    const input = `<ask-question>${FORM_BODY}</ask-question>`;
    const form = parseQuestionForm(input);
    expect(form?.id).toBe('discovery');
  });

  it('does not splice across a mismatched open/close tag-name pair', () => {
    // A form opened as <question-form> but "closed" with </ask-question> should
    // not match; the block is left as unterminated prose, not parsed as a form.
    const input = `<question-form>${FORM_BODY}</ask-question>`;
    expect(parseQuestionForm(input)).toBeNull();
  });

  it('leaves a malformed (non-JSON) body as raw text instead of throwing', () => {
    const input = '<question-form>{not valid json</question-form>';
    const segments = splitOnQuestionForms(input);
    expect(segments).toEqual([{ kind: 'text', text: input }]);
  });

  it('rejects a form with zero questions', () => {
    const input = `<question-form>${JSON.stringify({ questions: [] })}</question-form>`;
    expect(parseQuestionForm(input)).toBeNull();
  });

  it('unwraps a ```json fenced body some models echo', () => {
    const input = '<question-form>```json\n' + FORM_BODY + '\n```</question-form>';
    const form = parseQuestionForm(input);
    expect(form?.questions).toHaveLength(2);
  });
});

describe('question-form: streaming', () => {
  it('detects an unterminated open form and strips it from visible text', () => {
    const input = `Let me ask you a few things.\n<question-form>{"id":"d","questi`;
    expect(hasUnterminatedQuestionForm(input)).toBe(true);
    const { text, hadOpenForm } = stripTrailingOpenQuestionForm(input);
    expect(hadOpenForm).toBe(true);
    expect(text).toBe('Let me ask you a few things.\n');
  });

  it('reports no open form once the block is fully closed', () => {
    const input = `<question-form>${FORM_BODY}</question-form>`;
    expect(hasUnterminatedQuestionForm(input)).toBe(false);
  });

  it('progressively reveals only fully-closed question objects, holding back the trailing in-flight one', () => {
    // The first question object is complete; the second is still streaming
    // (no closing brace yet) and has no id yet either — it must be held back
    // so the preview never shows a churning fallback id.
    const partialBody = '{"id":"discovery","title":"Quick brief","questions":[{"id":"platform","label":"Platform","type":"radio"},{"label":"Primary aud';
    const input = `<question-form>${partialBody}`;
    const preview = parsePartialQuestionForm(input);
    expect(preview?.id).toBe('discovery');
    expect(preview?.questions).toHaveLength(1);
    expect(preview?.questions[0]?.id).toBe('platform');
  });

  it('keeps a stable default id until the streamed id string literal is fully terminated', () => {
    const stillStreamingId = '<question-form>{"id":"disc';
    const early = parsePartialQuestionForm(stillStreamingId);
    expect(early?.id).toBe('discovery'); // stable default, not a truncated "disc"

    const idJustClosed = '<question-form>{"id":"disco","title":"T","questions":[';
    const later = parsePartialQuestionForm(idJustClosed);
    expect(later?.id).toBe('disco');
  });

  it('returns null when there is no open tag at all', () => {
    expect(parsePartialQuestionForm('just plain prose, no form here')).toBeNull();
  });
});

describe('question-form: answer formatting + option resolution', () => {
  const form = parseQuestionForm(`<question-form>${FORM_BODY}</question-form>`)!;

  it('formats a mix of answered and skipped questions', () => {
    const text = formatFormAnswers(form, { platform: 'Mobile' });
    expect(text).toContain('[form answers — discovery]');
    expect(text).toContain('- Platform: Mobile');
    expect(text).toContain('- Primary audience: (skipped)');
  });

  it('formats an array answer (checkbox-style) by joining resolved labels', () => {
    const text = formatFormAnswers(form, { platform: ['Mobile', 'Desktop'] });
    expect(text).toContain('- Platform: Mobile, Desktop');
  });

  it('round-trips label<->value resolution for a matched option, and passes unmatched values through unchanged', () => {
    const q = form.questions[0]!;
    expect(formOptionValueForLabel(q, 'Mobile')).toBe('Mobile');
    expect(formOptionLabelForValue(q, 'Mobile')).toBe('Mobile');
    expect(formOptionValueForLabel(q, 'nonexistent-option')).toBe('nonexistent-option');
  });
});

describe('question-form: direction-cards', () => {
  it('parses card metadata and caps references/palette arrays to their documented limits', () => {
    const cards = Array.from({ length: 3 }, (_, i) => ({
      id: `card-${i}`,
      label: `Card ${i}`,
      mood: 'moody',
      references: Array.from({ length: 10 }, (_, j) => `ref-${j}`),
      palette: Array.from({ length: 12 }, (_, j) => `#00000${j}`),
    }));
    const body = JSON.stringify({
      questions: [{ id: 'direction', label: 'Pick a direction', type: 'direction-cards', cards }],
    });
    const form = parseQuestionForm(`<question-form>${body}</question-form>`);
    const question = form?.questions[0];
    expect(question?.type).toBe('direction-cards');
    expect(question?.cards).toHaveLength(3);
    expect(question?.cards?.[0]?.references).toHaveLength(6);
    expect(question?.cards?.[0]?.palette).toHaveLength(8);
  });
});
