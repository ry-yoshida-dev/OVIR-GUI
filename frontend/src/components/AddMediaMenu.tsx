import type { MenuEntry } from "./Menu";
import { PlusGlyph } from "./PlusGlyph";

interface AddMediaMenuProps {
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  onOpenFromServer: () => void;
  onOpenMenu: (target: HTMLElement, entries: MenuEntry[]) => void;
}

export function AddMediaMenu({ onUploadFiles, onUploadFolder, onOpenFromServer, onOpenMenu }: AddMediaMenuProps) {
  return (
    <button
      className="section-action"
      aria-haspopup="menu"
      title="Add images and videos"
      aria-label="Add media"
      onClick={(event) =>
        onOpenMenu(event.currentTarget, [
          {
            label: <span title="Upload images and videos from this computer">Upload Files…</span>,
            onSelect: onUploadFiles,
          },
          {
            label: <span title="Upload a folder from this computer">Upload Folder…</span>,
            onSelect: onUploadFolder,
          },
          {
            label: <span title="Open files already on the server (Ctrl+O)">Open from Server…</span>,
            shortcut: "Ctrl+O",
            onSelect: onOpenFromServer,
          },
        ])
      }
    >
      <PlusGlyph />
    </button>
  );
}
