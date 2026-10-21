import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaEntry, PictureKey } from "../api/types";
import { groupMedia } from "../lib/mediaGroups";
import { MediaKindGlyph } from "./MediaKindGlyph";
import { useMenu } from "./Menu";

interface MediaListProps {
  media: MediaEntry[];
  currentPath: string | null;
  backgroundKey: PictureKey | null;
  onSelect: (path: string) => void;
  onClose: (paths: string[]) => void;
}

export function MediaList({ media, currentPath, backgroundKey, onSelect, onClose }: MediaListProps) {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const menu = useMenu();
  const groups = useMemo(() => groupMedia(media), [media]);

  useEffect(() => {
    const open = new Set(media.map((entry) => entry.path));
    setSelectedPaths((current) => new Set([...current].filter((path) => open.has(path))));
  }, [media]);

  useEffect(() => {
    if (currentPath === null) return;
    const element = container.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(currentPath)}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [currentPath]);

  const effectiveSelection = (): string[] => {
    if (selectedPaths.size > 0) return media.map((entry) => entry.path).filter((path) => selectedPaths.has(path));
    return currentPath === null ? [] : [currentPath];
  };

  const step = (delta: number) => {
    const index = media.findIndex((entry) => entry.path === currentPath);
    const next = media[Math.min(media.length - 1, Math.max(0, index + delta))];
    if (next !== undefined && next.path !== currentPath) {
      setSelectedPaths(new Set());
      onSelect(next.path);
    }
  };

  const onRowClick = (event: React.MouseEvent, path: string) => {
    if (event.metaKey || event.ctrlKey) {
      setSelectedPaths((current) => {
        const next = new Set(current.size === 0 && currentPath !== null ? [currentPath] : current);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      anchor.current = path;
      return;
    }
    if (event.shiftKey && anchor.current !== null) {
      const from = media.findIndex((entry) => entry.path === anchor.current);
      const to = media.findIndex((entry) => entry.path === path);
      const [start, end] = from < to ? [from, to] : [to, from];
      setSelectedPaths(new Set(media.slice(start, end + 1).map((entry) => entry.path)));
      return;
    }
    anchor.current = path;
    setSelectedPaths(new Set());
    onSelect(path);
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
            const paths = effectiveSelection();
            if (paths.length > 0) onClose(paths);
          }
        }}
      >
        {media.length === 0 && <div className="list-item faint">Nothing open.</div>}
        {groups.map((group) => (
          <div key={group.kind} className="list-group" role="group" aria-label={group.label}>
            <div className="list-group-heading">
              <MediaKindGlyph kind={group.kind} />
              <span>{group.label}</span>
              <span className="faint">{group.entries.length}</span>
            </div>
            {group.entries.map((entry) => {
              const isCurrent = entry.path === currentPath;
              const isSelected = selectedPaths.has(entry.path);
              const isRecognizing = backgroundKey?.path === entry.path;
              return (
                <div
                  key={entry.path}
                  data-path={entry.path}
                  className={`list-item${isCurrent ? " current" : ""}${isSelected && !isCurrent ? " selected" : ""}`}
                  title={`${entry.path}\n${entry.description}${entry.frame_count === null ? "" : `\n${entry.frame_count} frames at ${entry.fps?.toFixed(2)} fps`}`}
                  onClick={(event) => onRowClick(event, entry.path)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!selectedPaths.has(entry.path) && entry.path !== currentPath) {
                      setSelectedPaths(new Set([entry.path]));
                    }
                    const paths = selectedPaths.has(entry.path) ? effectiveSelection() : [entry.path];
                    menu.open(event.clientX, event.clientY, [
                      {
                        label: paths.length === 1 ? "Close" : `Close ${paths.length} Files`,
                        shortcut: "Del",
                        onSelect: () => onClose(paths),
                      },
                      { label: "Close All", onSelect: () => onClose(media.map((item) => item.path)) },
                    ]);
                  }}
                >
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
