import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "./api/client";
import type {
  ActionReply,
  CurrentPicture,
  DuplicateSuppression,
  FramePayload,
  LicenseEntry,
  MediaEntry,
  ModelSelection,
  PictureFindings,
  TaskValue,
  TimelinePayload,
  Thresholds,
} from "./api/types";
import { AddMediaMenu } from "./components/AddMediaMenu";
import { BinderShape } from "./components/BinderShape";
import { BinderTabs } from "./components/BinderTabs";
import {
  type CenterMode,
  CenterModeToggle,
} from "./components/CenterModeToggle";
import { ClassEditor } from "./components/ClassEditor";
import { ClassesGlyph } from "./components/ClassesGlyph";
import { ClassificationGallery } from "./components/ClassificationGallery";
import { ClassSetDialog } from "./components/ClassSetDialog";
import { ClassTextDialog } from "./components/ClassTextDialog";
import { ConnectionIndicator } from "./components/ConnectionIndicator";
import { useDialogs } from "./components/DialogHost";
import { type ExportChoice, ExportDialog } from "./components/ExportDialog";
import { ExportGlyph } from "./components/ExportGlyph";
import { FindingsGlyph } from "./components/FindingsGlyph";
import { GearGlyph } from "./components/GearGlyph";
import { InferenceSettings } from "./components/InferenceSettings";
import { InfoTip } from "./components/InfoTip";
import { MediaGlyph } from "./components/MediaGlyph";
import { MediaKindBadges } from "./components/MediaKindBadges";
import { MediaList } from "./components/MediaList";
import { type MenuEntry, useMenu } from "./components/Menu";
import { ModelGlyph } from "./components/ModelGlyph";
import { ModelPanel } from "./components/ModelPanel";
import { PaneHeader } from "./components/PaneHeader";
import { PopoverButton } from "./components/PopoverButton";
import { ProfileTable } from "./components/ProfileTable";
import { ReviewPanel } from "./components/ReviewPanel";
import { PromptToolbar } from "./components/PromptToolbar";
import { ReferenceDialog } from "./components/ReferenceDialog";
import { ResultTable } from "./components/ResultTable";
import { ResultViewer } from "./components/ResultViewer";
import { InferControl } from "./components/InferControl";
import { Section } from "./components/Section";
import { ServerBrowserDialog } from "./components/ServerBrowserDialog";
import { SlidersGlyph } from "./components/SlidersGlyph";
import { Splitter } from "./components/Splitter";
import { StatisticsGlyph } from "./components/StatisticsGlyph";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { StatusBar } from "./components/StatusBar";
import { VideoControls } from "./components/VideoControls";
import { VideoFindingsPanel } from "./components/VideoFindingsPanel";
import { ViewSettings } from "./components/ViewSettings";
import { useDraftValue } from "./hooks/useDraftValue";
import { useEmbedBridge } from "./hooks/useEmbedBridge";
import { useLicenseGate } from "./hooks/useLicenseGate";
import { usePicturePromptEditor } from "./hooks/usePicturePromptEditor";
import { useStoredState } from "./hooks/useStoredState";
import { useWorkspace } from "./hooks/useWorkspace";
import {
  DEFAULT_DISPLAY_OPTIONS,
  type DisplayOptions,
} from "./lib/displayOptions";
import {
  type DroppedFile,
  hasFiles,
  mediaFilesOf,
  mediaFilesOfList,
} from "./lib/droppedFiles";
import { ReviewFilter } from "./lib/reviewFilter";
import { FrameResultIndex } from "./lib/frameResultIndex";
import { orderMedia } from "./lib/mediaGroups";
import { PlaybackPosition } from "./lib/playbackPosition";
import {
  buildRows,
  filterOfScope,
  filterRows,
  groupFindings,
  isRowInScope,
  listedIndices,
  pictureKeyOf,
  rowKeyOf,
  type SortOrder,
  sortRows,
  type TableFilter,
  type TableRow,
} from "./lib/resultTable";
import { TASK_ORDER, taskViewOf } from "./lib/taskViews";

interface Layout {
  sidebarWidth: number;
  rightWidth: number;
  profileHeight: number;
  reviewHeight: number;
  videoResultsHeight: number;
  collapsedSections: string[];
}

interface CenterLayout {
  mode: CenterMode;
}

interface FrameRequest {
  path: string;
  frame: number;
}

const DEFAULT_LAYOUT: Layout = {
  sidebarWidth: 330,
  rightWidth: 560,
  profileHeight: 160,
  reviewHeight: 360,
  videoResultsHeight: 300,
  collapsedSections: [],
};
const DEFAULT_CENTER_LAYOUT: CenterLayout = { mode: "gallery" };
const UPLOAD_CHUNK_SIZE = 8;
const LOCAL_MESSAGE_MILLISECONDS = 7000;
const SHOW_THROTTLE_MILLISECONDS = 150;
const VIDEO_RESULTS_DEBOUNCE_MILLISECONDS = 200;
const LIVE_RESULTS_DEBOUNCE_MILLISECONDS = 30;
const LIVE_FETCH_SAMPLES = 120;
const NO_LICENSES: LicenseEntry[] = [];

