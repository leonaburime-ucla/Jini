export interface ImageViewerBodyProps {
  src: string;
  alt: string;
}

/** Plain `<img>` body — generalizes the source component's `ImageViewer`
 *  once the daemon-specific URL-building is stripped out (the host resolves
 *  `src` itself and hands over a final URL). */
export function ImageViewerBody({ src, alt }: ImageViewerBodyProps) {
  return <img alt={alt} src={src} />;
}
