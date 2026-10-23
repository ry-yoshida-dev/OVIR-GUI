import { MediaKindBadges } from "./MediaKindBadges";

interface DropOverlayProps {
  uploadDirectory: string;
}

/**
 * Covers the window while files are dragged over it.
 */
export function DropOverlay({ uploadDirectory }: DropOverlayProps) {
  return (
    <div className="drop-overlay">
      <div className="card">
        <MediaKindBadges />
        <div style={{ fontWeight: 600 }}>
          Drop images, videos or folders to upload and open them
        </div>
        <div className="hint">
          They are stored on the server in {uploadDirectory}
        </div>
      </div>
    </div>
  );
}
