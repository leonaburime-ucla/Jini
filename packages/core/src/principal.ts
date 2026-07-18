/**
 * `Principal` — the authenticated/authorized identity a kernel operation
 * (a tool call, a run) is performed on behalf of. Deliberately minimal per
 * extraction-plan.md §3 ("Principal/Authorizer, pure interfaces"): the
 * kernel only needs an opaque, stable identity plus an optional coarse
 * role/capability hint a `ToolPolicy` can branch on — anything richer
 * (session, auth provider, user profile) is a consumer concern layered on
 * top, never a kernel noun.
 */
export interface Principal {
  /** Opaque, stable identity — never assumed to be a product user id. */
  readonly id: string;
  /** Optional coarse role/capability hints a policy may consult. */
  readonly roles?: readonly string[];
}
