import { useState } from "react";
import { api, errorMessage } from "../api/client";
import type {
  CropImageFormatValue,
  ExportChoice,
  ExportFormat,
  ExportPreviewChoice,
  ExportPurposeValue,
  LabelPreview,
  MediaKindValue,
  TaskValue,
} from "../api/types";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { useStoredState } from "../hooks/useStoredState";
import type { TableRow } from "../lib/resultTable";
import { CropMarginFigure } from "./CropMarginFigure";
import { Dialog } from "./Dialog";
import { useDialogs } from "./DialogHost";
import { ExportPurposeCards } from "./ExportPurposeCards";
import { InfoTip } from "./InfoTip";
import { LabelSnippet } from "./LabelSnippet";
import { NumberField } from "./NumberField";
import { ServerBrowserDialog } from "./ServerBrowserDialog";

interface ExportDialogProps {
  media: MediaKindValue;
  exportRows: TableRow[];
  listedPictureCount: number | null;
  onExport: (choice: ExportChoice) => Promise<boolean>;
  onLoadPreview: (choice: ExportPreviewChoice) => Promise<LabelPreview>;
  onInferAll: () => void;
  onDownloadCsv: () => void;
  onClose: () => void;
}

interface TaskExportOptions {
  is_confidence_included: boolean;
  is_annotated_image_saved: boolean;
  is_annotated_video_saved: boolean;
  crop_image_format: CropImageFormatValue;
  crop_margin_percent: number;
}

interface StoredExportOptions {
  purposes: Record<string, ExportPurposeValue>;
  formats: Record<string, string>;
  tasks: Partial<Record<TaskValue, Partial<TaskExportOptions>>>;
  output_directory: string;
}

interface FormatGroup {
  label: string;
  formats: ExportFormat[];
}

const DEFAULT_TASK_EXPORT_OPTIONS: TaskExportOptions = {
  is_confidence_included: true,
  is_annotated_image_saved: false,
  is_annotated_video_saved: false,
  crop_image_format: "jpeg",
  crop_margin_percent: 0,
};

const EXPORT_PLAN_KEY = "export-plan";
const EXPORT_PREVIEW_KEY = "export-preview";

function groupFormats(formats: ExportFormat[]): FormatGroup[] {
  const groups: FormatGroup[] = [];
  for (const format of formats) {
    const group = groups.find((entry) => entry.label === format.group_label);
    if (group === undefined) groups.push({ label: format.group_label, formats: [format] });
    else group.formats.push(format);
  }
  return groups;
}

/**
 * Dialog exporting the images as the Images table lists them, or every kept finding of the videos.
 */
