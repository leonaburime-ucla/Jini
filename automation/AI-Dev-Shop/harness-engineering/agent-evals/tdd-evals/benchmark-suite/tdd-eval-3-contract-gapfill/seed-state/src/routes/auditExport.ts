import { buildAuditExportEvent } from "../contracts/auditExport";

type AuditExportRequest = {
  adminId?: string;
  startDate: string;
  endDate: string;
};

export function createAuditExport(request: AuditExportRequest) {
  if (!request.adminId) {
    return { status: 401, body: { code: "UNAUTHENTICATED" } };
  }

  return {
    status: 202,
    event: buildAuditExportEvent({
      adminId: request.adminId,
      startDate: request.startDate,
      endDate: request.endDate,
      requestId: "req-fixed",
    }),
  };
}
