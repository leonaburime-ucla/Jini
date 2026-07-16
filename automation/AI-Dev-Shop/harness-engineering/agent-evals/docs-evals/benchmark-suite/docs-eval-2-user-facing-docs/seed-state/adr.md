# ADR Excerpt

Internal decision: export jobs use a queue and S3-compatible object storage because synchronous CSV generation exceeded p99 latency.

User-visible behavior: exports may take up to 2 minutes before the download link is ready.

Control variant: an ADR only changes internal module boundaries and has no user-visible behavior.
