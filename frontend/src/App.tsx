import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "./api/client";
import type {
  ActionReply,
  CurrentPicture,
  FramePayload,
  ModelSelection,
  PictureFindings,
  TaskValue,
  TimelinePayload,
} from "./api/types";
import { BackgroundControl } from "./components/BackgroundControl";
import { ClassEditor } from "./components/ClassEditor";
import { ClassSetDialog } from "./components/ClassSetDialog";
import { ClassTextDialog } from "./components/ClassTextDialog";
import { useDialogs } from "./components/DialogHost";
import { type ExportChoice, ExportDialog } from "./components/ExportDialog";
import { MediaList } from "./components/MediaList";
import { useMenu } from "./components/Menu";
import { ModelPanel } from "./components/ModelPanel";
import { ProfileTable } from "./components/ProfileTable";
import { ReferenceDialog } from "./components/ReferenceDialog";
import { ResultTable } from "./components/ResultTable";
import { ResultViewer } from "./components/ResultViewer";
import { Section } from "./components/Section";
import { ServerBrowserDialog } from "./components/ServerBrowserDialog";
import { Splitter } from "./components/Splitter";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { StatusBar } from "./components/StatusBar";
import { TaskSwitcher } from "./components/TaskSwitcher";
import { VideoControls } from "./components/VideoControls";
import { useStoredState } from "./hooks/useStoredState";
import { useWorkspace } from "./hooks/useWorkspace";
import { DEFAULT_DISPLAY_OPTIONS, type DisplayOptions } from "./lib/displayOptions";
import { type DroppedFile, hasFiles, mediaFilesOf, mediaFilesOfList } from "./lib/droppedFiles";
import { FrameResultIndex } from "./lib/frameResultIndex";
import {
  buildRows,
  filterRows,
  groupFindings,
  listedIndices,
  pictureKeyOf,
  rowKeyOf,
  type SortOrder,
  sortRows,
  type TableFilter,
  type TableRow,
} from "./lib/resultTable";

interface Layout {
  sidebarWidth: number;
  rightWidth: number;
  profileHeight: number;
  collapsedSections: string[];
}

interface FrameRequest {
  path: string;
  frame: number;
}

const DEFAULT_LAYOUT: Layout = { sidebarWidth: 330, rightWidth: 560, profileHeight: 160, collapsedSections: [] };
const UPLOAD_CHUNK_SIZE = 8;
const LOCAL_MESSAGE_MILLISECONDS = 7000;
const SHOW_THROTTLE_MILLISECONDS = 150;
const VIDEO_RESULTS_DEBOUNCE_MILLISECONDS = 200;

