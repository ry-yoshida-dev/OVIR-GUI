import type { ClassEntry } from "../api/types";
import type { PicturePromptEditor } from "../hooks/usePicturePromptEditor";

interface PromptToolbarProps {
  editor: PicturePromptEditor;
  classes: ClassEntry[];
  frameStep: number;
}

function hintOf(editor: PicturePromptEditor, frameStep: number): string {
  if (editor.kind === "exemplar") return "Drag a box around an example (+); right-drag or Ctrl-drag around a look-alike to exclude (−).";
  if (!editor.isPointSupported) return "Drag a box around each object.";
  const sampling = frameStep > 1 ? ` Tracking reads every ${frameStep}th frame; sample every frame for smooth tracks.` : "";
  const tail = editor.isSequential ? ` Mark again on a later frame to correct it, then Run Video.${sampling}` : "";
  return `Click on an object, right-click to exclude a spot, or drag a box.${tail}`;
}

export function PromptToolbar({ editor, classes, frameStep }: PromptToolbarProps) {
  const prompt = editor.prompt;
  if (editor.kind === null || prompt === null) return null;
  const marksHere = new Set(prompt.marks.map((mark) => mark.object_id));
  return (
    <div className="prompt-toolbar">
      <label title="Draw on the picture; turn off to select and pan">
        <input type="checkbox" checked={editor.isEnabled} onChange={(event) => editor.setIsEnabled(event.target.checked)} />
        {editor.kind === "exemplar" ? "Exemplars" : "Mark objects"}
      </label>
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
      <span className="hint">{hintOf(editor, frameStep)}</span>
    </div>
  );
}
