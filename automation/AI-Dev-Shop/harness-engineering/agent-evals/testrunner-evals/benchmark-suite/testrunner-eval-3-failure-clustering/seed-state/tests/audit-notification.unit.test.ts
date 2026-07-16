import { buildAuditNotification } from "../src/auditPublisher";

describe("audit notification", () => {
  it("builds the active payload", () => {
    expect(buildAuditNotification()).toMatchObject({
      adminId: "admin-1",
      merchantId: "m-1",
      settingName: "billing",
    });
  });
});
