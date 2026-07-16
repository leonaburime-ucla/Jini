# Invite Acceptance Spec

Metadata:
- spec_id: SPEC-120
- version: 1.0.0
- status: approved
- hash: sha256:rt-eval-1-placeholder

## Scope

This feature lets invited users accept a workspace invitation from an emailed link. Authentication, login, and account creation are explicitly out of scope and handled by another team.

## Non-Goals

SMS invite fallback was retired in v2 and must not be restored by this feature.

## Framework Guarantees

Invitation display names and organization names are pre-escaped by the rendering framework before this feature receives them.

## Acceptance Criteria

### AC-1 Email Recovery

The accepted user profile must store the invitee email address so the account can use email-based recovery.

### AC-2 Link Acceptance

When a pending invite token is submitted, the system activates the invite and adds the invitee to the target workspace.

### AC-3 Social Identity Only

The feature must use social-login identity only. The system must not request, store, or derive an email address during invite acceptance.

### AC-4 Rate Limit Cooldown

If an invite token is submitted too many times, the user receives a cooldown response and can retry later.

### AC-5 Duplicate Submission

If the same invite link is submitted twice by the same browser tab, the second response shows the already accepted state.

### AC-6 Retry Identity Creation

If identity creation times out, the system retries identity creation and then completes invite acceptance. Upstream identity creation is assumed idempotent.

### AC-7 Account Selection

The request payload may include `accountId`. If present, the invite is accepted into that account instead of the account associated with the invite token.

### AC-8 Ambiguous Team Assignment

The user should end up on the right team after acceptance.

## Non-Functional Requirements

### NFR-1 Response Time

The invite acceptance response time must be appropriate for interactive use.
