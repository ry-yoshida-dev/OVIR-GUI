import { MediaKindGlyph } from "./MediaKindGlyph";

export function MediaKindBadges() {
  return (
    <div className="media-kind-badges">
      <span className="media-kind-badge" title="Images">
        <MediaKindGlyph kind="image" />
        Images
      </span>
      <span className="media-kind-badge" title="Videos">
        <MediaKindGlyph kind="video" />
        Videos
      </span>
    </div>
  );
}
