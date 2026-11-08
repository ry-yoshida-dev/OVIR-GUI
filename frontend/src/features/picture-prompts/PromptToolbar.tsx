import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import type { ClassEntry, DrawingKindValue } from "@/api/types";
import type { PicturePromptEditor } from "./usePicturePromptEditor";
import { InfoTip } from "@/components/InfoTip";
import { isAnyDialogOpen } from "@/components/Dialog";
import { RedoGlyph, TrashGlyph, UndoGlyph } from "@/components/Glyphs";
import { PromptKindTile } from "@/features/classes/class-tree/PromptKindTile";
import { NEGATIVE_COLOR, POSITIVE_COLOR } from "./PromptOverlay";
import { PromptList } from "./PromptList";

interface PromptToolbarProps {
  readonly editor: PicturePromptEditor;
  readonly classes: readonly ClassEntry[];
  readonly frameStep: number;
}

interface ToolEntry {
  value: DrawingKindValue;
  label: string;
  shortcut: string;
  hint: string;
  glyph: ReactNode;
}

const TOOLS: ToolEntry[] = [
  {
    value: "mark",
    label: "Point / Box Prompt",
    shortcut: "P",
    hint: "Click or box one object to cut it out",
    glyph: (
      <>
        <PromptKindTile kind="point" />
        <PromptKindTile kind="box" />
      </>
    ),
  },
  {
    value: "exemplar",
    label: "Exemplar Prompt",
    shortcut: "E",
    hint: "Box one example; every look-alike in the picture is found",
    glyph: <PromptKindTile kind="exemplar" />,
  },
];

const POLARITY_LABELS: Record<DrawingKindValue, [string, string]> = {
  mark: ["Foreground", "Background"],
  exemplar: ["Match", "Not this"],
};

const POLARITY_HINTS: Record<DrawingKindValue, [string, string]> = {
  mark: ["Clicks mark parts that belong to the object", "Clicks mark parts to leave out of the object"],
  exemplar: ["Boxes mark examples of the class", "Boxes mark look-alikes that are not the class"],
};

