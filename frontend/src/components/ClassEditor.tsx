import { type DragEvent, useMemo, useRef, useState } from "react";
import { api, attempt } from "../api/client";
import type { ClassEntry, ClassSetState } from "../api/types";
import { SWATCH_FALLBACK_COLOR } from "../lib/frameView";
import { toggledMembership } from "../lib/sets";
import { ClassRow } from "./classTree/ClassRow";
import {
  type DragPayload,
  type DropTarget,
  type Editing,
  isRowPresent,
  isSameRow,
  removalOf,
  type TreeRow,
} from "./classTree/classTreeModel";
import { InlineInput } from "./classTree/InlineInput";
import { PhraseRow } from "./classTree/PhraseRow";
import { ReferenceRow } from "./classTree/ReferenceRow";
import { useDialogs } from "./DialogHost";
import { SaveGlyph, TrashGlyph } from "./Glyphs";
import { type MenuEntry, useMenu } from "./Menu";

interface ClassEditorProps {
  classes: ClassEntry[];
  classSet: ClassSetState;
  isImagePromptSupported: boolean;
  onReport: (message: string) => void;
  onAddImagePrompt: (classIndex: number) => void;
  onOpenLibrary: () => void;
  onEditAsText: () => void;
}

const DRAG_TYPE = "application/x-ovir-query";

