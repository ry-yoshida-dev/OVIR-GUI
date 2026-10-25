import { useMemo, useState } from "react";
import { api } from "../api/client";
import type {
  MediaEntry,
  ModelSelection,
  TaskValue,
  WorkspaceState,
} from "../api/types";
import type { Call } from "../hooks/useActionRunner";
import type { SectionName } from "../hooks/useLayoutState";
import type { ModelSelector } from "../hooks/useModelSelection";
import { AddMediaMenu } from "./AddMediaMenu";
import type { AppDialog } from "./AppDialogs";
import { ClassEditor } from "./ClassEditor";
import { effectiveMediaSelection } from "../lib/mediaSelection";
import { ClassesGlyph, GearGlyph, MediaGlyph, ModelGlyph, TrashGlyph } from "./Glyphs";
import { InferControl } from "./InferControl";
import { InferenceSettings } from "./InferenceSettings";
import { InfoTip } from "./InfoTip";
import { MediaList } from "./MediaList";
import type { MenuEntry } from "./Menu";
import { ModelPanel } from "./ModelPanel";
import { PaneHeader } from "./PaneHeader";
import { PopoverButton } from "./PopoverButton";
import { Section } from "./Section";

interface SetupPaneProps {
  state: WorkspaceState;
  task: TaskValue;
  width: number;
  orderedMedia: MediaEntry[];
  currentPath: string | null;
  modelSelector: ModelSelector;
  call: Call;
  isCollapsed: (section: SectionName) => boolean;
  onToggleSection: (section: SectionName) => void;
  onReport: (text: string) => void;
  onOpenDialog: (dialog: AppDialog) => void;
  onOpenMenu: (target: HTMLElement, entries: MenuEntry[]) => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  onShowMedia: (path: string) => void;
  onInfer: () => void;
}

/**
 * Left pane holding the model, the classes and the open media, with the inference control below them.
 */
export function SetupPane({
  state,
  task,
  width,
  orderedMedia,
  currentPath,
  modelSelector,
  call,
  isCollapsed,
  onToggleSection,
  onReport,
  onOpenDialog,
  onOpenMenu,
  onUploadFiles,
  onUploadFolder,
  onShowMedia,
  onInfer,
}: SetupPaneProps) {
  const [checkedMediaPaths, setCheckedMediaPaths] = useState<Set<string>>(new Set());
  const openPaths = useMemo(() => new Set(orderedMedia.map((entry) => entry.path)), [orderedMedia]);
  if ([...checkedMediaPaths].some((path) => !openPaths.has(path)))
    setCheckedMediaPaths(new Set([...checkedMediaPaths].filter((path) => openPaths.has(path))));
  const checkedPaths = effectiveMediaSelection(orderedMedia, checkedMediaPaths, null);
  const removeMedia = (paths: string[]) => void call(() => api.closeMedia(paths));

  return (
    <div className="pane" style={{ width, flex: "none" }}>
      <PaneHeader title="Setup" />
      <div className="pane-body">
        <Section
          title="Model"
          icon={<ModelGlyph />}
          isCollapsed={isCollapsed("model")}
          onToggle={() => onToggleSection("model")}
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
                    void modelSelector.selectModel(selection)
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
              void modelSelector.selectPreset(backend, preset)
            }
            onSelectionChange={(selection) =>
              void modelSelector.selectModel(selection)
            }
          />
        </Section>
        <Section
          title="Classes"
          icon={<ClassesGlyph />}
          actions={
            <InfoTip label="Editing classes">
              Double-click to rename or add a class. Write{" "}
              <span className="snippet">car: car, suv</span> to query a class by
              several phrases; drag phrases between classes.
            </InfoTip>
          }
          count={state.classes.length}
          isCollapsed={isCollapsed("classes")}
          onToggle={() => onToggleSection("classes")}
          isStretched
        >
          <ClassEditor
            key={task}
            classes={state.classes}
            classSet={state.class_set}
            isImagePromptSupported={state.model.is_image_prompt_supported}
            onReport={onReport}
            onAddImagePrompt={(classIndex) =>
              onOpenDialog({ kind: "reference", classIndex })
            }
            onOpenLibrary={() => onOpenDialog({ kind: "class-sets" })}
            onEditAsText={() => onOpenDialog({ kind: "class-text" })}
          />
        </Section>
        <Section
          title="Media"
          icon={<MediaGlyph />}
          count={state.media.length}
          isCollapsed={isCollapsed("media")}
          onToggle={() => onToggleSection("media")}
          isStretched
          actions={
            <>
              <button
                className="section-action"
                disabled={checkedPaths.length === 0}
                onClick={() => removeMedia(checkedPaths)}
                title="Remove the checked files from the list; their results are kept (Delete)"
                aria-label="Remove the checked files"
              >
                <TrashGlyph />
              </button>
              <AddMediaMenu
                onUploadFiles={onUploadFiles}
                onUploadFolder={onUploadFolder}
                onOpenFromServer={() => onOpenDialog({ kind: "browse" })}
                onOpenMenu={onOpenMenu}
              />
            </>
          }
        >
          <MediaList
            media={orderedMedia}
            currentPath={currentPath}
            backgroundKey={state.background_key}
            checkedPaths={checkedMediaPaths}
            onCheckedChange={setCheckedMediaPaths}
            onSelect={onShowMedia}
            onRemove={removeMedia}
          />
        </Section>
      </div>
      <div className="pane-footer">
        <InferControl
          isDisabled={state.is_busy}
          inference={state.inference}
          frameStep={state.sampling.frame_step}
          onInfer={onInfer}
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
  );
}
