import { render, screen } from "@testing-library/react";
import { RiskHoldBanner } from "../../src/components/RiskHoldBanner";

describe("RiskHoldBanner", () => {
  it("renders the hold message", () => {
    render(
      <RiskHoldBanner
        reason="Payment requires review"
        canContactSupport={true}
        onContactSupport={() => {}}
      />,
    );

    expect(screen.getByText("Checkout needs review")).toBeInTheDocument();
  });
});