export function ClassEditor({
  classes,
  classSet,
  isImagePromptSupported,
  onReport,
  onAddImagePrompt,
  onOpenLibrary,
  onEditAsText,
}: ClassEditorProps) {
  const dialogs = useDialogs();
  const menu = useMenu();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<TreeRow | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const treeElement = useRef<HTMLDivElement>(null);

  if (selected !== null && !isRowPresent(selected, classes)) setSelected(null);

  const run = (action: () => Promise<unknown>): Promise<boolean> => attempt(action, onReport);

  const expand = (name: string) => setExpanded((current) => new Set(current).add(name));

  const startNewRow = () => {
    if (selected === null) {
      setEditing({ kind: "new-class", position: classes.length });
      return;
    }
    const entry = classes[selected.classIndex];
    if (entry === undefined) return;
    switch (selected.kind) {
      case "class":
        setEditing({ kind: "new-class", position: selected.classIndex + 1 });
        break;
      case "phrase":
        setEditing({ kind: "new-phrase", classIndex: selected.classIndex, position: selected.phraseIndex + 1 });
        break;
      case "reference":
        expand(entry.name);
        setEditing({ kind: "new-phrase", classIndex: selected.classIndex, position: entry.phrases.length });
        break;
    }
  };

  const removeSelection = async () => {
    if (selected === null) return;
    const body = removalOf(selected);
    if (await run(() => api.removeClassRows(body))) setSelected(null);
  };

  const commitEditing = async (value: string): Promise<boolean> => {
    if (editing === null) return true;
    let isDone = false;
    switch (editing.kind) {
      case "rename-class":
        isDone = await run(() => api.renameClass(editing.classIndex, value));
        break;
      case "rename-phrase":
        isDone = await run(() => api.renamePhrase(editing.classIndex, editing.phraseIndex, value));
        break;
      case "new-class":
        isDone = await run(() => api.addClassRow(value, null, editing.position));
        if (isDone) {
          if (value.includes(":")) expand(value.split(":")[0]?.trim() ?? "");
          setSelected({ kind: "class", classIndex: Math.min(editing.position, classes.length) });
        }
        break;
      case "new-phrase": {
        isDone = await run(() => api.addClassRow(value, editing.classIndex, editing.position));
        const entry = classes[editing.classIndex];
        if (isDone && entry !== undefined) {
          expand(entry.name);
          setSelected({ kind: "phrase", classIndex: editing.classIndex, phraseIndex: editing.position });
        }
        break;
      }
    }
    if (isDone) {
      setEditing(null);
      treeElement.current?.focus();
    }
    return isDone;
  };

  const onDragStart = (event: DragEvent, payload: DragPayload) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const acceptsDrag = (event: DragEvent) => event.dataTransfer.types.includes(DRAG_TYPE);

  const onDragOver = (event: DragEvent, target: DropTarget) => {
    if (!acceptsDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(target);
  };

  const onDrop = async (event: DragEvent) => {
    const target = dropTarget;
    setDropTarget(null);
    if (!acceptsDrag(event) || target === null) return;
    event.preventDefault();
    event.stopPropagation();
    const payload = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as DragPayload;
    if (payload.kind === "reference") {
      const targetClassIndex = target.kind === "end" ? null : target.classIndex;
      if (targetClassIndex !== null && targetClassIndex !== payload.classIndex) {
        await run(() => api.moveReference(payload.classIndex, payload.name, payload.digest, targetClassIndex));
      }
      return;
    }
    switch (target.kind) {
      case "into-class": {
        const entry = classes[target.classIndex];
        if (entry === undefined || target.classIndex === payload.classIndex) return;
        await run(() => api.movePhrase(payload.classIndex, payload.phraseIndex, target.classIndex, entry.phrases.length));
        expand(entry.name);
        break;
      }
      case "before-phrase":
        await run(() => api.movePhrase(payload.classIndex, payload.phraseIndex, target.classIndex, target.phraseIndex));
        break;
      case "before-class":
        await run(() => api.movePhrase(payload.classIndex, payload.phraseIndex, null, target.classIndex));
        break;
      case "end":
        await run(() => api.movePhrase(payload.classIndex, payload.phraseIndex, null, classes.length));
        break;
    }
  };

  const chooseClassSet = async (name: string) => {
    if (name === "" || (name === classSet.name && !classSet.is_edited)) return;
    if (classSet.is_unsaved) {
      const described = classSet.name === "" ? "the current unsaved classes" : `the unsaved edits to '${classSet.name}'`;
      const isConfirmed = await dialogs.confirm({
        title: "Load Class Set",
        message: `Load the class set '${name}' and discard ${described}?`,
        confirmLabel: "Discard and Load",
        isDanger: true,
      });
      if (!isConfirmed) return;
    }
    if (await run(() => api.loadClassSet(name))) onReport(`Loaded the class set '${name}'.`);
  };

  const saveClassSet = async () => {
    const name = await dialogs.prompt({
      title: "Save Class Set",
      label: "Set name",
      initialValue: classSet.name,
      confirmLabel: "Save",
      hint: `Saved with the phrases and reference images in ${classSet.directory}.`,
    });
    if (name === null) return;
    if (classSet.names.includes(name) && name !== classSet.name) {
      const isConfirmed = await dialogs.confirm({
        title: "Replace Class Set",
        message: `A class set named '${name}' exists. Replace it?`,
        confirmLabel: "Replace",
        isDanger: true,
      });
      if (!isConfirmed) return;
    }
    if (await run(() => api.saveClassSet(name))) onReport(`Saved the class set '${name}'.`);
  };

  const clearAll = async () => {
    const isConfirmed = await dialogs.confirm({
      title: "Clear All Classes",
      message: `Remove all ${classes.length} classes with their prompts and reference images?`,
      confirmLabel: "Clear",
      isDanger: true,
    });
    if (isConfirmed) await run(api.clearClasses);
  };

  const promptEntries = (entry: ClassEntry, classIndex: number): MenuEntry[] => [
    {
      label: "Text Prompt",
      onSelect: () => {
        expand(entry.name);
        setSelected({ kind: "class", classIndex });
        setEditing({ kind: "new-phrase", classIndex, position: entry.phrases.length });
      },
    },
    {
      label: isImagePromptSupported ? "Image Prompt…" : "Image Prompt… (needs OWL-ViT or YOLOE)",
      isDisabled: !isImagePromptSupported,
      onSelect: () => {
        setSelected({ kind: "class", classIndex });
        onAddImagePrompt(classIndex);
      },
    },
  ];

  const rows = useMemo(() => classes.map((entry, classIndex) => ({ entry, classIndex })), [classes]);

  const renderEditing = (placeholder: string, initialValue = "") => (
    <InlineInput
      initialValue={initialValue}
      placeholder={placeholder}
      onCommit={commitEditing}
      onCancel={() => {
        setEditing(null);
        treeElement.current?.focus();
      }}
    />
  );

  const newClassRow = (position: number) =>
    editing?.kind === "new-class" && editing.position === position ? (
      <div className="tree-row">
        <span className="toggle" />
        <span className="swatch" style={{ background: SWATCH_FALLBACK_COLOR }} />
        {renderEditing("class or class: phrase, phrase")}
      </div>
    ) : null;

  return (
    <>
      <div className="row">
        <select
          className="grow"
          value={classSet.names.includes(classSet.name) ? classSet.name : ""}
          disabled={classSet.names.length === 0}
          title={
            classSet.names.length === 0
              ? "Save the classes to load them here later and pick up where you left off."
              : `Class sets saved in ${classSet.directory}; choose one to load it and resume.`
          }
          onChange={(event) => void chooseClassSet(event.target.value)}
        >
          <option value="" disabled>
            {classSet.names.length === 0 ? "Save to reuse later" : "Load a saved set…"}
          </option>
          {classSet.names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {classSet.name !== "" && classSet.is_edited && <span className="badge warning">Edited</span>}
        <button
          className="ghost icon"
          onClick={() => void saveClassSet()}
          disabled={classes.length === 0}
          title="Save the classes as a class set…"
          aria-label="Save class set"
        >
          <SaveGlyph />
        </button>
        <button className="ghost icon" onClick={() => void removeSelection()} disabled={selected === null} title="Remove (Delete)">
          <TrashGlyph />
        </button>
        <button
          className="ghost icon"
          title="More"
          onClick={(event) =>
            menu.openBelow(event.currentTarget, [
              { label: "Class Sets…", onSelect: onOpenLibrary },
              { label: "Edit as Text…", onSelect: onEditAsText },
              { label: "Open File…", onSelect: () => fileInput.current?.click() },
              { isSeparator: true, label: "" },
              { label: "Clear All…", onSelect: () => void clearAll(), isDisabled: classes.length === 0 },
            ])
          }
        >
          ⋯
        </button>
      </div>
      <div
        ref={treeElement}
        className="list class-tree"
        tabIndex={0}
        onKeyDown={(event) => {
          if (editing !== null) return;
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            void removeSelection();
          } else if (event.key === "F2" && selected !== null) {
            if (selected.kind === "class") setEditing({ kind: "rename-class", classIndex: selected.classIndex });
            if (selected.kind === "phrase") {
              setEditing({ kind: "rename-phrase", classIndex: selected.classIndex, phraseIndex: selected.phraseIndex });
            }
          } else if (event.key === "Enter") {
            startNewRow();
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
        }}
        onDrop={(event) => void onDrop(event)}
      >
        {rows.map(({ entry, classIndex }) => {
          const isExpanded = expanded.has(entry.name);
          const isReferenceOnly = entry.phrases.length === 0 && entry.references.length > 0;
          const isAddingPhraseAtEnd =
            editing?.kind === "new-phrase" &&
            editing.classIndex === classIndex &&
            editing.position >= entry.phrases.length;
          return (
            <div key={`${classIndex}:${entry.name}`}>
              {newClassRow(classIndex)}
              <ClassRow
                entry={entry}
                classIndex={classIndex}
                isExpanded={isExpanded}
                isSelected={isSameRow(selected, { kind: "class", classIndex })}
                isDropInto={dropTarget?.kind === "into-class" && dropTarget.classIndex === classIndex}
                isDropBefore={dropTarget?.kind === "before-class" && dropTarget.classIndex === classIndex}
                isDisabled={isReferenceOnly && !isImagePromptSupported}
                renameInput={
                  editing?.kind === "rename-class" && editing.classIndex === classIndex
                    ? renderEditing("class name", entry.name)
                    : null
                }
                onSelect={() => setSelected({ kind: "class", classIndex })}
                onRename={() => setEditing({ kind: "rename-class", classIndex })}
                onToggleExpanded={() => setExpanded((current) => toggledMembership(current, entry.name))}
                onDragOver={onDragOver}
              />
              {isExpanded &&
                entry.phrases.map((phrase, phraseIndex) => (
                  <div key={`p-${phraseIndex}`}>
                    {editing?.kind === "new-phrase" &&
                      editing.classIndex === classIndex &&
                      editing.position === phraseIndex && (
                        <div className="tree-row child">{renderEditing("phrase, phrase")}</div>
                      )}
                    <PhraseRow
                      phrase={phrase}
                      isSelected={isSameRow(selected, { kind: "phrase", classIndex, phraseIndex })}
                      isDropBefore={
                        dropTarget?.kind === "before-phrase" &&
                        dropTarget.classIndex === classIndex &&
                        dropTarget.phraseIndex === phraseIndex
                      }
                      isDraggable={editing === null}
                      renameInput={
                        editing?.kind === "rename-phrase" &&
                        editing.classIndex === classIndex &&
                        editing.phraseIndex === phraseIndex
                          ? renderEditing("phrase", phrase)
                          : null
                      }
                      onSelect={() => setSelected({ kind: "phrase", classIndex, phraseIndex })}
                      onRename={() => setEditing({ kind: "rename-phrase", classIndex, phraseIndex })}
                      onDragStart={(event) => onDragStart(event, { kind: "phrase", classIndex, phraseIndex })}
                      onDragEnd={() => setDropTarget(null)}
                      onDragOver={(event) => onDragOver(event, { kind: "before-phrase", classIndex, phraseIndex })}
                    />
                  </div>
                ))}
              {isAddingPhraseAtEnd && <div className="tree-row child">{renderEditing("phrase, phrase")}</div>}
              {isExpanded &&
                entry.references.map((reference) => (
                  <ReferenceRow
                    key={`r-${reference.digest}-${reference.name}`}
                    reference={reference}
                    isSelected={isSameRow(selected, {
                      kind: "reference",
                      classIndex,
                      name: reference.name,
                      digest: reference.digest,
                    })}
                    isImagePromptSupported={isImagePromptSupported}
                    onSelect={() =>
                      setSelected({ kind: "reference", classIndex, name: reference.name, digest: reference.digest })
                    }
                    onDragStart={(event) =>
                      onDragStart(event, {
                        kind: "reference",
                        classIndex,
                        name: reference.name,
                        digest: reference.digest,
                      })
                    }
                    onDragEnd={() => setDropTarget(null)}
                    onDragOver={(event) => onDragOver(event, { kind: "into-class", classIndex })}
                  />
                ))}
              {isExpanded && !isAddingPhraseAtEnd && (
                <div className="tree-row child tree-add-prompt">
                  <button
                    className="ghost"
                    onClick={(event) => menu.openBelow(event.currentTarget, promptEntries(entry, classIndex))}
                    title={`Add a text or image prompt to ${entry.name}`}
                  >
                    + Add Prompt
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {newClassRow(classes.length)}
        {!(editing?.kind === "new-class" && editing.position === classes.length) && (
          <button
            className="ghost tree-add-class"
            onClick={() => {
              setSelected(null);
              setEditing({ kind: "new-class", position: classes.length });
            }}
            title="Add a class; write 'class: phrase, phrase' to give it several phrases"
          >
            + Add Class
          </button>
        )}
        <div
          className={`tree-drop-end${dropTarget?.kind === "end" ? " drop-before" : ""}`}
          onDragOver={(event) => onDragOver(event, { kind: "end" })}
          onClick={() => setSelected(null)}
          onDoubleClick={() => setEditing({ kind: "new-class", position: classes.length })}
          title="Double-click to add a class"
        />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".ovirset,.txt,.names"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) void run(() => api.loadClassFile(file));
        }}
      />
      {menu.element}
    </>
  );
}