const SHORTCUTS =
  "P Point / Box Prompt · E Exemplar Prompt · press the lit tool again or Esc to stop drawing · N next object · " +
  "Ctrl/⌘ flips + and − for one click · with no tool lit, click a prompt's pin or edge to choose it · " +
  "Delete removes the chosen prompt · Esc lets it go · Ctrl/⌘+Z undoes, Ctrl/⌘+Shift+Z redoes · " +
  "Shift or Alt + drag pans.";

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function SignPin({ isPositive }: { readonly isPositive: boolean }) {
  return (
    <svg className="sign-pin" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill={isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR} stroke="#fff" strokeWidth="1.5" />
      <path d={isPositive ? "M5 8h6M8 5v6" : "M5 8h6"} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function toolTitleOf(entry: ToolEntry, isUsed: boolean, isOn: boolean, backend: string): string {
  if (isUsed) return isOn ? `Stop drawing (${entry.shortcut} or Esc)` : `${entry.hint} (${entry.shortcut})`;
  return entry.value === "exemplar"
    ? `${entry.hint}. ${backend} does not read exemplars; choose a SAM 3 model in Model to use them.`
    : `${entry.hint}. ${backend} does not read object marks.`;
}

/**
 * Tools for drawing on the picture: what a click does, the class it belongs to and whether it adds or leaves out.
 */
export function PromptToolbar({ editor, classes, frameStep }: PromptToolbarProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { prompt, tool, kinds } = editor;

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Control" || event.key === "Meta") {
      setIsFlipped(true);
      return;
    }
    if (editor.prompt === null || isTyping(event.target) || isAnyDialogOpen()) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && !event.altKey && (key === "z" || key === "y")) {
      const isRedo = key === "y" || event.shiftKey;
      if (isRedo ? editor.canRedo : editor.canUndo) {
        if (isRedo) editor.redo();
        else editor.undo();
      }
      event.preventDefault();
      return;
    }
    if (kinds.length === 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === "p") editor.toggleTool("mark");
    else if (key === "e") editor.toggleTool("exemplar");
    else if (key === "n" && editor.activeObjectId !== null) editor.finishObject();
    else if (event.key === "Escape" && editor.selected !== null) editor.selectItem(null);
    else if (event.key === "Escape" && editor.tool !== "select") editor.stopDrawing();
    else if (
      (event.key === "Delete" || event.key === "Backspace") &&
      editor.selected !== null &&
      event.target instanceof Element &&
      event.target.closest(".viewer, .prompt-toolbar") !== null
    )
      editor.removeSelected();
    else return;
    event.preventDefault();
  });
  const handleKeyUp = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Control" || event.key === "Meta") setIsFlipped(false);
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKeyDown(event);
    const onKeyUp = (event: KeyboardEvent) => handleKeyUp(event);
    const onBlur = () => setIsFlipped(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const unusedCount = editor.unused.exemplarCount + editor.unused.markCount;
  if (prompt === null || (kinds.length === 0 && unusedCount === 0)) return null;

  const isUsed = (value: DrawingKindValue) => kinds.some((entry) => entry.value === value && entry.is_used);
  const shownTools = TOOLS.filter((entry) => kinds.some((kind) => kind.value === entry.value));
  const drawingKind = editor.kind ?? "mark";
  const isDrawing = tool !== "select";
  const isPolarityShown = drawingKind === "exemplar" || editor.isPointSupported;
  const isNegative = editor.isExcluding !== isFlipped;
  const labels = POLARITY_LABELS[drawingKind];
  const hints = POLARITY_HINTS[drawingKind];
  const classColor = classes.find((entry) => entry.name === editor.className)?.color ?? "transparent";
  const marksHere = new Set(prompt.marks.map((mark) => mark.object_id));
  const drawnCount =
    (isUsed("mark") ? prompt.marks.length : 0) + (isUsed("exemplar") ? prompt.exemplars.length : 0);
  const unusedLabel =
    editor.unused.exemplarCount > 0
      ? `exemplar${editor.unused.exemplarCount === 1 ? "" : "s"}`
      : `object mark${editor.unused.markCount === 1 ? "" : "s"}`;
  const sampling =
    editor.isSequential && frameStep > 1
      ? ` Tracking reads every ${frameStep}th frame; sample every frame for smooth tracks.`
      : "";

  return (
    <div className="prompt-toolbar">
      <div className="prompt-toolbar-row">
        <div className="segmented" role="group" aria-label="Tool">
          {shownTools.map((entry) => (
            <button
              key={entry.value}
              aria-pressed={entry.value === tool}
              aria-label={`Add ${entry.label}`}
              className={entry.value === tool ? "active" : ""}
              disabled={!isUsed(entry.value)}
              title={toolTitleOf(entry, isUsed(entry.value), entry.value === tool, editor.backend)}
              onClick={() => editor.toggleTool(entry.value)}
            >
              {entry.glyph}
              <span className="tool-label">
                Add<span className="tool-label-detail"> {entry.label}</span>
              </span>
              <kbd className="tool-key">{entry.shortcut}</kbd>
            </button>
          ))}
        </div>
        <span className="toolbar-separator" />
        <label className="class-pick" title={`Class of the next ${drawingKind === "exemplar" ? "exemplar" : "object"}`}>
          <span className="swatch" style={{ background: classColor }} />
          <select
            value={editor.className ?? ""}
            disabled={classes.length === 0 || !isDrawing}
            onChange={(event) => editor.chooseClass(event.target.value)}
          >
            {classes.length === 0 && <option value="">No class</option>}
            {classes.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        {isPolarityShown && (
          <div className="segmented" role="tablist" aria-label="Polarity">
            {[false, true].map((isExcluding) => (
              <button
                key={String(isExcluding)}
                role="tab"
                aria-selected={isDrawing && isExcluding === isNegative}
                aria-label={labels[isExcluding ? 1 : 0]}
                disabled={!isDrawing}
                className={[isDrawing && isExcluding === isNegative ? "active" : "", isFlipped && isExcluding === isNegative ? "flipped" : ""].join(" ")}
                title={`${hints[isExcluding ? 1 : 0]}; hold Ctrl/⌘ to switch for one click`}
                onClick={() => editor.setIsExcluding(isExcluding)}
              >
                <SignPin isPositive={!isExcluding} />
                <span className="polarity-label">{labels[isExcluding ? 1 : 0]}</span>
              </button>
            ))}
          </div>
        )}
        {editor.isSequential && tool === "mark" && (
          <select
            value={editor.activeObjectId ?? ""}
            title="Object the next click marks; pick one to correct it on this frame"
            onChange={(event) => editor.chooseObject(event.target.value === "" ? null : Number(event.target.value))}
          >
            <option value="">Next click: new object</option>
            {prompt.objects.map((entry) => (
              <option key={entry.object_id} value={entry.object_id}>
                Object {entry.object_id} · {entry.class_name} ({entry.frames.length} frame{entry.frames.length === 1 ? "" : "s"})
              </option>
            ))}
          </select>
        )}
        {editor.isSequential && editor.activeObjectId !== null && !marksHere.has(editor.activeObjectId) && (
          <button className="danger toolbar-button" title="Remove the object from every frame" onClick={editor.removeObjectEverywhere}>
            <TrashGlyph />
            <span className="toolbar-label">Delete object</span>
          </button>
        )}
        <span className="grow" />
        {unusedCount > 0 && (
          <span
            className="unused-drawings"
            title={`${editor.backend} does not read the ${unusedLabel} drawn on this picture. They stay with their class for models that read them until you delete them.`}
          >
            <span>
              {unusedCount}
              <span className="unused-long"> unused {unusedLabel}</span>
              <span className="unused-short"> unused</span>
            </span>
            <button onClick={editor.removeUnused} title={`Delete the unused ${unusedLabel} of this picture`}>
              Delete
            </button>
          </span>
        )}
        <span className="prompt-toolbar-actions">
          <PromptList
            editor={editor}
            isMarkShown={isUsed("mark")}
            isExemplarShown={isUsed("exemplar")}
            colorOf={(name) => classes.find((entry) => entry.name === name)?.color ?? "transparent"}
          />
          <button
            className="ghost icon toolbar-button"
            disabled={!editor.canUndo}
            title="Undo the last change to the prompts of this file (Ctrl/⌘+Z)"
            aria-label="Undo"
            onClick={editor.undo}
          >
            <UndoGlyph />
          </button>
          <button
            className="ghost icon toolbar-button"
            disabled={!editor.canRedo}
            title="Redo the change undone last (Ctrl/⌘+Shift+Z)"
            aria-label="Redo"
            onClick={editor.redo}
          >
            <RedoGlyph />
          </button>
          <span className="toolbar-separator" />
          <button
            className="ghost toolbar-button"
            disabled={drawnCount === 0}
            title="Remove every prompt drawn on this picture; Undo brings them back"
            aria-label="Delete all prompts"
            onClick={editor.clearPicture}
          >
            <TrashGlyph />
            <span className="delete-all-label">Delete all</span>
          </button>
          <InfoTip label="Shortcuts">
            {SHORTCUTS}
            {sampling}
          </InfoTip>
        </span>
      </div>
    </div>
  );
}
