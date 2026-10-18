import type {
  ActionReply,
  ClassSetListEntry,
  ClassSetPreview,
  DirectoryListing,
  ExportPlan,
  FramePayload,
  ModelSelection,
  PictureFindings,
  ReferenceDraft,
  ResultsPayload,
  StatisticsPayload,
  TimelinePayload,
  VideoFramesPayload,
  WorkspaceState,
} from "./types";

export class ApiError extends Error {}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  const response = await fetch(url, init);
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        detail = JSON.stringify(payload.detail);
      }
    } catch {
      /* the body is not JSON */
    }
    throw new ApiError(detail);
  }
  return (await response.json()) as T;
}

const get = <T>(url: string) => request<T>("GET", url);
const post = <T = unknown>(url: string, body?: unknown) => request<T>("POST", url, body ?? {});
const put = <T = unknown>(url: string, body: unknown) => request<T>("PUT", url, body);
const remove = <T = unknown>(url: string) => request<T>("DELETE", url);

const query = (parameters: Record<string, string>) => new URLSearchParams(parameters).toString();

export const api = {
  state: () => get<WorkspaceState>("/api/state"),
  results: () => get<ResultsPayload>("/api/results"),
  frame: (path: string, frame: number | null) =>
    get<FramePayload>(`/api/frame?${query(frame === null ? { path } : { path, frame: String(frame) })}`),
  timeline: (path: string) => get<TimelinePayload>(`/api/timeline?${query({ path })}`),
  videoFrames: (path: string) => get<VideoFramesPayload>(`/api/video-frames?${query({ path })}`),
  statistics: () => get<StatisticsPayload>("/api/statistics"),

  openPaths: (paths: string[]) => post("/api/media/open", { paths }),
  closeMedia: (paths: string[]) => post("/api/media/close", { paths }),
  show: (path: string, frame: number | null) => post("/api/media/show", { path, frame }),
  setSampling: (frameStep: number) => put("/api/sampling", { frame_step: frameStep }),
  setBackground: (scope: string) => put("/api/background", { scope }),
  upload: (files: { file: File; name: string }[], isFirstShown: boolean) => {
    const form = new FormData();
    for (const entry of files) {
      form.append("files", entry.file, entry.name);
    }
    return post(`/api/uploads?${query({ is_first_shown: String(isFirstShown) })}`, form);
  },
  files: (path?: string) => get<DirectoryListing>(`/api/files${path === undefined ? "" : `?${query({ path })}`}`),
  imageUrl: (path: string, version: string | null) => `/api/media/image?${query({ path, v: version ?? "" })}`,
  videoUrl: (path: string, version: string | null) => `/api/media/video?${query({ path, v: version ?? "" })}`,
  frameUrl: (path: string, frame: number, version: string | null) =>
    `/api/media/frame?${query({ path, frame: String(frame), v: version ?? "" })}`,

  selectTask: (task: string) => put("/api/task", { task }),
  selectModel: (selection: ModelSelection) => put("/api/model", selection),
  selectPreset: (backend: string, presetName: string) => put("/api/model/preset", { backend, preset_name: presetName }),
  run: (isSkippingApproved = false) => post<ActionReply>("/api/run", { is_skipping_approved: isSkippingApproved }),
  runMedia: (isSkippingApproved = false) =>
    post<ActionReply>("/api/run-media", { is_skipping_approved: isSkippingApproved }),
  runAll: (isSkippingApproved = false) =>
    post<ActionReply>("/api/run-all", { is_skipping_approved: isSkippingApproved }),
  updateOutdated: (isSkippingApproved = false) =>
    post<ActionReply>("/api/update-outdated", { is_skipping_approved: isSkippingApproved }),
  cancel: () => post("/api/cancel"),

  selectProfile: (key: string) => post("/api/profiles/select", { key }),
  removeProfile: (key: string) => post("/api/profiles/remove", { key }),
  clearResults: () => post("/api/profiles/clear"),
  compare: (key: string | null) => put("/api/comparison", { key }),
  setAccepted: (findings: PictureFindings[], isAccepted: boolean) =>
    post("/api/findings/acceptance", { findings, is_accepted: isAccepted }),
  setThresholds: (defaultMinimum: number, classMinimums: Record<string, number>) =>
    put("/api/thresholds", { default_minimum: defaultMinimum, class_minimums: classMinimums }),
  tableCsv: async (findings: { path: string; frame: number | null; index: number }[]) => {
    const response = await fetch("/api/findings/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findings }),
    });
    if (!response.ok) {
      throw new ApiError(`${response.status} ${response.statusText}`);
    }
    return response.blob();
  },

  addClassRow: (text: string, classIndex: number | null, position: number) =>
    post("/api/classes/rows", { text, class_index: classIndex, position }),
  renameClass: (classIndex: number, name: string) => put(`/api/classes/${classIndex}/name`, { name }),
  renamePhrase: (classIndex: number, phraseIndex: number, text: string) =>
    put(`/api/classes/${classIndex}/phrases/${phraseIndex}`, { text }),
  removeClassRows: (body: {
    class_indices: number[];
    phrases: { class_index: number; phrase_index: number }[];
    references: { class_index: number; name: string; digest: string }[];
  }) => post("/api/classes/remove", body),
  movePhrase: (classIndex: number, phraseIndex: number, targetClassIndex: number | null, position: number) =>
    post("/api/classes/move-phrase", {
      class_index: classIndex,
      phrase_index: phraseIndex,
      target_class_index: targetClassIndex,
      position,
    }),
  moveReference: (classIndex: number, name: string, digest: string, targetClassIndex: number) =>
    post("/api/classes/move-reference", { class_index: classIndex, name, digest, target_class_index: targetClassIndex }),
  replaceClassesText: (text: string) => put("/api/classes/text", { text }),
  clearClasses: () => post("/api/classes/clear"),
  loadClassFile: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return post("/api/classes/file", form);
  },
  referenceImageUrl: (name: string, digest: string) => `/api/references/image?${query({ name, digest })}`,
  uploadReference: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return post<ReferenceDraft>("/api/references/drafts", form);
  },
  openReference: (path: string) => post<ReferenceDraft>("/api/references/drafts/path", { path }),
  currentReference: () => post<ReferenceDraft>("/api/references/drafts/current"),
  draftImageUrl: (draftId: string) => `/api/references/drafts/${encodeURIComponent(draftId)}/image`,
  addReference: (draftId: string, classIndex: number, boxes: number[][]) =>
    post("/api/references", { draft_id: draftId, class_index: classIndex, boxes }),

  classSets: () => get<{ entries: ClassSetListEntry[] }>("/api/class-sets"),
  classSetPreview: (name: string) => get<ClassSetPreview>(`/api/class-sets/${encodeURIComponent(name)}`),
  classSetImageUrl: (name: string, imageName: string, digest: string) =>
    `/api/class-sets/${encodeURIComponent(name)}/image?${query({ image_name: imageName, digest })}`,
  saveClassSet: (name: string) => post("/api/class-sets/save", { name }),
  loadClassSet: (name: string) => post("/api/class-sets/load", { name }),
  renameClassSet: (name: string, newName: string) =>
    put(`/api/class-sets/${encodeURIComponent(name)}`, { name: newName }),
  deleteClassSet: (name: string) => remove(`/api/class-sets/${encodeURIComponent(name)}`),
  importClassSet: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return post("/api/class-sets/import", form);
  },
  classSetFileUrl: (name: string) => `/api/class-sets/${encodeURIComponent(name)}/file`,

  exportPlan: () => get<ExportPlan>("/api/export/plan"),
  exportResults: (body: {
    export_format: string;
    output_directory: string;
    is_confidence_included: boolean;
    scope: string;
    minimum_confidence: number;
    is_annotated_image_saved: boolean;
    is_annotated_video_saved: boolean;
    listed_findings: PictureFindings[] | null;
    is_label_confidence_shown: boolean;
    is_skipping_approved: boolean;
  }) => post<ActionReply>("/api/export", body),
  exportDownloadUrl: "/api/export/download",
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
