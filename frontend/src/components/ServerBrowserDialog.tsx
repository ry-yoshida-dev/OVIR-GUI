import { useEffect, useEffectEvent, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { DirectoryListing } from "../api/types";
import { isImagePath, isMediaPath } from "../lib/droppedFiles";
import { toggledMembership } from "../lib/sets";
import { Dialog } from "./Dialog";

export type BrowseMode = "media" | "images" | "directory" | "image";

interface ServerBrowserDialogProps {
  mode: BrowseMode;
  title: string;
  initialPath?: string;
  isFolderChoosable?: boolean;
  onChoose: (paths: string[]) => void;
  onClose: () => void;
}

const LAST_DIRECTORY_KEY = "ovir-gui.last-directory";

function joinPath(directory: string, name: string): string {
  const separator = directory.includes("\\") && !directory.includes("/") ? "\\" : "/";
  return directory.endsWith(separator) ? `${directory}${name}` : `${directory}${separator}${name}`;
}

export function ServerBrowserDialog({
  mode,
  title,
  initialPath,
  isFolderChoosable = true,
  onChoose,
  onClose,
}: ServerBrowserDialogProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [pathText, setPathText] = useState("");
  const [error, setError] = useState("");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  const showListing = (next: DirectoryListing) => {
    setListing(next);
    setPathText(next.path);
    setSelectedImages(new Set());
    setError("");
    try {
      window.localStorage.setItem(LAST_DIRECTORY_KEY, next.path);
    } catch {
      return;
    }
  };
  const showError = (caught: unknown) => setError(errorMessage(caught));
  const load = (path?: string) => api.files(path).then(showListing, showError);
  const showInitialListing = useEffectEvent(showListing);
  const showInitialError = useEffectEvent(showError);

  useEffect(() => {
    let remembered: string | undefined;
    try {
      remembered = window.localStorage.getItem(LAST_DIRECTORY_KEY) ?? undefined;
    } catch {
      remembered = undefined;
    }
    api.files(initialPath ?? remembered).then(
      (next) => showInitialListing(next),
      (caught: unknown) => showInitialError(caught),
    );
  }, [initialPath]);

  const chooseTypedPath = () => {
    const typed = pathText.trim();
    if (typed === "") return;
    if ((mode === "media" && isMediaPath(typed)) || (mode === "images" && isImagePath(typed))) {
      onChoose([typed]);
      return;
    }
    void load(typed);
  };

  const selectedPaths = listing === null ? [] : [...selectedImages].map((name) => joinPath(listing.path, name));
  const isMultiple = mode === "media" || mode === "images";
  const listedFiles = (listing?.files ?? []).filter((file) => mode === "media" || file.kind === "image");

  return (
    <Dialog
      title={title}
      onClose={onClose}
      width={640}
      footer={
        <>
          <span className="left hint">
            {isMultiple && listing !== null && `${listedFiles.length} ${mode === "media" ? "files" : "images"} in this folder`}
          </span>
          <button onClick={onClose}>Cancel</button>
          {isMultiple && (
            <button disabled={selectedPaths.length === 0} onClick={() => onChoose(selectedPaths)}>
              Open {selectedPaths.length || ""} Selected
            </button>
          )}
          {(mode === "directory" || (isMultiple && isFolderChoosable)) && (
            <button className="primary" disabled={listing === null} onClick={() => listing && onChoose([listing.path])}>
              {isMultiple ? "Open This Folder" : "Choose This Folder"}
            </button>
          )}
          {mode === "image" && (
            <button className="primary" disabled={selectedPaths.length !== 1} onClick={() => onChoose(selectedPaths)}>
              Open
            </button>
          )}
        </>
      }
    >
      <div className="file-browser">
        <div className="row">
          <button className="icon" disabled={listing?.parent == null} onClick={() => void load(listing?.parent ?? undefined)} title="Parent folder">
            ↑
          </button>
          <input
            type="text"
            className="grow mono"
            value={pathText}
            onChange={(event) => setPathText(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && chooseTypedPath()}
            placeholder="Path on the server"
          />
          <button onClick={chooseTypedPath}>Go</button>
        </div>
        {listing !== null && listing.shortcuts.length > 0 && (
          <div className="row wrap small">
            {listing.shortcuts.map((shortcut) => (
              <button key={shortcut.name} className="ghost" onClick={() => void load(shortcut.path)} title={shortcut.path}>
                {shortcut.name}
              </button>
            ))}
          </div>
        )}
        {error !== "" && <div className="error-text">{error}</div>}
        <div className="list">
          {listing?.directories.map((name) => (
            <div key={`d-${name}`} className="list-item" onDoubleClick={() => void load(joinPath(listing.path, name))} onClick={() => void load(joinPath(listing.path, name))}>
              <span>📁</span>
              <span className="name">{name}</span>
            </div>
          ))}
          {mode !== "directory" &&
            listedFiles.map(({ name, kind }) => (
              <div
                key={`i-${name}`}
                className={`list-item${selectedImages.has(name) ? " selected" : ""}`}
                onClick={(event) => {
                  setSelectedImages((current) => {
                    if (mode === "image") return new Set([name]);
                    const base: ReadonlySet<string> =
                      event.metaKey || event.ctrlKey || event.shiftKey ? current : new Set();
                    return toggledMembership(base, name);
                  });
                }}
                onDoubleClick={() => listing !== null && onChoose([joinPath(listing.path, name)])}
              >
                <span>{kind === "video" ? "🎞" : "🖼"}</span>
                <span className="name">{name}</span>
              </div>
            ))}
          {listing !== null && listing.directories.length === 0 && (mode === "directory" || listedFiles.length === 0) && (
            <div className="list-item faint">Empty folder</div>
          )}
        </div>
        <div className="hint">
          {isMultiple
            ? `Browse the server's file system. Open a whole folder, or select ${mode === "media" ? "images and videos" : "images"} (Ctrl/⌘-click for several).`
            : mode === "directory"
              ? "Choose the folder on the server that receives the files."
              : "Choose an image on the server."}
        </div>
      </div>
    </Dialog>
  );
}
