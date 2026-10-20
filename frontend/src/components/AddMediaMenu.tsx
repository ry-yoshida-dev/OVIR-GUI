import type { MenuEntry } from "./Menu";

interface AddMediaMenuProps {
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  onOpenFromServer: () => void;
  onOpenMenu: (target: HTMLElement, entries: MenuEntry[]) => void;
}

export function AddMediaMenu({ onUploadFiles, onUploadFolder, onOpenFromServer, onOpenMenu }: AddMediaMenuProps) {
  return (
    <button
      className="band-button"
      aria-haspopup="menu"
      title="Add images and videos"
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
      ＋ Add media ▾
    </button>
  );
}
