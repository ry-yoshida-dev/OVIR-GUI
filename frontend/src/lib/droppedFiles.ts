const MEDIA_PATTERN = /\.(jpe?g|png|bmp|webp|tiff?|mp4|mov|avi|mkv|webm|m4v|mpe?g|wmv)$/i;
const IMAGE_PATTERN = /\.(jpe?g|png|bmp|webp|tiff?)$/i;

export interface DroppedFile {
  file: File;
  name: string;
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

function fileOf(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function collect(entry: FileSystemEntry, prefix: string, pattern: RegExp, files: DroppedFile[]): Promise<void> {
  if (entry.isFile) {
    if (pattern.test(entry.name) && !entry.name.startsWith(".")) {
      files.push({ file: await fileOf(entry as FileSystemFileEntry), name: `${prefix}${entry.name}` });
    }
    return;
  }
  if (!entry.isDirectory || entry.name.startsWith(".")) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const entries = await readEntries(reader);
    if (entries.length === 0) break;
    for (const child of entries) {
      await collect(child, `${prefix}${entry.name}/`, pattern, files);
    }
  }
}

async function filesOf(transfer: DataTransfer, pattern: RegExp): Promise<DroppedFile[]> {
  const entries = [...transfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);
  if (entries.length === 0) {
    return [...transfer.files].filter((file) => pattern.test(file.name)).map((file) => ({ file, name: file.name }));
  }
  const files: DroppedFile[] = [];
  for (const entry of entries) {
    await collect(entry, "", pattern, files);
  }
  return files;
}

export function mediaFilesOf(transfer: DataTransfer): Promise<DroppedFile[]> {
  return filesOf(transfer, MEDIA_PATTERN);
}

export function imageFilesOf(transfer: DataTransfer): Promise<DroppedFile[]> {
  return filesOf(transfer, IMAGE_PATTERN);
}

function filesOfList(list: FileList | null, pattern: RegExp): DroppedFile[] {
  return [...(list ?? [])]
    .filter((file) => pattern.test(file.name))
    .map((file) => ({ file, name: file.webkitRelativePath || file.name }));
}

export function mediaFilesOfList(list: FileList | null): DroppedFile[] {
  return filesOfList(list, MEDIA_PATTERN);
}

export function imageFilesOfList(list: FileList | null): DroppedFile[] {
  return filesOfList(list, IMAGE_PATTERN);
}

export function isMediaPath(path: string): boolean {
  return MEDIA_PATTERN.test(path);
}

export function isImagePath(path: string): boolean {
  return IMAGE_PATTERN.test(path);
}

export function hasFiles(transfer: DataTransfer | null): boolean {
  return transfer !== null && [...transfer.types].includes("Files");
}
