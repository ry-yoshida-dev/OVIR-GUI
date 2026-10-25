import { useEffect, useMemo, useRef } from "react";
import type { MediaEntry, PictureKey } from "../api/types";
import { groupMedia } from "../lib/mediaGroups";
import { effectiveMediaSelection } from "../lib/mediaSelection";
import { clamp } from "../lib/numbers";
import { withMembership } from "../lib/sets";
import { MediaKindGlyph } from "./MediaKindGlyph";
import { useMenu } from "./Menu";
import { MixedCheckbox } from "./MixedCheckbox";

interface MediaListProps {
  media: MediaEntry[];
  currentPath: string | null;
  backgroundKey: PictureKey | null;
  checkedPaths: ReadonlySet<string>;
  onCheckedChange: (paths: Set<string>) => void;
  onSelect: (path: string) => void;
  onRemove: (paths: string[]) => void;
}

export function MediaList({
  media,
  currentPath,
  backgroundKey,
  checkedPaths,
  onCheckedChange,
  onSelect,
  onRemove,
}: MediaListProps) {
  const container = useRef<HTMLDivElement>(null);
  const menu = useMenu();
  const groups = useMemo(() => groupMedia(media), [media]);

  useEffect(() => {
    if (currentPath === null) return;
    const element = container.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(currentPath)}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [currentPath]);

  const step = (delta: number) => {
    const index = media.findIndex((entry) => entry.path === currentPath);
    const next = media[clamp(index + delta, 0, media.length - 1)];
    if (next !== undefined && next.path !== currentPath) onSelect(next.path);
  };

  const setGroupChecked = (entries: MediaEntry[], isChecked: boolean) => {
    const next = new Set(checkedPaths);
    for (const entry of entries) {
      if (isChecked) next.add(entry.path);
      else next.delete(entry.path);
    }
    onCheckedChange(next);
  };

  return (
    <>
      <div
        ref={container}
        className="list"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "PageUp") {
            event.preventDefault();
            step(-1);
          } else if (event.key === "ArrowDown" || event.key === "PageDown") {
            event.preventDefault();
            step(1);
          } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            const paths = effectiveMediaSelection(media, checkedPaths, currentPath);
            if (paths.length > 0) onRemove(paths);
          }
        }}
      >
        {media.length === 0 && <div className="list-item faint">Nothing open.</div>}
        {groups.map((group) => (
          <div key={group.kind} className="list-group" role="group" aria-label={group.label}>
            <div className="list-group-heading">
              <MixedCheckbox
                checkedCount={group.entries.filter((entry) => checkedPaths.has(entry.path)).length}
                totalCount={group.entries.length}
                title={`Check every file in ${group.label}`}
                onChange={(isChecked) => setGroupChecked(group.entries, isChecked)}
              />
              <MediaKindGlyph kind={group.kind} />
              <span>{group.label}</span>
              <span className="faint">{group.entries.length}</span>
            </div>
            {group.entries.map((entry) => {
              const isCurrent = entry.path === currentPath;
              const isChecked = checkedPaths.has(entry.path);
              const isRecognizing = backgroundKey?.path === entry.path;
              return (
                <div
                  key={entry.path}
                  data-path={entry.path}
                  className={`list-item${isCurrent ? " current" : ""}${isChecked && !isCurrent ? " selected" : ""}`}
                  title={`${entry.path}\n${entry.description}${entry.frame_count === null ? "" : `\n${entry.frame_count} frames at ${entry.fps?.toFixed(2)} fps`}`}
                  onClick={() => onSelect(entry.path)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    const paths = isChecked ? effectiveMediaSelection(media, checkedPaths, null) : [entry.path];
                    menu.open(event.clientX, event.clientY, [
                      {
                        label: paths.length === 1 ? "Remove" : `Remove ${paths.length} Files`,
                        shortcut: "Del",
                        onSelect: () => onRemove(paths),
                      },
                      { label: "Remove All", onSelect: () => onRemove(media.map((item) => item.path)) },
                    ]);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    aria-label={`Check ${entry.name}`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => onCheckedChange(withMembership(checkedPaths, entry.path, event.target.checked))}
                  />
                  <span
                    className="dot"
                    style={{
                      borderColor: entry.color,
                      background: entry.state === "done" || entry.state === "outdated" ? entry.color : "transparent",
                    }}
                  />
                  <span className="name">{entry.name}</span>
                  {isRecognizing && <span className="faint small">inferring…</span>}
                  <span className="muted small">{entry.count_text}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {menu.element}
    </>
  );
}
