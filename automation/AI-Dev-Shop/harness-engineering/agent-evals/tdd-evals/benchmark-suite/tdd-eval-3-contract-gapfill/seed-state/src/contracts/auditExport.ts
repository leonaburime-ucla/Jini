export type AuditExportRequested = {
  adminId: string;
  startDate: string;
  endDate: string;
  requestId: string;
};

export function buildAuditExportEvent(input: AuditExportRequested): AuditExportRequested {
  return {
    adminId: input.adminId,
    startDate: input.startDate,
    endDate: input.endDate,
    requestId: input.requestId,
  };
}
