/**
 * @module run/core/failure-taxonomy — Neutral run-failure taxonomy.
 *
 * Product-neutral string-literal unions describing a run's failure
 * classification (category / detail / stage / user action) and the safe-retry
 * decision vocabulary (strategy / suppressed reason). The run-orchestration
 * retry policy in `./retry.ts` consumes these as its failure-signal contract;
 * a consumer supplies the concrete signal from its own classifier.
 *
 * These were the shared analytics-contract enums an external classifier stamped
 * on each run. Only the vocabulary is kept here — the engine has no opinion on
 * how a consumer derives it — with the single vendor-account-balance member
 * dropped as product-specific.
 */

/** Terminal outcome of a run as reported to the retry policy. */
export type RunFailureResult = 'success' | 'failed' | 'cancelled';

/** Coarse failure family a terminal failure is bucketed into. */
export type RunFailureCategory =
  | 'auth'
  | 'rate_limit'
  | 'insufficient_balance'
  | 'model_unavailable'
  | 'prompt_too_large'
  | 'upstream_unavailable'
  | 'timeout'
  | 'empty_output'
  | 'tool_error'
  | 'process_exit'
  | 'user_cancel'
  | 'unknown';

/** Specific failure detail refining a {@link RunFailureCategory}. */
export type RunFailureDetail =
  | 'auth_required'
  | 'stale_profile'
  | 'refresh_token_reused'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'hard_quota'
  | 'workspace_credits_exhausted'
  | 'rate_limit_429'
  | 'model_not_found'
  | 'model_not_supported'
  | 'model_disabled'
  | 'local_model_not_loaded'
  | 'cli_version_incompatible'
  | 'prompt_too_large'
  | 'upstream_5xx'
  | 'upstream_client_error'
  | 'stream_disconnected'
  | 'network_error'
  | 'provider_high_demand'
  | 'provider_routing_error'
  | 'inactivity_timeout'
  | 'timeout'
  | 'empty_output'
  | 'tool_error'
  | 'plugin_artifact_missing'
  | 'cli_not_installed'
  | 'git_bash_missing'
  | 'agent_config_invalid'
  | 'spawn_failed'
  | 'spawn_enoexec'
  | 'spawn_ebadf'
  | 'spawn_eperm'
  | 'stdin_write_eof'
  | 'agent_protocol_error'
  | 'session_resume_expired'
  | 'fabricated_role_marker'
  | 'permission_request_not_found'
  | 'qoder_stop_sequence'
  | 'signal_killed'
  | 'process_crashed'
  | 'interrupted'
  | 'exit_code'
  | 'terminated_unknown'
  | 'stream_error'
  | 'exit_nonzero'
  | 'fatal_rpc_error'
  | 'execution_failed'
  | 'user_cancelled'
  | 'unknown';

/** Lifecycle stage a run had reached when it failed. */
export type RunFailureStage =
  | 'preflight'
  | 'spawn'
  | 'session_init'
  | 'model_select'
  | 'prompt_send'
  | 'first_token_wait'
  | 'tool_execution'
  | 'artifact_write'
  | 'child_close'
  | 'finalize';

/** Retry strategy label attached to an automatic same-run transient retry. */
export type RunRetryStrategy = 'same_run_transient';

/** Reason an eligible-looking failure was NOT automatically retried. */
export type RunRetrySuppressedReason =
  | 'not_failed'
  | 'not_retryable'
  | 'unsupported_category'
  | 'non_retryable_category'
  | 'unsafe_failure_stage'
  | 'missing_failure_signal'
  | 'hard_quota'
  | 'attempt_limit_reached'
  | 'cancel_requested'
  | 'user_visible_output_seen'
  | 'tool_call_seen'
  | 'artifact_write_seen'
  | 'live_artifact_seen';
