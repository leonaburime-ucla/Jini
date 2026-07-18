'use client';

import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { setRichTextFromPlainText } from '../../deserialize.js';
import { serializeRichText } from '../../serialize.js';
import type { MentionEntity } from '../../types.js';

/** Origin: `LexicalComposerInput.tsx`'s `SeedingPlugin`. Seeds the editor
 *  from a host-controlled `value` string only on genuine external changes
 *  (initial value, a template insert, a programmatic reset). When `value`
 *  already equals the live serialized text, the change came from the user
 *  typing — bail so the caret is preserved instead of clobbering it with a
 *  full rebuild. */
export function useSeededValue(value: string, knownMentions: MentionEntity[]): void {
  const [editor] = useLexicalComposerContext();
  const lastSeeded = useRef<string | null>(null);
  const knownRef = useRef(knownMentions);
  knownRef.current = knownMentions;
  useEffect(() => {
    const current = serializeRichText(editor.getEditorState()).text;
    if (value === current) return; // user-typed → no reseed → caret preserved
    if (value === lastSeeded.current) return; // StrictMode double-invoke guard
    lastSeeded.current = value;
    setRichTextFromPlainText(editor, value, knownRef.current);
  }, [value, editor]);
}