export function ExportDialog({
  media,
  exportRows,
  listedPictureCount,
  onExport,
  onLoadPreview,
  onInferAll,
  onDownloadCsv,
  onClose,
}: ExportDialogProps) {
  const dialogs = useDialogs();
  const [error, setError] = useState("");
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stored, setStored] = useStoredState<StoredExportOptions>("ovir-gui.export", {
    purposes: {},
    formats: {},
    tasks: {},
    output_directory: "",
  });
  const [outputDirectory, setOutputDirectory] = useState("");
  const plan = useAsyncResource(`${EXPORT_PLAN_KEY}/${media}`, () => api.exportPlan(media), {
    onLoaded: (loaded) => setOutputDirectory(loaded.default_directory),
    onError: (caught) => setError(errorMessage(caught)),
  });

  const taskOptions: TaskExportOptions = {
    ...DEFAULT_TASK_EXPORT_OPTIONS,
    ...(plan === null ? undefined : stored.tasks[plan.task]),
  };
  const purpose =
    plan?.purposes.find((entry) => entry.value === stored.purposes[plan.task]) ?? plan?.purposes[0];
  const formatKey = plan !== null && purpose !== undefined ? `${plan.task}/${purpose.value}` : "";
  const purposeFormats = plan?.formats.filter((entry) => entry.purpose === purpose?.value) ?? [];
  const format = purposeFormats.find((entry) => entry.value === stored.formats[formatKey]) ?? purposeFormats[0];
  const previewChoice: ExportPreviewChoice | undefined =
    format === undefined
      ? undefined
      : {
          export_format: format.value,
          is_confidence_included:
            format.is_confidence_supported && (format.purpose !== "annotations" || taskOptions.is_confidence_included),
          crop_image_format: taskOptions.crop_image_format,
          crop_margin_percent: taskOptions.crop_margin_percent,
        };
  const preview = useAsyncResource(
    plan === null || previewChoice === undefined
      ? null
      : `${EXPORT_PREVIEW_KEY}/${media}/${JSON.stringify(previewChoice)}/${exportRows.length}`,
    () => (previewChoice === undefined ? Promise.reject(new Error("No format chosen.")) : onLoadPreview(previewChoice)),
    { isStaleShown: false, onError: (caught) => setError(errorMessage(caught)) },
  );
  const change = (update: Partial<StoredExportOptions>) => setStored((current) => ({ ...current, ...update }));
  const changeTaskOptions = (update: Partial<TaskExportOptions>) => {
    if (plan === null) return;
    const task = plan.task;
    setStored((current) => ({
      ...current,
      tasks: { ...current.tasks, [task]: { ...current.tasks[task], ...update } },
    }));
  };

  const submit = async () => {
    if (previewChoice === undefined) return;
    setIsSubmitting(true);
    const isFolderAccepted = await confirmFolder();
    if (!isFolderAccepted) {
      setIsSubmitting(false);
      return;
    }
    const isDone = await onExport({
      ...previewChoice,
      output_directory: outputDirectory,
      is_annotated_image_saved: taskOptions.is_annotated_image_saved,
      is_annotated_video_saved: media === "video" && taskOptions.is_annotated_video_saved,
    });
    setIsSubmitting(false);
    if (isDone) {
      setStored((current) => ({ ...current, output_directory: outputDirectory }));
      onClose();
    }
  };

  const confirmFolder = async () => {
    let entryCount: number;
    try {
      entryCount = (await api.exportFolderEntryCount(outputDirectory)).entry_count;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    }
    if (entryCount === 0) return true;
    return dialogs.confirm({
      title: "Export into a Non-Empty Folder",
      message: `${outputDirectory} already holds ${entryCount} ${entryCount === 1 ? "item" : "items"}. Exported files with the same names replace them.`,
      confirmLabel: "Export and Replace",
      isDanger: true,
    });
  };

  return (
    <>
      <Dialog
        title={media === "image" ? "Export Images" : "Export Videos"}
        onClose={onClose}
        width={560}
        footer={
          <>
            <button
              className="left ghost"
              disabled={exportRows.length === 0}
              onClick={onDownloadCsv}
              title={
                media === "image"
                  ? "Download the exported findings as a CSV table, in the order of the Images table"
                  : "Download the exported findings of the videos as a CSV table"
              }
            >
              Download CSV ({exportRows.length})
            </button>
            <button onClick={onClose}>Cancel</button>
            <button
              className="primary"
              disabled={
                plan === null || plan.issue !== "" || format === undefined || outputDirectory.trim() === "" || isSubmitting
              }
              onClick={() => void submit()}
            >
              Export {exportRows.length}
            </button>
          </>
        }
      >
        {error !== "" && <div className="error-text">{error}</div>}
        {plan !== null && purpose !== undefined && (
          <>
            <div className="hint" title={plan.options_text}>
              {plan.model_name} · <b>{exportRows.length} findings</b>{" "}
              {media === "image"
                ? `on the ${listedPictureCount ?? 0} pictures listed in the Images table`
                : `kept on ${plan.picture_count} inferred frames of the videos`}
            </div>
            {plan.issue !== "" && <div className="error-text">{plan.issue}</div>}
            {plan.pending_count > 0 && (
              <div className="export-pending">
                <span className="grow">
                  {plan.pending_count} {media === "image" ? "images are" : "sampled frames are"} not inferred yet and
                  are left out.
                  {!plan.is_pending_inferable && " Choose the model settings of these results to infer them."}
                </span>
                {plan.is_pending_inferable && (
                  <button
                    className="small"
                    onClick={() => {
                      onInferAll();
                      onClose();
                    }}
                  >
                    Infer All
                  </button>
                )}
              </div>
            )}
            <ExportPurposeCards
              purposes={plan.purposes}
              selected={purpose.value}
              onSelect={(value) => change({ purposes: { ...stored.purposes, [plan.task]: value } })}
            />
            <div className="export-purpose-settings">
              {purpose.value === "annotations" && format !== undefined && (
                <div className="export-form">
                  <span>Format</span>
                  <select
                    value={format.value}
                    onChange={(event) => change({ formats: { ...stored.formats, [formatKey]: event.target.value } })}
                  >
                    {groupFormats(purposeFormats).map((group) =>
                      group.label === "" ? (
                        group.formats.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {entry.label}
                          </option>
                        ))
                      ) : (
                        <optgroup key={group.label} label={group.label}>
                          {group.formats.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </optgroup>
                      ),
                    )}
                  </select>
                  <span />
                  <label title={format.is_confidence_supported ? "" : "This format cannot store confidences"}>
                    <input
                      type="checkbox"
                      checked={taskOptions.is_confidence_included && format.is_confidence_supported}
                      disabled={!format.is_confidence_supported}
                      onChange={(event) => changeTaskOptions({ is_confidence_included: event.target.checked })}
                    />
                    Write confidences
                  </label>
                </div>
              )}
              {purpose.value === "crops" && (
                <div className="crop-settings">
                  <div className="export-form grow">
                    <span>Image</span>
                    <div className="segmented export-choice" role="radiogroup" aria-label="Crop image format">
                      {plan.crop_image_formats.map((entry) => (
                        <button
                          key={entry.value}
                          type="button"
                          role="radio"
                          aria-checked={entry.value === taskOptions.crop_image_format}
                          className={entry.value === taskOptions.crop_image_format ? "active" : ""}
                          onClick={() => changeTaskOptions({ crop_image_format: entry.value })}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                    <span>Margin</span>
                    <div className="row">
                      <NumberField
                        value={taskOptions.crop_margin_percent}
                        onCommit={(value) => changeTaskOptions({ crop_margin_percent: value })}
                        maximum={100}
                        step={5}
                        width={64}
                        title="Added on every side, as a percentage of the box width and height"
                      />
                      <span className="muted">%</span>
                    </div>
                  </div>
                  <CropMarginFigure marginPercent={taskOptions.crop_margin_percent} />
                </div>
              )}
              {purpose.value === "class_folders" && (
                <div className="hint">
                  Pictures whose top class is not kept are copied into <span className="snippet">_unlabeled/</span>.
                </div>
              )}
            </div>
            <div className="export-divider" />
            <div className="export-form">
              <span>Folder</span>
              <div className="row">
                <input
                  type="text"
                  className="grow mono"
                  value={outputDirectory}
                  onChange={(event) => setOutputDirectory(event.target.value)}
                  title="Folder on the server"
                />
                <button onClick={() => setIsBrowsing(true)}>Browse…</button>
                <InfoTip label="Where files are written">
                  Files are written on the server; download them as a ZIP from the status bar afterwards. Formats
                  that refer to image files save video frames as JPEG under <span className="snippet">frames/</span>.
                </InfoTip>
              </div>
              {stored.output_directory !== "" && stored.output_directory !== outputDirectory && (
                <>
                  <span />
                  <button
                    className="ghost small"
                    style={{ justifySelf: "start" }}
                    onClick={() => setOutputDirectory(stored.output_directory)}
                  >
                    Use last: {stored.output_directory}
                  </button>
                </>
              )}
              <span>Also save</span>
              <div className="row wrap export-extras">
                <label
                  title={
                    media === "image"
                      ? "Every exported image with its findings drawn, under annotated/"
                      : "Every inferred frame with its findings drawn, under annotated/"
                  }
                >
                  <input
                    type="checkbox"
                    checked={taskOptions.is_annotated_image_saved}
                    onChange={(event) => changeTaskOptions({ is_annotated_image_saved: event.target.checked })}
                  />
                  {media === "image" ? "Annotated images" : "Annotated frames"}
                </label>
                {media === "video" && (
                  <label title="Every video with findings drawn on every frame, under annotated/">
                    <input
                      type="checkbox"
                      checked={taskOptions.is_annotated_video_saved}
                      onChange={(event) => changeTaskOptions({ is_annotated_video_saved: event.target.checked })}
                    />
                    Annotated videos
                  </label>
                )}
              </div>
            </div>
            <LabelSnippet preview={preview} />
          </>
        )}
      </Dialog>
      {isBrowsing && (
        <ServerBrowserDialog
          mode="directory"
          title="Choose Output Folder"
          onChoose={(paths) => {
            const chosen = paths[0];
            if (chosen !== undefined) setOutputDirectory(chosen);
            setIsBrowsing(false);
          }}
          onClose={() => setIsBrowsing(false)}
        />
      )}
    </>
  );
}
