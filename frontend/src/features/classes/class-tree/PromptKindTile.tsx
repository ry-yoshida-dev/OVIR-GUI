export type PromptKind = "text" | "image" | "point" | "box" | "exemplar";

interface PromptKindTileProps {
  kind: PromptKind;
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.3 } as const;

function shapesOf(kind: PromptKind) {
  switch (kind) {
    case "text":
      return <path d="M3.5 3.75h9M8 3.75v8.5M6.25 12.25h3.5" {...STROKE} strokeWidth={1.6} strokeLinecap="round" />;
    case "image":
      return (
        <>
          <rect x="2" y="3" width="12" height="10" rx="2" {...STROKE} />
          <circle cx="5.7" cy="6.4" r="1.2" fill="currentColor" />
          <path d="M2.6 11.6 6 8.3l2 2 2.3-2.4 3.1 3.1" {...STROKE} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "point":
      return (
        <>
          <circle cx="8" cy="8" r="5.25" {...STROKE} opacity={0.45} />
          <circle cx="8" cy="8" r="2.75" fill="currentColor" />
        </>
      );
    case "box":
      return (
        <>
          <rect x="3" y="3" width="10" height="10" rx="1.5" {...STROKE} strokeWidth={1.4} />
          <rect x="1.75" y="1.75" width="2.5" height="2.5" rx="0.6" fill="currentColor" />
          <rect x="11.75" y="11.75" width="2.5" height="2.5" rx="0.6" fill="currentColor" />
        </>
      );
    case "exemplar":
      return (
        <>
          <rect x="1.75" y="5.25" width="8" height="8" rx="1.5" {...STROKE} />
          <rect x="6.25" y="2.75" width="8" height="8" rx="1.5" {...STROKE} strokeDasharray="2 1.6" />
        </>
      );
  }
}

/**
 * Colored tile marking the kind of a prompt in menus and rows of the class tree.
 */
export function PromptKindTile({ kind }: PromptKindTileProps) {
  return (
    <span className={`prompt-kind-tile ${kind}`} aria-hidden="true">
      <svg viewBox="0 0 16 16">{shapesOf(kind)}</svg>
    </span>
  );
}
