import type { MediaKindValue } from "../api/types";
import { Glyph } from "./Glyphs";

interface MediaKindGlyphProps {
  kind: MediaKindValue;
}

export function MediaKindGlyph({ kind }: MediaKindGlyphProps) {
  return (
    <Glyph className="media-kind-glyph" viewBox="0 0 24 24">
      {kind === "image" && (
        <>
          <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8.5" cy="9.5" r="1.8" fill="currentColor" />
          <path
            d="M3.8 17.5l4.9-4.9a1.2 1.2 0 0 1 1.7 0l2.1 2.1 3.4-3.6a1.2 1.2 0 0 1 1.7 0l3.6 3.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {kind === "video" && (
        <>
          <rect x="2.5" y="6" width="13.5" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M16 10.3l4.3-2.6a.8.8 0 0 1 1.2.7v7.2a.8.8 0 0 1-1.2.7L16 13.7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M7.5 9.6v4.8l4-2.4z" fill="currentColor" />
        </>
      )}
    </Glyph>
  );
}
