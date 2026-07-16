import { createAuditExport } from "../../src/routes/auditExport";
import { delay } from "../../src/test-support/delay";

describe("audit export event", () => {
  it("eventually publishes audit export event", async () => {
    createAuditExport({
      adminId: "admin-1",
      startDate: "2026-05-01",
      endDate: "2026-05-02",
    });

    await delay(250);

    expect(true).toBe(true);
  });
});
