import { useState } from "react";
import { api, errorMessage } from "../api/client";
import type {
  CropImageFormatValue,
  ExportChoice,
  ExportFormat,
  ExportPreviewChoice,
  ExportPurposeValue,
  ExportScopeValue,
  LabelPreview,
} from "../api/types";
import { useAsyncResource } from "../hooks/useAsyncResource";
import { useStoredState } from "../hooks/useStoredState";
import { CropMarginFigure } from "./CropMarginFigure";
import { Dialog } from "./Dialog";
import { ExportPurposeCards } from "./ExportPurposeCards";
import { InfoTip } from "./InfoTip";
import { LabelSnippet } from "./LabelSnippet";
import { NumberField } from "./NumberField";
import { ServerBrowserDialog } from "./ServerBrowserDialog";

interface ExportDialogProps {
  hasVideos: boolean;
  listedFindingCount: number;
  onExport: (choice: ExportChoice) => Promise<boolean>;
  onLoadPreview: (choice: ExportPreviewChoice) => Promise<LabelPreview>;
  onDownloadCsv: () => void;
  onClose: () => void;
}

interface StoredExportOptions {
  purposes: Record<string, ExportPurposeValue>;
  formats: Record<string, string>;
  is_confidence_included: boolean;
  scope: ExportScopeValue;
  minimum_confidence: number;
  is_annotated_image_saved: boolean;
  is_annotated_video_saved: boolean;
  crop_image_format: CropImageFormatValue;
  crop_margin_percent: number;
  output_directory: string;
}

interface FormatGroup {
  label: string;
  formats: ExportFormat[];
}

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

export function ExportDialog({
  hasVideos,
  listedFindingCount,
  onExport,
  onLoadPreview,
  onDownloadCsv,
  onClose,
}: ExportDialogProps) {
  const [error, setError] = useState("");
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stored, setStored] = useStoredState<StoredExportOptions>("ovir-gui.export", {
    purposes: {},
    formats: {},
    is_confidence_included: true,
    scope: "kept",
    minimum_confidence: 0,
    is_annotated_image_saved: false,
    is_annotated_video_saved: false,
    crop_image_format: "jpeg",
    crop_margin_percent: 0,
    output_directory: "",
  });
  const [outputDirectory, setOutputDirectory] = useState("");
  const plan = useAsyncResource(EXPORT_PLAN_KEY, api.exportPlan, {
    onLoaded: (loaded) => setOutputDirectory(loaded.default_directory),
    onError: (caught) => setError(errorMessage(caught)),
  });

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
            format.is_confidence_supported && (format.purpose !== "annotations" || stored.is_confidence_included),
          scope: stored.scope,
          minimum_confidence: stored.minimum_confidence,
          crop_image_format: stored.crop_image_format,
          crop_margin_percent: stored.crop_margin_percent,
        };
  const preview = useAsyncResource(
    plan === null || previewChoice === undefined
      ? null
      : `${EXPORT_PREVIEW_KEY}/${JSON.stringify(previewChoice)}/${listedFindingCount}`,
    () => (previewChoice === undefined ? Promise.reject(new Error("No format chosen.")) : onLoadPreview(previewChoice)),
    { isStaleShown: false, onError: (caught) => setError(errorMessage(caught)) },
  );
  const change = (update: Partial<StoredExportOptions>) => setStored((current) => ({ ...current, ...update }));

  const submit = async () => {
    if (previewChoice === undefined) return;
    setIsSubmitting(true);
    const isDone = await onExport({
      ...previewChoice,
      output_directory: outputDirectory,
      is_annotated_image_saved: stored.is_annotated_image_saved,
      is_annotated_video_saved: stored.is_annotated_video_saved && hasVideos,
    });
    setIsSubmitting(false);
    if (isDone) {
      setStored((current) => ({ ...current, output_directory: outputDirectory }));
      onClose();
    }
  };

  return (
    <>
      <Dialog
        title="Export Results"
        onClose={onClose}
        width={560}
        footer={
          <>
            <button
              className="left ghost"
              disabled={listedFindingCount === 0}
              onClick={onDownloadCsv}
              title="Download the findings listed in the Images and Videos tables, as filtered and sorted there"
            >
              Download listed CSV ({listedFindingCount})
            </button>
            <button onClick={onClose}>Cancel</button>
            <button
              className="primary"
              disabled={
                plan === null || plan.issue !== "" || format === undefined || outputDirectory.trim() === "" || isSubmitting
              }
              onClick={() => void submit()}
            >
              {plan !== null && plan.pending_count > 0 ? `Infer ${plan.pending_count} and Export` : "Export"}
            </button>
          </>
        }
      >
        {error !== "" && <div className="error-text">{error}</div>}
        {plan !== null && purpose !== undefined && (
          <>
            <div className="hint" title={plan.options_text}>
              {plan.model_name} · {plan.picture_count} pictures
              {plan.pending_count > 0 && <> · {plan.pending_count} are inferred first</>}
            </div>
            {plan.issue !== "" && <div className="error-text">{plan.issue}</div>}
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
                      checked={stored.is_confidence_included && format.is_confidence_supported}
                      disabled={!format.is_confidence_supported}
                      onChange={(event) => change({ is_confidence_included: event.target.checked })}
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
                          aria-checked={entry.value === stored.crop_image_format}
                          className={entry.value === stored.crop_image_format ? "active" : ""}
                          onClick={() => change({ crop_image_format: entry.value })}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                    <span>Margin</span>
                    <div className="row">
                      <NumberField
                        value={stored.crop_margin_percent}
                        onCommit={(value) => change({ crop_margin_percent: value })}
                        maximum={100}
                        step={5}
                        width={64}
                        title="Added on every side, as a percentage of the box width and height"
                      />
                      <span className="muted">%</span>
                    </div>
                  </div>
                  <CropMarginFigure marginPercent={stored.crop_margin_percent} />
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
              <span>Findings</span>
              <div className="row">
                <div className="segmented export-choice" role="radiogroup" aria-label="Exported findings">
                  {plan.scopes.map((scope) => (
                    <button
                      key={scope.value}
                      type="button"
                      role="radio"
                      aria-checked={stored.scope === scope.value}
                      className={stored.scope === scope.value ? "active" : ""}
                      onClick={() => change({ scope: scope.value })}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
                <InfoTip label="Which findings are exported">
                  {plan.scopes.map((scope) => (
                    <div key={scope.value}>
                      <b>{scope.label}</b>: {scope.description}
                    </div>
                  ))}
                </InfoTip>
              </div>
              <span>Min. confidence</span>
              <NumberField
                value={stored.minimum_confidence}
                onCommit={(value) => change({ minimum_confidence: value })}
                width={80}
              />
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
                <label title="Every picture with its findings drawn, under annotated/">
                  <input
                    type="checkbox"
                    checked={stored.is_annotated_image_saved}
                    onChange={(event) => change({ is_annotated_image_saved: event.target.checked })}
                  />
                  Annotated images
                </label>
                {hasVideos && (
                  <label title="Every video with findings drawn on every frame, under annotated/">
                    <input
                      type="checkbox"
                      checked={stored.is_annotated_video_saved}
                      onChange={(event) => change({ is_annotated_video_saved: event.target.checked })}
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
