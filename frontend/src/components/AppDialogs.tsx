import { api, errorMessage } from "../api/client";
import type { ExportChoice, PictureFindings, WorkspaceState } from "../api/types";
import type { Call, RunAction } from "../hooks/useActionRunner";
import { groupFindings, type TableRow } from "../lib/resultTable";
import { ClassSetDialog } from "./ClassSetDialog";
import { ClassTextDialog } from "./ClassTextDialog";
import { ExportDialog } from "./ExportDialog";
import { ReferenceDialog } from "./ReferenceDialog";
import { ServerBrowserDialog } from "./ServerBrowserDialog";

export type AppDialog =
  | { kind: "browse" }
  | { kind: "export" }
  | { kind: "class-sets" }
  | { kind: "class-text" }
  | { kind: "reference"; classIndex: number };

interface AppDialogsProps {
  dialog: AppDialog | null;
  state: WorkspaceState;
  classSetsVersion: number;
  hasVideos: boolean;
  isFiltered: boolean;
  filteredRows: TableRow[];
  listedFindingRows: TableRow[];
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
  hasVideos,
  isFiltered,
  filteredRows,
  listedFindingRows,
  isLabelConfidenceShown,
  call,
  runAction,
  onReport,
  onClose,
}: AppDialogsProps) {
  const exportResults = (choice: ExportChoice): Promise<boolean> => {
    const listedPayload: PictureFindings[] | null =
      choice.scope === "listed" && isFiltered
        ? groupFindings(filteredRows)
        : null;
    return runAction((isSkippingApproved) =>
      api.exportResults({
        ...choice,
        listed_findings: listedPayload,
        is_label_confidence_shown: isLabelConfidenceShown,
        is_skipping_approved: isSkippingApproved,
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
    case "export":
      return (
        <ExportDialog
          hasVideos={hasVideos}
          listedFindingCount={listedFindingRows.length}
          onExport={exportResults}
          onDownloadCsv={() => void saveCsv(listedFindingRows)}
          onClose={onClose}
        />
      );
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
