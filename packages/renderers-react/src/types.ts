import type { ArtifactManifest } from '@jini/chat-core';

export type { ArtifactManifest, ArtifactKind, ArtifactRendererId, ArtifactExportKind, ArtifactStatus } from '@jini/chat-core';

/**
 * A host's artifact/file representation, generified from a product's own
 * project-file type. A host's real file type carries far more (ids,
 * timestamps, storage refs, …) — this is only the shape the renderer
 * registry needs to resolve and render one.
 */
export interface ArtifactFile {
  name: string;
  /** Host-defined coarse file kind (e.g. 'html' | 'text' | 'image' | 'sketch'). Not the same vocabulary as `ArtifactManifest.kind`. */
  kind: string;
  content?: string | undefined;
  url?: string | undefined;
  manifest?: ArtifactManifest | undefined;
}
