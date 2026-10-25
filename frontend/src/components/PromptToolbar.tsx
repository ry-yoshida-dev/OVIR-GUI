import type { ClassEntry, DrawingKindValue } from "../api/types";
import type { PicturePromptEditor } from "../hooks/usePicturePromptEditor";
import { InfoTip } from "./InfoTip";

interface PromptToolbarProps {
  editor: PicturePromptEditor;
  classes: ClassEntry[];
  frameStep: number;
}

const KIND_LABELS: Record<DrawingKindValue, { label: string; hint: string }> = {
  exemplar: { label: "Exemplars", hint: "Boxes showing what the class looks like; every look-alike is found" },
  mark: { label: "Objects", hint: "Clicks and boxes marking single objects, each segmented on its own" },
};

const POLARITIES: { label: string; isExcluding: boolean }[] = [
  { label: "+ Include", isExcluding: false },
  { label: "− Exclude", isExcluding: true },
];

const INCLUDE_HINTS: Record<DrawingKindValue, string> = {
  exemplar: "Boxes mark examples of the class",
  mark: "Clicks mark spots on the object",
};

const EXCLUDE_HINTS: Record<DrawingKindValue, string> = {
  exemplar: "Boxes mark look-alikes that are not the class",
  mark: "Clicks mark spots that are not part of the object",
};

function hintOf(editor: PicturePromptEditor, frameStep: number): string {
  if (editor.kind === "exemplar") {
    return "Drag a box around an example with Include (+), or around a look-alike with Exclude (−); hold Ctrl to switch for one box.";
  }
  if (!editor.isPointSupported) return "Drag a box around each object.";
  const sampling = frameStep > 1 ? ` Tracking reads every ${frameStep}th frame; sample every frame for smooth tracks.` : "";
  const tail = editor.isSequential ? ` Mark again on a later frame to correct it, then infer every sampled frame.${sampling}` : "";
  return `Click on an object or drag a box; with Exclude (−), a click removes a spot from the object. Hold Ctrl to switch for one click.${tail}`;
}

export function PromptToolbar({ editor, classes, frameStep }: PromptToolbarProps) {
  const prompt = editor.prompt;
  if (editor.kind === null || prompt === null) return null;
  const marksHere = new Set(prompt.marks.map((mark) => mark.object_id));
  const kind = editor.kind;
  const kindLabel = KIND_LABELS[kind].label;
  const isPolarityChoosable = kind === "exemplar" || editor.isPointSupported;
  return (
    <div className="prompt-toolbar">
      <label title="Draw on the picture; turn off to select and pan">
        <input type="checkbox" checked={editor.isEnabled} onChange={(event) => editor.setIsEnabled(event.target.checked)} />
        {editor.kinds.length > 1 ? "Draw" : kindLabel}
      </label>
      {editor.kinds.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Drawing">
          {editor.kinds.map((entry) => (
            <button
              key={entry.value}
              role="tab"
              aria-selected={entry.value === editor.kind}
              className={entry.value === editor.kind ? "active" : ""}
              title={`${KIND_LABELS[entry.value].hint}${entry.is_used ? "" : " (not read by the chosen model)"}`}
              onClick={() => editor.chooseKind(entry.value)}
            >
              {KIND_LABELS[entry.value].label}
            </button>
          ))}
        </div>
      )}
      {!editor.isKindUsed && (
        <span
          className="badge warning"
          title={`${kindLabel} are kept with their class and read by the models that take them; choose such a model in Models to use them.`}
        >
          Not used by this model
        </span>
      )}
      {isPolarityChoosable && (
        <div className="segmented" role="tablist" aria-label="Polarity">
          {POLARITIES.map((polarity) => (
            <button
              key={polarity.label}
              role="tab"
              aria-selected={polarity.isExcluding === editor.isExcluding}
              className={polarity.isExcluding === editor.isExcluding ? "active" : ""}
              title={polarity.isExcluding ? EXCLUDE_HINTS[kind] : INCLUDE_HINTS[kind]}
              onClick={() => editor.setIsExcluding(polarity.isExcluding)}
            >
              {polarity.label}
            </button>
          ))}
        </div>
      )}
      <select
        value={editor.className ?? ""}
        disabled={classes.length === 0}
        title="Class of the next drawing"
        onChange={(event) => editor.chooseClass(event.target.value)}
      >
        {classes.length === 0 && <option value="">No class</option>}
        {classes.map((entry) => (
          <option key={entry.name} value={entry.name}>
            {entry.name}
          </option>
        ))}
      </select>
      {editor.kind === "mark" && (
        <>
          <select
            value={editor.activeObjectId ?? ""}
            title="Object the next click refines"
            onChange={(event) => editor.chooseObject(event.target.value === "" ? null : Number(event.target.value))}
          >
            <option value="">+ New object</option>
            {(editor.isSequential ? prompt.objects : prompt.objects.filter((entry) => marksHere.has(entry.object_id))).map(
              (entry) => (
                <option key={entry.object_id} value={entry.object_id}>
                  #{entry.object_id} {entry.class_name}
                  {editor.isSequential ? ` (${entry.frames.length} frame${entry.frames.length === 1 ? "" : "s"})` : ""}
                </option>
              ),
            )}
          </select>
          {editor.activeObjectId !== null && marksHere.has(editor.activeObjectId) && (
            <button
              title="Remove the mark of this object on this picture"
              onClick={() => {
                if (editor.activeObjectId !== null) editor.removeMarkHere(editor.activeObjectId);
              }}
            >
              Unmark here
            </button>
          )}
          {editor.isSequential && editor.activeObjectId !== null && (
            <button
              className="danger"
              title="Remove the object from every frame"
              onClick={() => {
                if (editor.activeObjectId !== null) editor.removeObject(editor.activeObjectId);
              }}
            >
              Delete object
            </button>
          )}
        </>
      )}
      {editor.kind === "exemplar" &&
        prompt.exemplars.map((exemplar) => (
          <button
            key={exemplar.index}
            className="prompt-chip"
            title="Remove this exemplar box"
            onClick={() => editor.removeExemplar(exemplar.index)}
          >
            {exemplar.is_positive ? "+" : "−"} {exemplar.class_name} ×
          </button>
        ))}
      <button
        disabled={prompt.exemplars.length === 0 && prompt.marks.length === 0}
        title="Remove every drawing of this picture"
        onClick={editor.clearPicture}
      >
        Clear picture
      </button>
      <span className="grow" />
      <InfoTip label="How to draw">{hintOf(editor, frameStep)}</InfoTip>
    </div>
  );
}