type OpenDialog =
  | { kind: "browse" }
  | { kind: "export" }
  | { kind: "class-sets" }
  | { kind: "class-text" }
  | { kind: "reference"; classIndex: number }
  | null;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function timestampOf(frame: number, fps: number): string {
  const seconds = frame / fps;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, "0")}`;
}

export function App() {
  const workspace = useWorkspace();
  const { state, results, resultsVersion } = workspace;
  const dialogs = useDialogs();
  const menu = useMenu();
  const [layout, setLayout] = useStoredState<Layout>(
    "ovir-gui.layout",
    DEFAULT_LAYOUT,
  );
  const [display, setDisplay] = useStoredState<DisplayOptions>(
    "ovir-gui.display",
    DEFAULT_DISPLAY_OPTIONS,
  );
  const [centerLayout, setCenterLayout] = useStoredState<CenterLayout>(
    "ovir-gui.center",
    DEFAULT_CENTER_LAYOUT,
  );
  const [filter, setFilter] = useState<TableFilter>({});
  const [order, setOrder] = useState<SortOrder | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [localMessage, setLocalMessage] = useState<{
    text: string;
    serial: number;
  } | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFrame, setPendingFrame] = useState<FrameRequest | null>(null);
  const [framePayload, setFramePayload] = useState<FramePayload | null>(null);
  const [timeline, setTimeline] = useState<TimelinePayload | null>(null);
  const [videoResults, setVideoResults] = useState<{
    path: string;
    index: FrameResultIndex;
  } | null>(null);
  const [liveRequest, setLiveRequest] = useState<{
    path: string;
    serial: number;
    isBusySeen: boolean;
  } | null>(null);
  const [followRequest, setFollowRequest] = useState<{
    path: string;
    serial: number;
    isFollowed: boolean;
  } | null>(null);
  const liveSerial = useRef(0);
  const isAutoInferenceRunning =
    (state?.inference.is_auto ?? false) &&
    state?.inference.pause_reason === null;
  const isAutoInferenceRunningRef = useRef(isAutoInferenceRunning);
  isAutoInferenceRunningRef.current = isAutoInferenceRunning;
  const videoResultsRef = useRef(videoResults);
  videoResultsRef.current = videoResults;
  const [unplayableSources, setUnplayableSources] = useState<
    ReadonlySet<string>
  >(new Set());
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const messageSerial = useRef(0);
  const showTimer = useRef<number | undefined>(undefined);
  const lastShowAt = useRef(0);

  const report = useCallback((text: string) => {
    messageSerial.current += 1;
    const serial = messageSerial.current;
    setLocalMessage({ text, serial });
    window.setTimeout(
      () =>
        setLocalMessage((current) =>
          current?.serial === serial ? null : current,
        ),
      LOCAL_MESSAGE_MILLISECONDS,
    );
  }, []);

  const call = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        return true;
      } catch (error) {
        report(errorMessage(error));
        return false;
      }
    },
    [report],
  );
  const promptEditor = usePicturePromptEditor({ state, call, report });
  const ensureLicenses = useLicenseGate(
    state?.model.licenses ?? NO_LICENSES,
    report,
  );
  const selectPreset = useCallback(
    async (backend: string, presetName: string) => {
      const licenses =
        state?.model.backends
          .find((entry) => entry.value === backend)
          ?.presets.find((preset) => preset.name === presetName)?.licenses ??
        [];
      if (await ensureLicenses(licenses))
        await call(() => api.selectPreset(backend, presetName));
    },
    [state, ensureLicenses, call],
  );
  const selectModel = useCallback(
    async (selection: ModelSelection) => {
      const licenses =
        state?.model.box_detectors.find(
          (entry) => entry.label === selection.box_detector_label,
        )?.licenses ?? [];
      if (await ensureLicenses(licenses))
        await call(() => api.selectModel(selection));
    },
    [state, ensureLicenses, call],
  );
  const commitThresholds = useCallback(
    (thresholds: Thresholds) => call(() => api.setThresholds(thresholds)),
    [call],
  );
  const commitSuppression = useCallback(
    (suppression: DuplicateSuppression) =>
      call(() => api.setSuppression(suppression)),
    [call],
  );
  const draftThresholds = useDraftValue(
    state?.thresholds ?? null,
    commitThresholds,
  );
  const draftSuppression = useDraftValue(
    state?.suppression ?? null,
    commitSuppression,
  );
  const reviewFilter = useMemo(
    () =>
      draftThresholds.value === null || draftSuppression.value === null
        ? null
        : new ReviewFilter(draftThresholds.value, draftSuppression.value),
    [draftThresholds.value, draftSuppression.value],
  );
  const draftFilter =
    draftThresholds.isDraft || draftSuppression.isDraft ? reviewFilter : null;
  const markedResults = useMemo(
    () =>
      draftFilter === null || results === null
        ? results
        : draftFilter.markedResults(results),
    [draftFilter, results],
  );
  const markedFramePayload = useMemo(
    () =>
      draftFilter === null || framePayload === null
        ? framePayload
        : draftFilter.markedFrame(framePayload),
    [draftFilter, framePayload],
  );

  const runAction = useCallback(
    async (
      action: (isSkippingApproved: boolean) => Promise<ActionReply>,
    ): Promise<boolean> => {
      try {
        let reply = await action(false);
        if (reply.status === "needs_approval") {
          const isApproved = await dialogs.confirm({
            title: "Skip reference-only classes?",
            message: reply.message,
            confirmLabel: "Infer Without Them",
          });
          if (!isApproved) return false;
          reply = await action(true);
        }
        if (reply.status === "rejected") {
          report(reply.message);
          return false;
        }
        return reply.status === "done";
      } catch (error) {
        report(errorMessage(error));
        return false;
      }
    },
    [dialogs, report],
  );

  const serverCurrent = state?.current ?? null;
  const current: CurrentPicture | null = useMemo(() => {
    if (serverCurrent === null) return null;
    if (
      pendingFrame === null ||
      pendingFrame.path !== serverCurrent.path ||
      serverCurrent.kind !== "video"
    ) {
      return serverCurrent;
    }
    const frameStep = state?.sampling.frame_step ?? 1;
    return {
      ...serverCurrent,
      frame: pendingFrame.frame,
      timestamp: timestampOf(pendingFrame.frame, serverCurrent.fps ?? 30),
      is_sampled: pendingFrame.frame % frameStep === 0,
    };
  }, [serverCurrent, pendingFrame, state?.sampling.frame_step]);
  const currentPath = current?.path ?? null;
  const currentFrame = current?.frame ?? null;
  const isVideo = current?.kind === "video";
  const [lastVideoPath, setLastVideoPath] = useState<string | null>(null);
  useEffect(() => {
    if (isVideo && currentPath !== null) setLastVideoPath(currentPath);
  }, [isVideo, currentPath]);
  const chartedVideo: MediaEntry | null = useMemo(() => {
    const videos = state?.media.filter((entry) => entry.kind === "video") ?? [];
    const preferredPath = isVideo ? currentPath : lastVideoPath;
    return (
      videos.find((entry) => entry.path === preferredPath) ?? videos[0] ?? null
    );
  }, [state?.media, isVideo, currentPath, lastVideoPath]);
  const chartedVideoPath = chartedVideo?.path ?? null;
  const task: TaskValue = state?.task.value ?? "detection";

  useEffect(() => {
    if (pendingFrame === null || serverCurrent === null) return;
    if (
      serverCurrent.path !== pendingFrame.path ||
      serverCurrent.frame === pendingFrame.frame
    )
      setPendingFrame(null);
  }, [serverCurrent, pendingFrame]);

  const frameRefreshToken = `${state?.shown_profile_key}:${state?.compared_profile_key}:${JSON.stringify(state?.thresholds)}:${resultsVersion}:${state?.status.serial}`;
  useEffect(() => {
    if (currentPath === null) {
      setFramePayload(null);
      return;
    }
    let isCurrent = true;
    api
      .frame(currentPath, currentFrame)
      .then((loaded) => {
        if (isCurrent) setFramePayload(loaded);
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [currentPath, currentFrame, frameRefreshToken]);

  const timelineToken = `${state?.shown_profile_key}:${JSON.stringify(state?.thresholds)}:${resultsVersion}:${state?.sampling.frame_step}:${state?.classes.length}`;
  useEffect(() => {
    if (currentPath === null || !isVideo) {
      setTimeline(null);
      return;
    }
    let isCurrent = true;
    const timer = window.setTimeout(() => {
      api
        .timeline(currentPath)
        .then((loaded) => {
          if (isCurrent) setTimeline(loaded);
        })
        .catch(() => undefined);
    }, 120);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [currentPath, isVideo, timelineToken]);

  const playback = current?.playback ?? "none";
  const playedSource = `${currentPath}|${playback}`;
  const isVideoPlayerUsed =
    isVideo &&
    currentPath !== null &&
    playback !== "preparing" &&
    !unplayableSources.has(playedSource) &&
    promptEditor.drawing === null;
  const playbackPosition = useMemo(() => new PlaybackPosition(), [currentPath]);
  const isRecognitionRunning = state?.is_busy ?? false;
  const frameStep = state?.sampling.frame_step ?? 1;
  const isInferAllLive =
    liveRequest !== null &&
    liveRequest.path === currentPath &&
    (isRecognitionRunning || !liveRequest.isBusySeen);
  const isPlaybackFollowed =
    followRequest !== null &&
    followRequest.path === currentPath &&
    followRequest.isFollowed &&
    isAutoInferenceRunning;
  const isLiveRunning = isInferAllLive || isPlaybackFollowed;
  const live = useMemo(() => {
    if (liveRequest !== null && liveRequest.path === currentPath)
      return {
        serial: liveRequest.serial,
        isRunning: isInferAllLive,
        frameStep,
      };
    if (followRequest !== null && followRequest.path === currentPath)
      return {
        serial: followRequest.serial,
        isRunning: isPlaybackFollowed,
        frameStep,
      };
    return null;
  }, [
    liveRequest,
    followRequest,
    currentPath,
    isInferAllLive,
    isPlaybackFollowed,
    frameStep,
  ]);

  useEffect(() => {
    setLiveRequest((request) => {
      if (request === null) return null;
      if (isRecognitionRunning)
        return request.isBusySeen ? request : { ...request, isBusySeen: true };
      return request.isBusySeen ? null : request;
    });
  }, [isRecognitionRunning, liveRequest?.serial]);

  useEffect(() => {
    setLiveRequest((request) =>
      request !== null && request.path !== currentPath ? null : request,
    );
    setFollowRequest((request) =>
      request !== null && request.path !== currentPath ? null : request,
    );
  }, [currentPath]);

  useEffect(() => {
    if (chartedVideoPath === null) {
      setVideoResults(null);
      return;
    }
    const path = chartedVideoPath;
    const known = videoResultsRef.current;
    const isIncremental =
      isLiveRunning &&
      path === currentPath &&
      known !== null &&
      known.path === path;
    const range = (() => {
      if (!isIncremental) return null;
      const position = playbackPosition.current() ?? 0;
      const afterFrame =
        known.index.coveredUntil(position, frameStep) ?? position - 1;
      return {
        afterFrame,
        untilFrame: afterFrame + frameStep * LIVE_FETCH_SAMPLES,
      };
    })();
    let isCurrent = true;
    const timer = window.setTimeout(
      () => {
        api
          .videoFrames(path, range)
          .then((loaded) => {
            if (!isCurrent) return;
            setVideoResults((previous) =>
              range !== null &&
              previous !== null &&
              previous.path === loaded.path
                ? { path: loaded.path, index: previous.index.merged(loaded) }
                : { path: loaded.path, index: new FrameResultIndex(loaded) },
            );
          })
          .catch(() => undefined);
      },
      isIncremental
        ? LIVE_RESULTS_DEBOUNCE_MILLISECONDS
        : VIDEO_RESULTS_DEBOUNCE_MILLISECONDS,
    );
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [
    chartedVideoPath,
    currentPath,
    frameRefreshToken,
    isLiveRunning,
    frameStep,
    playbackPosition,
  ]);

  const runAll = useCallback(async () => {
    const path = currentPath;
    const startFrame = isVideo
      ? (playbackPosition.current() ?? current?.frame ?? null)
      : null;
    const isStarted = await runAction((isSkippingApproved) =>
      api.runAll(isSkippingApproved, startFrame),
    );
    if (isStarted && isVideo && path !== null) {
      liveSerial.current += 1;
      setLiveRequest({
        path,
        serial: liveSerial.current,
        isBusySeen: false,
      });
    }
  }, [currentPath, isVideo, current?.frame, playbackPosition, runAction]);

  const show = useCallback(
    (path: string, frame: number | null) => {
      window.clearTimeout(showTimer.current);
      if (frame !== null) setPendingFrame({ path, frame });
      lastShowAt.current = Date.now();
      void call(() => api.show(path, frame));
    },
    [call],
  );

  const showThrottled = useCallback(
    (path: string, frame: number, isPlaying: boolean, isFinal: boolean) => {
      setPendingFrame({ path, frame });
      window.clearTimeout(showTimer.current);
      const send = () => {
        lastShowAt.current = Date.now();
        void call(async () => {
          const reply = await api.show(path, frame, isPlaying);
          if (!isPlaying) return;
          setFollowRequest((request) =>
            request !== null && request.path === path
              ? { ...request, isFollowed: reply.is_following_playback }
              : request,
          );
        });
      };
      const elapsed = Date.now() - lastShowAt.current;
      if (isFinal || elapsed >= SHOW_THROTTLE_MILLISECONDS) send();
      else
        showTimer.current = window.setTimeout(
          send,
          SHOW_THROTTLE_MILLISECONDS - elapsed,
        );
    },
    [call],
  );

  const seek = useCallback(
    (frame: number, isFinal: boolean) => {
      if (currentPath === null) return;
      setFollowRequest(null);
      showThrottled(currentPath, frame, false, isFinal);
    },
    [currentPath, showThrottled],
  );

  const follow = useCallback(
    (frame: number, isStart: boolean) => {
      if (currentPath === null) return;
      const path = currentPath;
      liveSerial.current += 1;
      const serial = liveSerial.current;
      setFollowRequest((request) =>
        request !== null && request.path === path
          ? request
          : { path, serial, isFollowed: isAutoInferenceRunningRef.current },
      );
      showThrottled(path, frame, true, isStart);
    },
    [currentPath, showThrottled],
  );

  const hasImages =
    state?.media.some((entry) => entry.kind === "image") ?? false;
  const hasVideos =
    state?.media.some((entry) => entry.kind === "video") ?? false;
  const isImageResultsShown = hasImages || !hasVideos;

  const chartedVideoResults = useMemo(() => {
    if (videoResults === null || videoResults.path !== chartedVideoPath)
      return null;
    return draftFilter === null
      ? videoResults.index
      : draftFilter.markedVideo(videoResults.index);
  }, [videoResults, chartedVideoPath, draftFilter]);
  const isChartedVideoCurrent =
    chartedVideoPath !== null && chartedVideoPath === currentPath;
  const currentVideoResults = isChartedVideoCurrent
    ? chartedVideoResults
    : null;

  const allRows = useMemo(
    () => buildRows(markedResults, display.belowMinimum),
    [markedResults, display.belowMinimum],
  );
  const filteredRows = useMemo(
    () => filterRows(allRows, filter),
    [allRows, filter],
  );
  const rows = useMemo(
    () => sortRows(filteredRows, order),
    [filteredRows, order],
  );
  const imageScopedRows = useMemo(
    () => allRows.filter((row) => isRowInScope(row, "images")),
    [allRows],
  );
  const imageRows = useMemo(
    () =>
      sortRows(
        filterRows(imageScopedRows, filterOfScope(filter, "images")),
        order,
      ),
    [imageScopedRows, filter, order],
  );
  const videoScopedRows = useMemo(
    () => allRows.filter((row) => isRowInScope(row, "videos")),
    [allRows],
  );
  const videoRows = useMemo(
    () =>
      sortRows(
        filterRows(videoScopedRows, filterOfScope(filter, "videos")),
        order,
      ),
    [videoScopedRows, filter, order],
  );
  const listedFindingRows = useMemo(
    () =>
      [
        ...(isImageResultsShown ? imageRows : []),
        ...(hasVideos ? videoRows : []),
      ].filter((row) => row.kind === "finding" && row.finding.is_passing),
    [isImageResultsShown, imageRows, hasVideos, videoRows],
  );
  const listed = useMemo(
    () => listedIndices(filterRows(allRows, filter)),
    [allRows, filter],
  );
  const isFiltered = Object.keys(filter).length > 0;

  const resultPictureKey =
    framePayload === null || framePayload.path !== currentPath
      ? null
      : pictureKeyOf(framePayload.path, framePayload.result_frame);
  const selectedRow =
    imageRows.find((row) => row.key === selectedRowKey) ??
    videoRows.find((row) => row.key === selectedRowKey) ??
    rows.find((row) => row.key === selectedRowKey) ??
    null;
  const highlightedIndex =
    selectedRow?.kind === "finding" &&
    pictureKeyOf(selectedRow.path, selectedRow.frame) === resultPictureKey
      ? selectedRow.finding.index
      : null;
  const classColors = useMemo(
    () =>
      Object.fromEntries(
        (state?.classes ?? []).map((entry) => [entry.name, entry.color]),
      ),
    [state?.classes],
  );

  const orderedMedia = useMemo(
    () => orderMedia(state?.media ?? []),
    [state?.media],
  );

  const currentMediaIndex = orderedMedia.findIndex(
    (entry) => entry.path === currentPath,
  );

  const navigate = useCallback(
    (step: number) => {
      const index = orderedMedia.findIndex(
        (entry) => entry.path === currentPath,
      );
      const next =
        orderedMedia[
          Math.min(orderedMedia.length - 1, Math.max(0, index + step))
        ];
      if (next !== undefined && next.path !== currentPath) {
        setSelectedRowKey(null);
        show(next.path, null);
      }
    },
    [orderedMedia, currentPath, show],
  );

  const stepFrame = useCallback(
    (step: number) => {
      if (
        current === null ||
        current.frame === null ||
        current.frame_count === null
      )
        return;
      seek(
        Math.min(current.frame_count - 1, Math.max(0, current.frame + step)),
        true,
      );
    },
    [current, seek],
  );

  const selectRow = (row: TableRow) => {
    setSelectedRowKey(row.key);
    if (
      row.path !== currentPath ||
      (row.frame !== null && row.frame !== currentFrame)
    )
      show(row.path, row.frame);
  };

  const setAccepted = (targets: TableRow[], isAccepted: boolean) => {
    void call(() => api.setAccepted(groupFindings(targets), isAccepted));
  };

  const uploadFiles = useCallback(
    async (files: DroppedFile[]) => {
      if (files.length === 0) {
        report("No images or videos found in what was dropped.");
        return;
      }
      setUpload({ done: 0, total: files.length });
      try {
        let start = 0;
        while (start < files.length) {
          const chunk: DroppedFile[] = [];
          let size = 0;
          while (
            start + chunk.length < files.length &&
            chunk.length < UPLOAD_CHUNK_SIZE
          ) {
            const next = files[start + chunk.length];
            if (
              next === undefined ||
              (chunk.length > 0 && size + next.file.size > 256 * 1024 * 1024)
            )
              break;
            chunk.push(next);
            size += next.file.size;
          }
          await api.upload(chunk, start === 0);
          start += chunk.length;
          setUpload({ done: start, total: files.length });
        }
      } catch (error) {
        report(`Upload failed: ${errorMessage(error)}`);
      } finally {
        setUpload(null);
      }
    },
    [report],
  );

  const isBusy = state?.is_busy ?? true;
  const selectTask = useCallback(
    (nextTask: TaskValue) => {
      if (isBusy || nextTask === task) return;
      setSelectedRowKey(null);
      void call(() => api.selectTask(nextTask));
    },
    [isBusy, task, call],
  );

  const run = useCallback(() => void runAction(api.run), [runAction]);
  const inferenceMode = state?.inference.mode ?? "shown";
  const infer = useCallback(() => {
    switch (inferenceMode) {
      case "all":
        void runAll();
        break;
      case "shown":
        run();
        break;
    }
  }, [inferenceMode, run, runAll]);

  const exportResults = async (choice: ExportChoice): Promise<boolean> => {
    const listedPayload: PictureFindings[] | null =
      choice.scope === "listed" && isFiltered
        ? groupFindings(filterRows(allRows, filter))
        : null;
    return runAction((isSkippingApproved) =>
      api.exportResults({
        ...choice,
        listed_findings: listedPayload,
        is_label_confidence_shown: display.isConfidenceShown,
        is_skipping_approved: isSkippingApproved,
      }),
    );
  };

  const saveCsv = async (listedRows: TableRow[]) => {
    try {
      const blob = await api.tableCsv(
        listedRows.flatMap((row) =>
          row.kind === "finding"
            ? [{ path: row.path, frame: row.frame, index: row.finding.index }]
            : [],
        ),
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "findings.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      report(errorMessage(error));
    }
  };

  const embed = useEmbedBridge({
    open: async (paths, shownPath) => {
      await api.openPaths(paths);
      const onlyPath = paths.length === 1 ? (paths[0] ?? null) : null;
      if (shownPath !== null) {
        await api.show(shownPath, null);
      } else if (onlyPath !== null) {
        await api.show(onlyPath, null).catch(() => undefined);
      }
    },
    show: async (path, frame) => {
      await api.show(path, frame);
    },
    close: async (paths) => {
      await api.closeMedia(paths);
    },
    results: (paths) => api.resultDocument(paths),
  });
  const { isEmbedded, notify } = embed;
  const shownPath = serverCurrent?.path ?? null;
  const shownFrame = serverCurrent?.frame ?? null;

  useEffect(() => {
    if (isEmbedded)
      notify({
        type: "ovir-gui:current-changed",
        path: shownPath,
        frame: shownFrame,
      });
  }, [isEmbedded, notify, shownPath, shownFrame]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommand = event.metaKey || event.ctrlKey;
      if (!isCommand || document.querySelector(".overlay") !== null) return;
      const taskIndex = ["1", "2", "3"].indexOf(event.key);
      const shortcutTask = TASK_ORDER[taskIndex];
      if (
        taskIndex >= 0 &&
        shortcutTask !== undefined &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
        selectTask(shortcutTask);
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        setOpenDialog({ kind: "export" });
      } else if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setIsStatisticsOpen((isOpen) => !isOpen);
      } else if (event.key.toLowerCase() === "o" && !isTyping(event.target)) {
        event.preventDefault();
        setOpenDialog({ kind: "browse" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectTask]);

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (
        !hasFiles(event.dataTransfer) ||
        document.querySelector(".overlay") !== null
      )
        return;
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
      if (document.querySelector(".overlay") !== null) return;
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

  const statusSerial = state?.status.serial;
  useEffect(() => {
    setLocalMessage(null);
  }, [statusSerial]);

  useEffect(() => {
    if (
      selectedRowKey !== null &&
      !allRows.some((row) => row.key === selectedRowKey)
    )
      setSelectedRowKey(null);
  }, [allRows, selectedRowKey]);

  useEffect(() => {
    setFilter({});
    setOrder(null);
  }, [task]);

  if (state === null) {
    return (
      <div
        className="empty-center"
        style={{ background: "var(--bg)", color: "var(--text-muted)" }}
      >
        {workspace.connection === "closed"
          ? "Cannot reach the OVIR GUI server; retrying…"
          : "Connecting…"}
      </div>
    );
  }

  const toggleSection = (name: string) =>
    setLayout((currentLayout) => ({
      ...currentLayout,
      collapsedSections: currentLayout.collapsedSections.includes(name)
        ? currentLayout.collapsedSections.filter((entry) => entry !== name)
        : [...currentLayout.collapsedSections, name],
    }));
  const isCollapsed = (name: string) => layout.collapsedSections.includes(name);
  const referenceClass =
    openDialog?.kind === "reference"
      ? state.classes[openDialog.classIndex]
      : undefined;
  const taskView = taskViewOf(task);
  const isGalleryShown =
    taskView.isGalleryAvailable && centerLayout.mode === "gallery";
  const centerModeToggle = (
    <CenterModeToggle
      mode={centerLayout.mode}
      onChange={(mode) => setCenterLayout({ mode })}
    />
  );
  const openMenuBelow = (target: HTMLElement, entries: MenuEntry[]) =>
    menu.openBelow(target, entries);
  const tableKeyOf = (path: string, frame: number | null, index: number) =>
    rowKeyOf(path, frame, index);

  return (
    <div className="app">
      <div className="binder" data-task={task}>
        <BinderShape task={task} tasks={TASK_ORDER} />
        <div className="binder-band">
          <BinderTabs
            task={task}
            tasks={TASK_ORDER}
            isDisabled={state.is_busy}
            onSelect={selectTask}
          />
          <div className="binder-controls">
            <ConnectionIndicator connection={workspace.connection} />
          </div>
        </div>

        <div
          className="binder-sheet"
          role="tabpanel"
          aria-label={taskView.label}
        >
          <div className="sheet-main">
            <div
              className="pane"
              style={{ width: layout.sidebarWidth, flex: "none" }}
            >
              <PaneHeader title="Setup" />
              <div className="pane-body">
                <Section
                  title="Model"
                  icon={<ModelGlyph />}
                  isCollapsed={isCollapsed("model")}
                  onToggle={() => toggleSection("model")}
                  actions={
                    <>
                      {state.model.description !== "" && (
                        <InfoTip label="How this model is used">
                          {state.model.description}
                        </InfoTip>
                      )}
                      <PopoverButton
                        className="section-action runtime-button"
                        label="Runtime settings"
                        title="Runtime settings: device, precision, batch size"
                        trigger={<GearGlyph />}
                      >
                        <div className="popover-title">Runtime</div>
                        <InferenceSettings
                          model={state.model}
                          task={task}
                          isDisabled={state.is_busy}
                          onChange={(selection: ModelSelection) =>
                            void selectModel(selection)
                          }
                        />
                      </PopoverButton>
                    </>
                  }
                >
                  <ModelPanel
                    model={state.model}
                    isDisabled={state.is_busy}
                    onSelectPreset={(backend, preset) =>
                      void selectPreset(backend, preset)
                    }
                    onSelectionChange={(selection) =>
                      void selectModel(selection)
                    }
                  />
                </Section>
                <Section
                  title="Classes"
                  icon={<ClassesGlyph />}
                  actions={
                    <InfoTip label="Editing classes">
                      Double-click to rename or add a class. Write{" "}
                      <span className="mono">car: car, suv</span> to query a
                      class by several phrases; drag phrases between classes.
                    </InfoTip>
                  }
                  count={state.classes.length}
                  isCollapsed={isCollapsed("classes")}
                  onToggle={() => toggleSection("classes")}
                  isStretched
                >
                  <ClassEditor
                    classes={state.classes}
                    classSet={state.class_set}
                    isImagePromptSupported={
                      state.model.is_image_prompt_supported
                    }
                    onReport={report}
                    onAddImagePrompt={(classIndex) =>
                      setOpenDialog({ kind: "reference", classIndex })
                    }
                    onOpenLibrary={() => setOpenDialog({ kind: "class-sets" })}
                    onEditAsText={() => setOpenDialog({ kind: "class-text" })}
                  />
                </Section>
                <Section
                  title="Media"
                  icon={<MediaGlyph />}
                  count={state.media.length}
                  isCollapsed={isCollapsed("media")}
                  onToggle={() => toggleSection("media")}
                  isStretched
                  actions={
                    <AddMediaMenu
                      onUploadFiles={() => fileInput.current?.click()}
                      onUploadFolder={() => folderInput.current?.click()}
                      onOpenFromServer={() => setOpenDialog({ kind: "browse" })}
                      onOpenMenu={openMenuBelow}
                    />
                  }
                >
                  <MediaList
                    media={orderedMedia}
                    currentPath={currentPath}
                    backgroundKey={state.background_key}
                    onSelect={(path) => {
                      setSelectedRowKey(null);
                      show(path, null);
                    }}
                    onClose={(paths) => void call(() => api.closeMedia(paths))}
                  />
                </Section>
              </div>
              <div className="pane-footer">
                <InferControl
                  isDisabled={state.is_busy}
                  inference={state.inference}
                  frameStep={state.sampling.frame_step}
                  onInfer={infer}
                  onInferenceChange={(mode, isAuto) =>
                    void call(() => api.setInference(mode, isAuto))
                  }
                  onRetry={() => void call(() => api.retryInference())}
                  onFrameStepChange={(frameStep) =>
                    void call(() => api.setSampling(frameStep))
                  }
                />
              </div>
            </div>
            <Splitter
              onResize={(delta) =>
                setLayout((currentLayout) => ({
                  ...currentLayout,
                  sidebarWidth: Math.max(
                    240,
                    Math.min(640, currentLayout.sidebarWidth + delta),
                  ),
                }))
              }
            />
            <div className="pane pane-canvas">
              <PaneHeader
                title={
                  isGalleryShown
                    ? "All pictures"
                    : (current?.name ?? "No picture")
                }
                leading={
                  taskView.isGalleryAvailable ? centerModeToggle : undefined
                }
                navigation={
                  isGalleryShown || current === null
                    ? undefined
                    : {
                        isFirst: currentMediaIndex <= 0,
                        isLast:
                          currentMediaIndex < 0 ||
                          currentMediaIndex >= orderedMedia.length - 1,
                        onNavigate: navigate,
                      }
                }
              >
                <PopoverButton
                  className="sheet-button"
                  label="View settings"
                  title="How findings are drawn on the pictures"
                  trigger={
                    <>
                      <SlidersGlyph />
                      View
                    </>
                  }
                >
                  <ViewSettings
                    taskView={taskView}
                    display={display}
                    isComparisonAvailable={state.compared_profile_key !== null}
                    onChange={setDisplay}
                  />
                </PopoverButton>
              </PaneHeader>
              <div className="center">
                {isGalleryShown ? (
                  <ClassificationGallery
                    rows={rows}
                    media={state.media}
                    currentPictureKey={resultPictureKey}
                    selectedKey={selectedRowKey}
                    classColors={classColors}
                    onSelectRow={selectRow}
                    onSetAccepted={setAccepted}
                    onOpenPicture={(path, frame) => {
                      setCenterLayout({ mode: "image" });
                      show(path, frame);
                    }}
                  />
                ) : (
                  <div className="center-stage">
                    <PromptToolbar
                      editor={promptEditor}
                      classes={state.classes}
                      frameStep={state.sampling.frame_step}
                    />
                    <ResultViewer
                      current={current}
                      frame={markedFramePayload}
                      videoResults={currentVideoResults}
                      listed={isFiltered ? listed : null}
                      listedIndices={
                        !isFiltered || resultPictureKey === null
                          ? null
                          : (listed.get(resultPictureKey) ?? new Set())
                      }
                      highlighted={
                        selectedRow?.kind === "finding" &&
                        selectedRow.path === currentPath
                          ? {
                              frame: selectedRow.frame,
                              index: selectedRow.finding.index,
                            }
                          : null
                      }
                      highlightedIndex={highlightedIndex}
                      options={display}
                      classColors={classColors}
                      position={playbackPosition}
                      live={live}
                      isMediaEmpty={state.media.length === 0}
                      isVideoPlayerUsed={isVideoPlayerUsed}
                      drawing={promptEditor.drawing}
                      onSelectFinding={(resultFrame, index) => {
                        if (currentPath !== null)
                          setSelectedRowKey(
                            tableKeyOf(currentPath, resultFrame, index),
                          );
                      }}
                      onClearSelection={() => setSelectedRowKey(null)}
                      onNavigate={navigate}
                      onSeek={seek}
                      onFollow={follow}
                      onStepFrame={stepFrame}
                      onVideoPlayerFailed={(error) => {
                        if (currentPath === null) return;
                        const path = currentPath;
                        setUnplayableSources(
                          (sources) => new Set([...sources, playedSource]),
                        );
                        if (playback === "none") {
                          void call(() => api.preparePlayback(path));
                          return;
                        }
                        report(
                          `The browser cannot play ${current?.name ?? path} (${error.message}); showing frames decoded by the server.`,
                        );
                      }}
                      onUploadRequested={() => fileInput.current?.click()}
                      onBrowseRequested={() =>
                        setOpenDialog({ kind: "browse" })
                      }
                    />
                    {current !== null && isVideo && current.frame !== null && (
                      <VideoControls
                        current={current}
                        frame={current.frame}
                        timeline={
                          timeline !== null && timeline.path === current.path
                            ? timeline
                            : null
                        }
                        frameStep={state.sampling.frame_step}
                        isClassification={task === "classification"}
                        isPlaybackShown={!isVideoPlayerUsed}
                        onSeek={seek}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
            <Splitter
              onResize={(delta) =>
                setLayout((currentLayout) => ({
                  ...currentLayout,
                  rightWidth: Math.max(
                    340,
                    Math.min(1100, currentLayout.rightWidth - delta),
                  ),
                }))
              }
            />
            <div
              className="pane"
              style={{ width: layout.rightWidth, flex: "none" }}
            >
              <PaneHeader title="Results">
                <button
                  className="sheet-button"
                  onClick={() => setIsStatisticsOpen((isOpen) => !isOpen)}
                  title="Statistics and class minimums (Ctrl+I)"
                >
                  <StatisticsGlyph />
                  Statistics
                </button>
                <button
                  className="sheet-button"
                  disabled={state.is_busy}
                  onClick={() => setOpenDialog({ kind: "export" })}
                  title="Export results or download the listed findings as CSV (Ctrl+E)"
                >
                  <ExportGlyph />
                  Export
                </button>
              </PaneHeader>
              <div
                className="pane-region"
                style={
                  isCollapsed("models")
                    ? { flex: "none" }
                    : isCollapsed("results")
                      ? undefined
                      : { height: layout.profileHeight, flex: "none" }
                }
              >
                <ProfileTable
                  profiles={state.profiles}
                  shownKey={state.shown_profile_key}
                  comparedKey={state.compared_profile_key}
                  onSelect={(key) => void call(() => api.selectProfile(key))}
                  onRemove={(keys) => void call(() => api.removeProfiles(keys))}
                  isBusy={state.is_busy}
                  isCollapsed={isCollapsed("models")}
                  onToggleCollapsed={() => toggleSection("models")}
                  onUpdateOutdated={() => void runAction(api.updateOutdated)}
                />
              </div>
              {!isCollapsed("models") && !isCollapsed("results") && (
                <Splitter
                  isHorizontal
                  onResize={(delta) =>
                    setLayout((currentLayout) => ({
                      ...currentLayout,
                      profileHeight: Math.max(
                        90,
                        Math.min(600, currentLayout.profileHeight + delta),
                      ),
                    }))
                  }
                />
              )}
              <div
                className="pane-region results-panel"
                style={isCollapsed("results") ? { flex: "none" } : undefined}
              >
                <Section
                  title={taskView.resultTitle}
                  icon={<FindingsGlyph />}
                  isCollapsed={isCollapsed("results")}
                  onToggle={() => toggleSection("results")}
                  isStretched
                  isFlush
                >
                  {state.model.tuning.is_minimum_confidence_shown &&
                    reviewFilter !== null && (
                      <>
                        <div
                          className="review-area"
                          style={
                            isCollapsed("review")
                              ? undefined
                              : { height: layout.reviewHeight }
                          }
                        >
                          <ReviewPanel
                            classes={state.classes}
                            results={markedResults}
                            reviewFilter={reviewFilter}
                            thresholds={
                              draftThresholds.value ?? state.thresholds
                            }
                            suppression={
                              draftSuppression.value ?? state.suppression
                            }
                            standardMinimum={state.standard_minimum}
                            standardOverlap={state.standard_overlap_threshold}
                            isOverlapAvailable={!taskView.isScoreBased}
                            isCollapsed={isCollapsed("review")}
                            onToggleCollapsed={() => toggleSection("review")}
                            onThresholdsChange={draftThresholds.change}
                            onSuppressionChange={draftSuppression.change}
                          />
                        </div>
                        {!isCollapsed("review") && (
                          <Splitter
                            isHorizontal
                            onResize={(delta) =>
                              setLayout((currentLayout) => ({
                                ...currentLayout,
                                reviewHeight: Math.max(
                                  90,
                                  Math.min(
                                    800,
                                    currentLayout.reviewHeight + delta,
                                  ),
                                ),
                              }))
                            }
                          />
                        )}
                      </>
                    )}
                  {isImageResultsShown && (
                    <div
                      className={`results-area${isCollapsed("image-results") ? " collapsed" : ""}`}
                    >
                      <ResultTable
                        task={task}
                        scope="images"
                        title="Images"
                        emptyText="Open images; their results are listed here as inference completes."
                        isCollapsed={isCollapsed("image-results")}
                        onToggleCollapsed={() => toggleSection("image-results")}
                        rows={imageRows}
                        allRows={imageScopedRows}
                        filter={filter}
                        onFilterChange={setFilter}
                        order={order}
                        onOrderChange={setOrder}
                        currentPictureKey={resultPictureKey}
                        selectedKey={selectedRowKey}
                        onSelectRow={selectRow}
                        onSetAccepted={setAccepted}
                        classColors={classColors}
                      />
                    </div>
                  )}
                  {isImageResultsShown &&
                    hasVideos &&
                    !isCollapsed("image-results") &&
                    !isCollapsed("video-results") && (
                      <Splitter
                        isHorizontal
                        onResize={(delta) =>
                          setLayout((currentLayout) => ({
                            ...currentLayout,
                            videoResultsHeight: Math.max(
                              120,
                              Math.min(
                                900,
                                currentLayout.videoResultsHeight - delta,
                              ),
                            ),
                          }))
                        }
                      />
                    )}
                  {hasVideos && (
                    <div
                      className={`results-area${isCollapsed("video-results") ? " collapsed" : ""}`}
                      style={
                        isImageResultsShown &&
                        !isCollapsed("image-results") &&
                        !isCollapsed("video-results")
                          ? { flex: `0 1 ${layout.videoResultsHeight}px` }
                          : undefined
                      }
                    >
                      {chartedVideo !== null && (
                        <VideoFindingsPanel
                          video={chartedVideo}
                          current={isChartedVideoCurrent ? current : null}
                          results={chartedVideoResults}
                          position={playbackPosition}
                          isFollowingPlayer={isVideoPlayerUsed}
                          classColors={classColors}
                          isCollapsed={isCollapsed("video-results")}
                          onToggleCollapsed={() =>
                            toggleSection("video-results")
                          }
                          onSeek={
                            isChartedVideoCurrent
                              ? seek
                              : (frame) => show(chartedVideo.path, frame)
                          }
                        />
                      )}
                    </div>
                  )}
                </Section>
              </div>
            </div>
          </div>
        </div>
      </div>

      <StatusBar
        state={state}
        localMessage={localMessage?.text ?? null}
        upload={upload}
        onCancel={() => void call(api.cancel)}
      />

      {workspace.notices.length > 0 && (
        <div className="notices">
          {workspace.notices.map((notice) => (
            <div key={notice.id} className="notice">
              <div className="body">
                <div className="title">{notice.title}</div>
                {notice.message}
              </div>
              <button
                className="ghost icon"
                onClick={() => workspace.dismissNotice(notice.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {isDragOver && (
        <div className="drop-overlay">
          <div className="card">
            <MediaKindBadges />
            <div style={{ fontWeight: 600 }}>
              Drop images, videos or folders to upload and open them
            </div>
            <div className="hint">
              They are stored on the server in {state.upload_directory}
            </div>
          </div>
        </div>
      )}

      {isStatisticsOpen && (
        <StatisticsPanel
          refreshToken={`${state.status.serial}:${state.shown_profile_key}:${state.compared_profile_key}:${JSON.stringify(state.thresholds)}:${resultsVersion}`}
          thresholds={draftThresholds.value ?? state.thresholds}
          classColors={classColors}
          profiles={state.profiles}
          shownKey={state.shown_profile_key}
          comparedKey={state.compared_profile_key}
          onThresholdsChange={draftThresholds.change}
          onCompare={(key) => void call(() => api.compare(key))}
          onClose={() => setIsStatisticsOpen(false)}
        />
      )}

      {openDialog?.kind === "browse" && (
        <ServerBrowserDialog
          mode="media"
          title="Open Images and Videos from the Server"
          onChoose={(paths) => {
            setOpenDialog(null);
            void call(() => api.openPaths(paths));
          }}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog?.kind === "export" && (
        <ExportDialog
          hasVideos={hasVideos}
          listedFindingCount={listedFindingRows.length}
          onExport={exportResults}
          onDownloadCsv={() => void saveCsv(listedFindingRows)}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog?.kind === "class-sets" && (
        <ClassSetDialog
          classSet={state.class_set}
          version={workspace.classSetsVersion}
          onReport={report}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog?.kind === "class-text" && (
        <ClassTextDialog
          classes={state.classes}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog?.kind === "reference" && referenceClass !== undefined && (
        <ReferenceDialog
          classIndex={openDialog.classIndex}
          classEntry={referenceClass}
          hasShownPicture={state.current !== null}
          onAdded={() => undefined}
          onClose={() => setOpenDialog(null)}
        />
      )}

      <input
        ref={fileInput}
        type="file"
        accept={["image/*", "video/*", ...state.accepted_suffixes].join(",")}
        multiple
        hidden
        onChange={(event) => {
          const files = mediaFilesOfList(event.target.files);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        {...{ webkitdirectory: "" }}
        onChange={(event) => {
          const files = mediaFilesOfList(event.target.files);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />
      {menu.element}
    </div>
  );
}
