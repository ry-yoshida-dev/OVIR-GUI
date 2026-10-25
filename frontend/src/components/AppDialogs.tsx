import { api, errorMessage } from "../api/client";
import type { ExportChoice, MediaKindValue, PictureFindings, WorkspaceState } from "../api/types";
import type { Call, RunAction } from "../hooks/useActionRunner";
import { listedPictures, type TableRow } from "../lib/resultTable";
import { ClassSetDialog } from "./ClassSetDialog";
import { ClassTextDialog } from "./ClassTextDialog";
import { ExportDialog } from "./ExportDialog";
import { ReferenceDialog } from "./ReferenceDialog";
import { ServerBrowserDialog } from "./ServerBrowserDialog";

export type AppDialog =
  | { kind: "browse" }
  | { kind: "export"; media: MediaKindValue }
  | { kind: "class-sets" }
  | { kind: "class-text" }
  | { kind: "reference"; classIndex: number };

interface AppDialogsProps {
  dialog: AppDialog | null;
  state: WorkspaceState;
  classSetsVersion: number;
  imageExportRows: TableRow[];
  imageListedRows: TableRow[];
  videoExportRows: TableRow[];
  isLabelConfidenceShown: boolean;
  call: Call;
  runAction: RunAction;
  onReport: (text: string) => void;
  onClose: () => void;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The dialog opened from the panes, if any, with the actions it runs.
 */
export function AppDialogs({
  dialog,
  state,
  classSetsVersion,
  imageExportRows,
  imageListedRows,
  videoExportRows,
  isLabelConfidenceShown,
  call,
  runAction,
  onReport,
  onClose,
}: AppDialogsProps) {
  const listedPayloadOf = (media: MediaKindValue): PictureFindings[] | null =>
    media === "image" ? listedPictures(imageListedRows) : null;

  const exportResults = (media: MediaKindValue, choice: ExportChoice): Promise<boolean> => {
    return runAction(() =>
      api.exportResults({
        ...choice,
        media,
        listed_findings: listedPayloadOf(media),
        is_label_confidence_shown: isLabelConfidenceShown,
      }),
    );
  };

  const saveCsv = async (rows: TableRow[]) => {
    try {
      const blob = await api.tableCsv(
        rows.flatMap((row) =>
          row.kind === "finding"
            ? [{ path: row.path, frame: row.frame, index: row.finding.index }]
            : [],
        ),
      );
      downloadBlob(blob, "findings.csv");
    } catch (error) {
      onReport(errorMessage(error));
    }
  };

  switch (dialog?.kind) {
    case "browse":
      return (
        <ServerBrowserDialog
          mode="media"
          title="Open Images and Videos from the Server"
          onChoose={(paths) => {
            onClose();
            void call(() => api.openPaths(paths));
          }}
          onClose={onClose}
        />
      );
    case "export": {
      const { media } = dialog;
      const exportRows = media === "image" ? imageExportRows : videoExportRows;
      return (
        <ExportDialog
          media={media}
          exportRows={exportRows}
          listedPictureCount={media === "image" ? listedPictures(imageListedRows).length : null}
          onExport={(choice) => exportResults(media, choice)}
          onLoadPreview={(choice) =>
            api.exportPreview({ ...choice, media, listed_findings: listedPayloadOf(media) })
          }
          onInferAll={() => void runAction((isSkippingApproved) => api.runAll(isSkippingApproved))}
          onDownloadCsv={() => void saveCsv(exportRows)}
          onClose={onClose}
        />
      );
    }
    case "class-sets":
      return (
        <ClassSetDialog
          classSet={state.class_set}
          version={classSetsVersion}
          onReport={onReport}
          onClose={onClose}
        />
      );
    case "class-text":
      return <ClassTextDialog classes={state.classes} onClose={onClose} />;
    case "reference": {
      const referenceClass = state.classes[dialog.classIndex];
      if (referenceClass === undefined) return null;
      return (
        <ReferenceDialog
          classIndex={dialog.classIndex}
          classEntry={referenceClass}
          hasShownPicture={state.current !== null}
          onClose={onClose}
        />
      );
    }
    case undefined:
      return null;
  }
}
