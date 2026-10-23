import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, errorMessage } from "../api/client";
import { isAnyDialogOpen } from "../components/Dialog";
import {
  type DroppedFile,
  hasFiles,
  mediaFilesOf,
  mediaFilesOfList,
} from "../lib/droppedFiles";

export interface UploadProgress {
  done: number;
  total: number;
}

export interface MediaUpload {
  progress: UploadProgress | null;
  isDragOver: boolean;
  pickers: ReactNode;
  chooseFiles: () => void;
  chooseFolder: () => void;
}

const UPLOAD_CHUNK_FILE_COUNT = 8;
const UPLOAD_CHUNK_BYTE_LIMIT = 256 * 1024 * 1024;

function nextChunk(files: DroppedFile[], start: number): DroppedFile[] {
  const chunk: DroppedFile[] = [];
  let size = 0;
  while (
    start + chunk.length < files.length &&
    chunk.length < UPLOAD_CHUNK_FILE_COUNT
  ) {
    const next = files[start + chunk.length];
    if (
      next === undefined ||
      (chunk.length > 0 && size + next.file.size > UPLOAD_CHUNK_BYTE_LIMIT)
    )
      break;
    chunk.push(next);
    size += next.file.size;
  }
  return chunk;
}

/**
 * Uploads media chosen in the hidden file pickers it renders, or dropped anywhere on the window while no dialog is
 * open, in chunks.
 */
export function useMediaUpload(
  report: (text: string) => void,
  acceptedSuffixes: string[],
): MediaUpload {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: DroppedFile[]) => {
      if (files.length === 0) {
        report("No images or videos found in what was dropped.");
        return;
      }
      setProgress({ done: 0, total: files.length });
      try {
        let start = 0;
        while (start < files.length) {
          const chunk = nextChunk(files, start);
          await api.upload(chunk, start === 0);
          start += chunk.length;
          setProgress({ done: start, total: files.length });
        }
      } catch (error) {
        report(`Upload failed: ${errorMessage(error)}`);
      } finally {
        setProgress(null);
      }
    },
    [report],
  );

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event.dataTransfer) || isAnyDialogOpen()) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDragOver(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragOver(false);
    };
    const onDrop = (event: DragEvent) => {
      dragDepth.current = 0;
      setIsDragOver(false);
      if (!hasFiles(event.dataTransfer) || event.dataTransfer === null) return;
      event.preventDefault();
      if (isAnyDialogOpen()) return;
      void mediaFilesOf(event.dataTransfer).then(uploadFiles);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [uploadFiles]);

  const uploadChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = mediaFilesOfList(event.target.files);
    event.target.value = "";
    void uploadFiles(files);
  };

  return {
    progress,
    isDragOver,
    pickers: (
      <>
        <input
          ref={fileInput}
          type="file"
          accept={["image/*", "video/*", ...acceptedSuffixes].join(",")}
          multiple
          hidden
          onChange={uploadChosen}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          {...{ webkitdirectory: "" }}
          onChange={uploadChosen}
        />
      </>
    ),
    chooseFiles: () => fileInput.current?.click(),
    chooseFolder: () => folderInput.current?.click(),
  };
}
