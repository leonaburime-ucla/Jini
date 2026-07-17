export interface CaptureWarningBannerProps {
  message: string;
  chromeHidden: boolean;
}

export function CaptureWarningBanner({ message, chromeHidden }: CaptureWarningBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        maxWidth: '100%',
        padding: '8px 12px',
        borderRadius: 999,
        background: 'rgba(20,20,20,0.92)',
        color: '#fff',
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
        backdropFilter: 'blur(8px)',
        zIndex: 92,
        pointerEvents: 'none',
        fontSize: 13,
        lineHeight: 1.35,
        visibility: chromeHidden ? 'hidden' : undefined,
      }}
    >
      <span>{message}</span>
    </div>
  );
}
