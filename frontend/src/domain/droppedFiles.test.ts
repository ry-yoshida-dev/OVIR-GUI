import { describe, expect, it } from "vitest";
import {
  type DroppedFile,
  hasFiles,
  imageFilesOf,
  imageFilesOfList,
  isImagePath,
  isMediaPath,
  mediaFilesOf,
  mediaFilesOfList,
} from "@/domain/droppedFiles";

/**
 * A file picked from a folder, which the browser names by its path inside the folder.
 */
class FolderFile extends File {
  readonly webkitRelativePath: string;

  constructor(relativePath: string) {
    super(["data"], relativePath.slice(relativePath.lastIndexOf("/") + 1));
    this.webkitRelativePath = relativePath;
  }
}

/**
 * The parts of FileSystemEntry and its subtypes the drop reader uses.
 */
interface FakeEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (resolve: (file: File) => void, reject: (error: Error) => void) => void;
  createReader?: () => { readEntries: (resolve: (entries: FakeEntry[]) => void) => void };
}

interface FakeItem {
  kind: string;
  webkitGetAsEntry: () => FakeEntry | null;
}

function fileEntry(name: string): FakeEntry {
  return { name, isFile: true, isDirectory: false, file: (resolve) => resolve(new File(["data"], name)) };
}

function failingFileEntry(name: string): FakeEntry {
  return { name, isFile: true, isDirectory: false, file: (_, reject) => reject(new Error(`cannot read ${name}`)) };
}

/**
 * A directory whose reader hands out its children in the given batches, then an empty batch.
 */
function directoryEntry(name: string, ...batches: FakeEntry[][]): FakeEntry {
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => {
      const pending = [...batches];
      return { readEntries: (resolve) => resolve(pending.shift() ?? []) };
    },
  };
}

function entryItem(entry: FakeEntry | null): FakeItem {
  return { kind: "file", webkitGetAsEntry: () => entry };
}

function transferOf(options: { items?: FakeItem[]; files?: File[]; types?: string[] }): DataTransfer {
  const transfer = { items: options.items ?? [], files: options.files ?? [], types: options.types ?? [] };
  // DataTransfer and the file system entries exist only in browsers; the fakes carry the members the reader uses.
  return transfer as unknown as DataTransfer;
}

function fileListOf(files: File[]): FileList {
  // FileList exists only in browsers; the reader only iterates it, which an array supports.
  return files as unknown as FileList;
}

function namesOf(files: DroppedFile[]): string[] {
  return files.map((file) => file.name);
}

describe("isMediaPath and isImagePath", () => {
  it.each(["a.jpg", "a.JPEG", "a.png", "a.bmp", "a.webp", "a.tif", "a.TIFF", "dir/a.b.png"])(
    "accepts the image %s as media and as an image",
    (path) => {
      expect(isMediaPath(path)).toBe(true);
      expect(isImagePath(path)).toBe(true);
    },
  );

  it.each(["v.mp4", "v.MOV", "v.avi", "v.mkv", "v.webm", "v.m4v", "v.mpg", "v.mpeg", "v.wmv"])(
    "accepts the video %s as media but not as an image",
    (path) => {
      expect(isMediaPath(path)).toBe(true);
      expect(isImagePath(path)).toBe(false);
    },
  );

  it.each(["notes.txt", "png", "a.png.txt", "a.gif", "a.jpgx", "", "a.png "])("rejects %o", (path) => {
    expect(isMediaPath(path)).toBe(false);
    expect(isImagePath(path)).toBe(false);
  });
});

describe("hasFiles", () => {
  it("is true when the drag carries files", () => {
    expect(hasFiles(transferOf({ types: ["text/plain", "Files"] }))).toBe(true);
  });

  it("is false without files or without a transfer", () => {
    expect(hasFiles(transferOf({ types: ["text/plain"] }))).toBe(false);
    expect(hasFiles(transferOf({}))).toBe(false);
    expect(hasFiles(null)).toBe(false);
  });
});

