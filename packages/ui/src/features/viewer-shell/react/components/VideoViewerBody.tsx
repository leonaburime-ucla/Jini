export interface VideoViewerBodyProps {
  src: string;
}

/** Plain `<video>` body — generalizes the source component's
 *  `VideoViewer` once the daemon-specific URL-building is stripped out. */
export function VideoViewerBody({ src }: VideoViewerBodyProps) {
  return <video src={src} controls playsInline preload="metadata" />;
}
