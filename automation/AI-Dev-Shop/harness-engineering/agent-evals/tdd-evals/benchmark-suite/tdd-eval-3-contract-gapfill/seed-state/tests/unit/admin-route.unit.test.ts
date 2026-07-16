import { createAuditExport } from "../../src/routes/auditExport";

describe("admin route", () => {
  it("sets private event state", () => {
    const result = createAuditExport({
      adminId: "admin-1",
      startDate: "2026-05-01",
      endDate: "2026-05-02",
    }) as any;

    expect(result.event.requestId).toBe("req-fixed");
  });
});