describe("mediaFilesOfList and imageFilesOfList", () => {
  const files = [new File(["data"], "a.png"), new File(["data"], "v.mp4"), new File(["data"], "notes.txt")];

  it("keeps the media files in order", () => {
    const dropped = mediaFilesOfList(fileListOf(files));
    expect(namesOf(dropped)).toEqual(["a.png", "v.mp4"]);
    expect(dropped[0]?.file).toBe(files[0]);
  });

  it("keeps only the images", () => {
    expect(namesOf(imageFilesOfList(fileListOf(files)))).toEqual(["a.png"]);
  });

  it("names files picked from a folder by their path inside it", () => {
    const picked = [new FolderFile("shots/day1/a.png"), new FolderFile("shots/readme.md")];
    expect(namesOf(mediaFilesOfList(fileListOf(picked)))).toEqual(["shots/day1/a.png"]);
  });

  it("returns nothing for no list or an empty list", () => {
    expect(mediaFilesOfList(null)).toEqual([]);
    expect(imageFilesOfList(null)).toEqual([]);
    expect(mediaFilesOfList(fileListOf([]))).toEqual([]);
  });
});

describe("mediaFilesOf and imageFilesOf", () => {
  it("collects dropped files and the media inside dropped folders, named by their path", async () => {
    const transfer = transferOf({
      items: [
        entryItem(fileEntry("top.png")),
        entryItem(
          directoryEntry(
            "shots",
            [fileEntry("a.jpg"), fileEntry("notes.txt"), directoryEntry("day2", [fileEntry("b.mp4")])],
            [fileEntry("c.png")],
          ),
        ),
      ],
    });
    expect(namesOf(await mediaFilesOf(transfer))).toEqual(["top.png", "shots/a.jpg", "shots/day2/b.mp4", "shots/c.png"]);
  });

  it("keeps only images when asked for images", async () => {
    const transfer = transferOf({
      items: [entryItem(directoryEntry("shots", [fileEntry("a.jpg"), fileEntry("b.mp4")]))],
    });
    expect(namesOf(await imageFilesOf(transfer))).toEqual(["shots/a.jpg"]);
  });

  it("skips hidden files and hidden folders", async () => {
    const transfer = transferOf({
      items: [
        entryItem(fileEntry(".hidden.png")),
        entryItem(directoryEntry(".cache", [fileEntry("a.png")])),
        entryItem(directoryEntry("shots", [fileEntry("._b.png"), fileEntry("c.png")])),
      ],
    });
    expect(namesOf(await mediaFilesOf(transfer))).toEqual(["shots/c.png"]);
  });

  it("ignores items that are not files or have no entry", async () => {
    const transfer = transferOf({
      items: [
        { kind: "string", webkitGetAsEntry: () => fileEntry("text.png") },
        entryItem(null),
        entryItem(fileEntry("a.png")),
      ],
    });
    expect(namesOf(await mediaFilesOf(transfer))).toEqual(["a.png"]);
  });

  it("returns nothing for an empty folder", async () => {
    const transfer = transferOf({ items: [entryItem(directoryEntry("empty"))] });
    expect(await mediaFilesOf(transfer)).toEqual([]);
  });

  it("falls back to the plain file list when no entries are available", async () => {
    const files = [new File(["data"], "a.png"), new File(["data"], "notes.txt"), new File(["data"], "v.mov")];
    const transfer = transferOf({ items: [entryItem(null)], files });
    const dropped = await mediaFilesOf(transfer);
    expect(namesOf(dropped)).toEqual(["a.png", "v.mov"]);
    expect(dropped[0]?.file).toBe(files[0]);
    expect(namesOf(await imageFilesOf(transfer))).toEqual(["a.png"]);
  });

  it("returns nothing for an empty drop", async () => {
    expect(await mediaFilesOf(transferOf({}))).toEqual([]);
  });

  it("fails when a dropped file cannot be read", async () => {
    const transfer = transferOf({ items: [entryItem(failingFileEntry("a.png"))] });
    await expect(mediaFilesOf(transfer)).rejects.toThrow("cannot read a.png");
  });
});
