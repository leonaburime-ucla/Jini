import React from "react";

type AdminDashboardProps = {
  state: "loading" | "empty" | "error" | "ready";
  pendingReviewCount: number;
  failedExportCount: number;
  lastAuditEventAt?: string;
  onRetry: () => void;
};

export function AdminDashboard({
  state,
  pendingReviewCount,
  failedExportCount,
  lastAuditEventAt,
  onRetry,
}: AdminDashboardProps) {
  if (state === "loading") {
    return <section aria-label="Admin dashboard">Loading admin operations...</section>;
  }

  if (state === "error") {
    return (
      <section aria-label="Admin dashboard error">
        <p>Admin operations failed to load.</p>
        <button onClick={onRetry}>Retry</button>
      </section>
    );
  }

  if (state === "empty") {
    return <section aria-label="Admin dashboard">No admin operations need attention.</section>;
  }

  return (
    <section aria-label="Admin dashboard">
      <h1>Admin operations</h1>
      <p>Pending reviews: {pendingReviewCount}</p>
      <p>Failed exports: {failedExportCount}</p>
      <p>Last audit event: {lastAuditEventAt ?? "Unknown"}</p>
    </section>
  );
}