type OpenDialog =
  | { kind: "browse" }
  | { kind: "export" }
  | { kind: "class-sets" }
  | { kind: "class-text" }
  | { kind: "reference"; classIndex: number }
  | null;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
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
  const [layout, setLayout] = useStoredState<Layout>("ovir-gui.layout", DEFAULT_LAYOUT);
  const [display, setDisplay] = useStoredState<DisplayOptions>("ovir-gui.display", DEFAULT_DISPLAY_OPTIONS);
  const [filter, setFilter] = useState<TableFilter>({});
  const [order, setOrder] = useState<SortOrder | null>(null);
  const [isShownMediaOnly, setIsShownMediaOnly] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
  const [localMessage, setLocalMessage] = useState<{ text: string; serial: number } | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFrame, setPendingFrame] = useState<FrameRequest | null>(null);
  const [framePayload, setFramePayload] = useState<FramePayload | null>(null);
  const [timeline, setTimeline] = useState<TimelinePayload | null>(null);
  const [videoResults, setVideoResults] = useState<{ path: string; index: FrameResultIndex } | null>(null);
  const [unplayableVideoPaths, setUnplayableVideoPaths] = useState<ReadonlySet<string>>(new Set());
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
      () => setLocalMessage((current) => (current?.serial === serial ? null : current)),
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

  const runAction = useCallback(
    async (action: (isSkippingApproved: boolean) => Promise<ActionReply>): Promise<boolean> => {
      try {
        let reply = await action(false);
        if (reply.status === "needs_approval") {
          const isApproved = await dialogs.confirm({
            title: "Skip reference-only classes?",
            message: reply.message,
            confirmLabel: "Recognize Without Them",
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
    if (pendingFrame === null || pendingFrame.path !== serverCurrent.path || serverCurrent.kind !== "video") {
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
  const task: TaskValue = state?.task.value ?? "detection";

  useEffect(() => {
    if (pendingFrame === null || serverCurrent === null) return;
    if (serverCurrent.path !== pendingFrame.path || serverCurrent.frame === pendingFrame.frame) setPendingFrame(null);
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

  const isVideoPlayerUsed = isVideo && currentPath !== null && !unplayableVideoPaths.has(currentPath);
  useEffect(() => {
    if (currentPath === null || !isVideoPlayerUsed) {
      setVideoResults(null);
      return;
    }
    let isCurrent = true;
    const timer = window.setTimeout(() => {
      api
        .videoFrames(currentPath)
        .then((loaded) => {
          if (isCurrent) setVideoResults({ path: loaded.path, index: new FrameResultIndex(loaded) });
        })
        .catch(() => undefined);
    }, VIDEO_RESULTS_DEBOUNCE_MILLISECONDS);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [currentPath, isVideoPlayerUsed, frameRefreshToken]);

  const show = useCallback(
    (path: string, frame: number | null) => {
      window.clearTimeout(showTimer.current);
      if (frame !== null) setPendingFrame({ path, frame });
      lastShowAt.current = Date.now();
      void call(() => api.show(path, frame));
    },
    [call],
  );

  const seek = useCallback(
    (frame: number, isFinal: boolean) => {
      if (currentPath === null) return;
      setPendingFrame({ path: currentPath, frame });
      window.clearTimeout(showTimer.current);
      const elapsed = Date.now() - lastShowAt.current;
      if (isFinal || elapsed >= SHOW_THROTTLE_MILLISECONDS) {
        lastShowAt.current = Date.now();
        void call(() => api.show(currentPath, frame));
      } else {
        showTimer.current = window.setTimeout(() => {
          lastShowAt.current = Date.now();
          void call(() => api.show(currentPath, frame));
        }, SHOW_THROTTLE_MILLISECONDS - elapsed);
      }
    },
    [currentPath, call],
  );

  const allRows = useMemo(() => buildRows(results), [results]);
  const scopedRows = useMemo(
    () => (isShownMediaOnly && currentPath !== null ? allRows.filter((row) => row.path === currentPath) : allRows),
    [allRows, isShownMediaOnly, currentPath],
  );
  const filteredRows = useMemo(() => filterRows(scopedRows, filter), [scopedRows, filter]);
  const rows = useMemo(() => sortRows(filteredRows, order), [filteredRows, order]);
  const listed = useMemo(() => listedIndices(filterRows(allRows, filter)), [allRows, filter]);
  const isFiltered = Object.keys(filter).length > 0;

  const resultPictureKey =
    framePayload === null || framePayload.path !== currentPath
      ? null
      : pictureKeyOf(framePayload.path, framePayload.result_frame);
  const selectedRow = rows.find((row) => row.key === selectedRowKey) ?? null;
  const highlightedIndex =
    selectedRow?.kind === "finding" && pictureKeyOf(selectedRow.path, selectedRow.frame) === resultPictureKey
      ? selectedRow.finding.index
      : null;
  const outdatedCount = results?.pictures.filter((picture) => picture.outdated !== null).length ?? 0;
  const classColors = useMemo(
    () => Object.fromEntries((state?.classes ?? []).map((entry) => [entry.name, entry.color])),
    [state?.classes],
  );

  const navigate = useCallback(
    (step: number) => {
      if (state === null) return;
      const index = state.media.findIndex((entry) => entry.path === currentPath);
      const next = state.media[Math.min(state.media.length - 1, Math.max(0, index + step))];
      if (next !== undefined && next.path !== currentPath) {
        setSelectedRowKey(null);
        show(next.path, null);
      }
    },
    [state, currentPath, show],
  );

  const stepFrame = useCallback(
    (step: number) => {
      if (current === null || current.frame === null || current.frame_count === null) return;
      seek(Math.min(current.frame_count - 1, Math.max(0, current.frame + step)), true);
    },
    [current, seek],
  );

  const selectRow = (row: TableRow) => {
    setSelectedRowKey(row.key);
    if (row.path !== currentPath || (row.frame !== null && row.frame !== currentFrame)) show(row.path, row.frame);
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
          while (start + chunk.length < files.length && chunk.length < UPLOAD_CHUNK_SIZE) {
            const next = files[start + chunk.length];
            if (next === undefined || (chunk.length > 0 && size + next.file.size > 256 * 1024 * 1024)) break;
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

  const run = useCallback(() => void runAction(api.run), [runAction]);
  const runAll = useCallback(() => void runAction(api.runAll), [runAction]);

  const exportResults = async (choice: ExportChoice): Promise<boolean> => {
    const listedPayload: PictureFindings[] | null =
      choice.scope === "listed" && isFiltered ? groupFindings(filterRows(allRows, filter)) : null;
    return runAction((isSkippingApproved) =>
      api.exportResults({
        ...choice,
        listed_findings: listedPayload,
        is_label_confidence_shown: display.isConfidenceShown,
        is_skipping_approved: isSkippingApproved,
      }),
    );
  };

  const saveCsv = async () => {
    try {
      const blob = await api.tableCsv(
        rows.flatMap((row) =>
          row.kind === "finding" ? [{ path: row.path, frame: row.frame, index: row.finding.index }] : [],
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommand = event.metaKey || event.ctrlKey;
      if (!isCommand || document.querySelector(".overlay") !== null) return;
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) runAll();
        else run();
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
  }, [run, runAll]);

  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event.dataTransfer) || document.querySelector(".overlay") !== null) return;
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
    if (selectedRowKey !== null && !allRows.some((row) => row.key === selectedRowKey)) setSelectedRowKey(null);
  }, [allRows, selectedRowKey]);

  useEffect(() => {
    setFilter({});
    setOrder(null);
  }, [task]);

  if (state === null) {
    return (
      <div className="empty-center" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
        {workspace.connection === "closed" ? "Cannot reach the OVIR GUI server; retrying…" : "Connecting…"}
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
  const currentIndex = state.media.findIndex((entry) => entry.path === currentPath);
  const referenceClass = openDialog?.kind === "reference" ? state.classes[openDialog.classIndex] : undefined;
  const hasVideos = state.media.some((entry) => entry.kind === "video");
  const displayEntries: { key: keyof DisplayOptions; label: string; isDisabled?: boolean }[] = [
    { key: "isLabelShown", label: "Labels" },
    { key: "isConfidenceShown", label: "Confidences" },
    { key: "isRejectedShown", label: "Rejected findings" },
    { key: "isComparedShown", label: "Compared model", isDisabled: state.compared_profile_key === null },
    { key: "isFilled", label: "Fill boxes", isDisabled: task !== "detection" },
    { key: "isMaskShown", label: "Masks", isDisabled: task !== "segmentation" },
    { key: "isMaskBoxShown", label: "Boxes around masks", isDisabled: task !== "segmentation" },
    { key: "isScorePanelShown", label: "Score panel", isDisabled: task !== "classification" },
  ];
  const tableKeyOf = (path: string, frame: number | null, index: number) => rowKeyOf(path, frame, index);

  return (
    <div className="app">
      <div className="toolbar">
        <span className="title">OVIR GUI</span>
        <TaskSwitcher
          task={state.task}
          isDisabled={state.is_busy}
          onSelect={(nextTask) => {
            setSelectedRowKey(null);
            void call(() => api.selectTask(nextTask));
          }}
        />
        <span className="separator" />
        <button onClick={() => fileInput.current?.click()} title="Upload images and videos from this computer">
          Upload Files…
        </button>
        <button onClick={() => folderInput.current?.click()} title="Upload a folder from this computer">
          Upload Folder…
        </button>
        <button onClick={() => setOpenDialog({ kind: "browse" })} title="Open files already on the server (Ctrl+O)">
          Open from Server…
        </button>
        <span className="separator" />
        <button className="icon" disabled={currentIndex <= 0} onClick={() => navigate(-1)} title="Previous file (PageUp)">
          ◀
        </button>
        <button
          className="icon"
          disabled={currentIndex < 0 || currentIndex >= state.media.length - 1}
          onClick={() => navigate(1)}
          title="Next file (PageDown)"
        >
          ▶
        </button>
        <span className="separator" />
        <button
          className="primary"
          disabled={state.is_busy}
          onClick={run}
          title="Recognize the shown image or video frame (Ctrl+Enter)"
        >
          Run
        </button>
        <button disabled={state.is_busy} onClick={runAll} title="Recognize every picture lacking a result (Ctrl+Shift+Enter)">
          Run All
        </button>
        <BackgroundControl background={state.background} onChange={(scope) => void call(() => api.setBackground(scope))} />
        <span className="separator" />
        <button disabled={state.is_busy} onClick={() => setOpenDialog({ kind: "export" })} title="Export results (Ctrl+E)">
          Export…
        </button>
        <button
          onClick={(event) =>
            menu.openBelow(event.currentTarget, [
              ...displayEntries.map((entry) => ({
                label: entry.label,
                isChecked: Boolean(display[entry.key]),
                isDisabled: entry.isDisabled ?? false,
                onSelect: () => setDisplay((currentDisplay) => ({ ...currentDisplay, [entry.key]: !currentDisplay[entry.key] })),
              })),
              { isSeparator: true, label: "" },
              ...[1, 2, 3, 4].map((width) => ({
                label: `Line width ${width}`,
                isChecked: display.lineWidth === width,
                onSelect: () => setDisplay((currentDisplay) => ({ ...currentDisplay, lineWidth: width })),
              })),
              { isSeparator: true, label: "" },
              ...[0.25, 0.45, 0.65].map((opacity) => ({
                label: `Mask opacity ${Math.round(opacity * 100)}%`,
                isChecked: display.maskOpacity === opacity,
                isDisabled: task !== "segmentation",
                onSelect: () => setDisplay((currentDisplay) => ({ ...currentDisplay, maskOpacity: opacity })),
              })),
            ])
          }
        >
          View ▾
        </button>
        <button onClick={() => setIsStatisticsOpen((isOpen) => !isOpen)} title="Statistics and class minimums (Ctrl+I)">
          Statistics…
        </button>
        <span className="spacer" />
        <span className={`connection ${workspace.connection}`}>
          {workspace.connection === "open"
            ? "● connected"
            : workspace.connection === "closed"
              ? "● disconnected"
              : "● connecting"}
        </span>
      </div>

      <div className="main">
        <div className="sidebar" style={{ width: layout.sidebarWidth, flex: "none" }}>
          <Section title="Model" isCollapsed={isCollapsed("model")} onToggle={() => toggleSection("model")}>
            <ModelPanel
              model={state.model}
              task={task}
              isDisabled={state.is_busy}
              onSelectPreset={(backend, preset) => void call(() => api.selectPreset(backend, preset))}
              onChange={(selection: ModelSelection) => void call(() => api.selectModel(selection))}
            />
          </Section>
          <Section
            title={`Classes (${state.classes.length})`}
            isCollapsed={isCollapsed("classes")}
            onToggle={() => toggleSection("classes")}
            isStretched
          >
            <ClassEditor
              classes={state.classes}
              classSet={state.class_set}
              isImagePromptSupported={state.model.is_image_prompt_supported}
              onReport={report}
              onAddImagePrompt={(classIndex) => setOpenDialog({ kind: "reference", classIndex })}
              onOpenLibrary={() => setOpenDialog({ kind: "class-sets" })}
              onEditAsText={() => setOpenDialog({ kind: "class-text" })}
            />
          </Section>
          <Section
            title={`Media (${state.media.length})`}
            isCollapsed={isCollapsed("media")}
            onToggle={() => toggleSection("media")}
            isStretched
          >
            <MediaList
              media={state.media}
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
        <Splitter
          onResize={(delta) =>
            setLayout((currentLayout) => ({
              ...currentLayout,
              sidebarWidth: Math.max(240, Math.min(640, currentLayout.sidebarWidth + delta)),
            }))
          }
        />
        <div className="center">
          <ResultViewer
            current={current}
            frame={framePayload}
            videoResults={videoResults !== null && videoResults.path === currentPath ? videoResults.index : null}
            listed={isFiltered ? listed : null}
            listedIndices={!isFiltered || resultPictureKey === null ? null : (listed.get(resultPictureKey) ?? new Set())}
            highlighted={
              selectedRow?.kind === "finding" && selectedRow.path === currentPath
                ? { frame: selectedRow.frame, index: selectedRow.finding.index }
                : null
            }
            highlightedIndex={highlightedIndex}
            options={display}
            classColors={classColors}
            isMediaEmpty={state.media.length === 0}
            isVideoPlayerUsed={isVideoPlayerUsed}
            onSelectFinding={(resultFrame, index) => {
              if (currentPath !== null) setSelectedRowKey(tableKeyOf(currentPath, resultFrame, index));
            }}
            onClearSelection={() => setSelectedRowKey(null)}
            onNavigate={navigate}
            onSeek={seek}
            onStepFrame={stepFrame}
            onVideoPlayerFailed={(error) => {
              if (currentPath === null) return;
              const path = currentPath;
              setUnplayableVideoPaths((paths) => new Set([...paths, path]));
              report(`The browser cannot play ${current?.name ?? path} (${error.message}); showing frames decoded by the server.`);
            }}
            onUploadRequested={() => fileInput.current?.click()}
            onBrowseRequested={() => setOpenDialog({ kind: "browse" })}
          />
          {current !== null && isVideo && current.frame !== null && (
            <VideoControls
              current={current}
              frame={current.frame}
              timeline={timeline !== null && timeline.path === current.path ? timeline : null}
              frameStep={state.sampling.frame_step}
              isClassification={task === "classification"}
              isBusy={state.is_busy}
              isPlaybackShown={!isVideoPlayerUsed}
              onSeek={seek}
              onFrameStepChange={(frameStep) => void call(() => api.setSampling(frameStep))}
              onRunVideo={() => void runAction(api.runMedia)}
            />
          )}
        </div>
        <Splitter
          onResize={(delta) =>
            setLayout((currentLayout) => ({
              ...currentLayout,
              rightWidth: Math.max(340, Math.min(1100, currentLayout.rightWidth - delta)),
            }))
          }
        />
        <div className="right-panel" style={{ width: layout.rightWidth, flex: "none" }}>
          <div style={{ height: layout.profileHeight, flex: "none", minHeight: 0 }}>
            <ProfileTable
              profiles={state.profiles}
              shownKey={state.shown_profile_key}
              comparedKey={state.compared_profile_key}
              onSelect={(key) => void call(() => api.selectProfile(key))}
              onRemove={(key) => void call(() => api.removeProfile(key))}
            />
          </div>
          <Splitter
            isHorizontal
            onResize={(delta) =>
              setLayout((currentLayout) => ({
                ...currentLayout,
                profileHeight: Math.max(90, Math.min(600, currentLayout.profileHeight + delta)),
              }))
            }
          />
          <div style={{ flex: 1, minHeight: 0, borderTop: "1px solid var(--border)" }}>
            <ResultTable
              task={task}
              rows={rows}
              allRows={scopedRows}
              filter={filter}
              onFilterChange={setFilter}
              order={order}
              onOrderChange={setOrder}
              currentPictureKey={resultPictureKey}
              selectedKey={selectedRowKey}
              isShownMediaOnly={isShownMediaOnly}
              onShownMediaOnlyChange={setIsShownMediaOnly}
              onSelectRow={selectRow}
              onSetAccepted={setAccepted}
              onSaveCsv={() => void saveCsv()}
              onUpdateOutdated={() => void runAction(api.updateOutdated)}
              onClearResults={() => void call(api.clearResults)}
              outdatedCount={outdatedCount}
              hasResults={state.profiles.length > 0}
              classColors={classColors}
            />
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
              <button className="ghost icon" onClick={() => workspace.dismissNotice(notice.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {isDragOver && (
        <div className="drop-overlay">
          <div className="card">
            <div style={{ fontWeight: 600 }}>Drop images, videos or folders to upload and open them</div>
            <div className="hint">They are stored on the server in {state.upload_directory}</div>
          </div>
        </div>
      )}

      {isStatisticsOpen && (
        <StatisticsPanel
          refreshToken={`${state.status.serial}:${state.shown_profile_key}:${state.compared_profile_key}:${JSON.stringify(state.thresholds)}:${resultsVersion}`}
          thresholds={state.thresholds}
          classColors={classColors}
          profiles={state.profiles}
          shownKey={state.shown_profile_key}
          comparedKey={state.compared_profile_key}
          onThresholdsChange={(next) => void call(() => api.setThresholds(next.default_minimum, next.class_minimums))}
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
        <ExportDialog hasVideos={hasVideos} onExport={exportResults} onClose={() => setOpenDialog(null)} />
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
        <ClassTextDialog classes={state.classes} onClose={() => setOpenDialog(null)} />
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
