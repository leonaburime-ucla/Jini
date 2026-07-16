import React from "react";

type RiskHoldBannerProps = {
  reason: string;
  canContactSupport: boolean;
  onContactSupport: () => void;
};

export function RiskHoldBanner({
  reason,
  canContactSupport,
  onContactSupport,
}: RiskHoldBannerProps) {
  return (
    <section aria-label="Checkout hold notice">
      <h2>Checkout needs review</h2>
      <p>{reason || "We need to review this order before checkout can continue."}</p>
      {canContactSupport ? (
        <button onClick={onContactSupport}>Contact support</button>
      ) : (
        <span>Support is reviewing this order.</span>
      )}
    </section>
  );
}
