export type RevisionReviewStatus = 'pending' | 'accepted' | 'rejected';

export interface RevisionReviewFileChange {
  path: string;
  baseContent: string;
  proposedContent: string;
}

/**
 * A proposed text change awaiting accept/reject, plus enough history to
 * render a status-badged list entry. `TMeta` is a host-defined escape hatch
 * for anything beyond this generic shape (e.g. the origin's `designSystemId`/
 * `jobId`) — opaque to this feature, never read by it.
 */
export interface RevisionReviewItem<TMeta = unknown> {
  id: string;
  status: RevisionReviewStatus;
  feedback: string;
  baseBody: string;
  proposedBody: string;
  createdAt: string;
  updatedAt: string;
  sectionTitle?: string;
  fileChanges?: RevisionReviewFileChange[];
  meta?: TMeta;
}
