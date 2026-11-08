import { useCallback, useMemo, useState } from "react";
import { api, errorMessage } from "@/api/client";
import type {
  Box,
  DrawingKindEntry,
  DrawingKindValue,
  ExemplarEntry,
  MarkEntry,
  PictureKey,
  PicturePrompt,
  WorkspaceState,
} from "@/api/types";
import { PromptOverlay } from "./PromptOverlay";
import { DrawingHint } from "./DrawingHint";
import { ObjectBar } from "./ObjectBar";
import { ExemplarBar } from "./ExemplarBar";
import type { PromptItem } from "./promptItem";
import type { ViewerDrawing } from "@/features/canvas/viewerDrawing";
import type { Call } from "@/behaviors/useActionRunner";

/**
 * What a click or drag on the picture does: nothing while no drawing tool is on (results are picked and the picture
 * pans), mark one object, or box an exemplar.
 */
export type DrawingTool = "select" | DrawingKindValue;

export interface UnusedDrawings {
  exemplarCount: number;
  markCount: number;
}

export interface PicturePromptEditor {
  kinds: readonly DrawingKindEntry[];
  tool: DrawingTool;
  kind: DrawingKindValue | null;
  prompt: PicturePrompt | null;
  isExcluding: boolean;
  className: string | null;
  activeObjectId: number | null;
  selected: PromptItem | null;
  hovered: PromptItem | null;
  canUndo: boolean;
  canRedo: boolean;
  isSequential: boolean;
  isPointSupported: boolean;
  backend: string;
  unused: UnusedDrawings;
  drawing: ViewerDrawing | null;
  toggleTool: (kind: DrawingKindValue) => void;
  stopDrawing: () => void;
  setIsExcluding: (isExcluding: boolean) => void;
  chooseClass: (className: string) => void;
  chooseObject: (objectId: number | null) => void;
  finishObject: () => void;
  selectItem: (item: PromptItem | null) => void;
  hoverItem: (item: PromptItem | null) => void;
  removeItem: (item: PromptItem) => void;
  removeSelected: () => void;
  undo: () => void;
  redo: () => void;
  removeActiveObject: () => void;
  removeObjectEverywhere: () => void;
  removeUnused: () => void;
  clearPicture: () => void;
  startDrawing: (kind: DrawingKindValue, className: string) => void;
  focusDrawing: (kind: DrawingKindValue, className: string, picture: PictureKey, objectId: number | null) => void;
}

interface PicturePromptEditorOptions {
  state: WorkspaceState | null;
  call: Call;
  report: (text: string) => void;
}

interface KindChoice {
  modelKey: string;
  kind: DrawingKindValue;
}

const DRAW_COLOR = "#ffffff";
const KIND_PREFERENCE: DrawingKindValue[] = ["mark", "exemplar"];
const NO_KINDS: DrawingKindEntry[] = [];
const PICK_RADIUS_PIXELS = 10;

/**
 * The drawing the user chose for the current model when the model reads it, or else the one the model reads first.
 */
function kindOf(kinds: readonly DrawingKindEntry[], chosen: DrawingKindValue | null): DrawingKindValue | null {
  const usable = kinds.filter((entry) => entry.is_used);
  if (chosen !== null && usable.some((entry) => entry.value === chosen)) return chosen;
  return KIND_PREFERENCE.find((value) => usable.some((entry) => entry.value === value)) ?? null;
}

function isSamePicture(left: PictureKey, right: PictureKey): boolean {
  return left.path === right.path && left.frame === right.frame;
}

function modelKeyOf(state: WorkspaceState | null): string {
  return state === null ? "" : `${state.model.selection.backend}/${state.model.selection.preset_name}`;
}

interface PictureItem {
  picture: PictureKey;
  item: PromptItem;
}

function lastPointOf(mark: MarkEntry): [number, number] {
  const point = mark.positive_points.at(-1) ?? mark.negative_points.at(-1);
  if (point !== undefined) return point;
  return mark.box === null ? [0, 0] : [mark.box[2], mark.box[1]];
}

export function usePicturePromptEditor({ state, call, report }: PicturePromptEditorOptions): PicturePromptEditor {
  const kinds = state?.model.drawing_kinds ?? NO_KINDS;
  const modelKey = modelKeyOf(state);
  const backend = state?.model.selection.backend ?? "";
  const [kindChoice, setKindChoice] = useState<KindChoice | null>(null);
  const kind = kindOf(kinds, kindChoice?.modelKey === modelKey ? kindChoice.kind : null);
  const isKindUsed = (value: DrawingKindValue) => kinds.some((entry) => entry.value === value && entry.is_used);
  const prompt = state?.picture_prompt ?? null;
  const isSequential = state?.model.is_sequential ?? false;
  const isPointSupported = state?.model.is_point_supported ?? true;
  const classNames = useMemo(() => (state?.classes ?? []).map((entry) => entry.name), [state?.classes]);
  const classColors = useMemo(
    () => Object.fromEntries((state?.classes ?? []).map((entry) => [entry.name, entry.color])),
    [state?.classes],
  );
  const [isSelecting, setIsSelecting] = useState(true);
  const [isExcluding, setIsExcluding] = useState(false);
  const [chosenClass, setChosenClass] = useState<string | null>(null);
  const [activeObjectId, setActiveObjectId] = useState<number | null>(null);
  const [awaitedPicture, setAwaitedPicture] = useState<PictureKey | null>(null);
  // An object the server just numbered, which the state lists only once it arrives.
  const [pendingObjectId, setPendingObjectId] = useState<number | null>(null);
  const [chosenExemplar, setChosenExemplar] = useState<PictureItem | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<PictureItem | null>(null);
  const tool: DrawingTool = isSelecting || kind === null ? "select" : kind;
  const className = chosenClass !== null && classNames.includes(chosenClass) ? chosenClass : (classNames[0] ?? null);
  const picture: PictureKey | null = useMemo(
    () => (prompt === null ? null : { path: prompt.path, frame: prompt.frame }),
    [prompt],
  );

  if (awaitedPicture !== null && prompt !== null && isSamePicture(awaitedPicture, prompt)) setAwaitedPicture(null);

  // The chosen object is dropped once it is gone, e.g. after undoing its first point, unless it was just created.
  if (activeObjectId !== null && prompt !== null && awaitedPicture === null) {
    const isKnown = isSequential
      ? prompt.objects.some((entry) => entry.object_id === activeObjectId)
      : prompt.marks.some((entry) => entry.object_id === activeObjectId);
    if (isKnown && pendingObjectId === activeObjectId) setPendingObjectId(null);
    if (!isKnown && pendingObjectId !== activeObjectId) setActiveObjectId(null);
  }

  const itemOnPicture = (entry: PictureItem | null): PromptItem | null => {
    if (entry === null || prompt === null || !isSamePicture(entry.picture, prompt)) return null;
    const { item } = entry;
    const isPresent =
      item.kind === "object"
        ? prompt.marks.some((mark) => mark.object_id === item.objectId)
        : item.index < prompt.exemplars.length;
    return isPresent ? item : null;
  };
  const chosenExemplarItem = itemOnPicture(chosenExemplar);
  const selectedExemplarIndex = activeObjectId === null && chosenExemplarItem?.kind === "exemplar" ? chosenExemplarItem.index : null;
  const selectedExemplar: ExemplarEntry | null =
    selectedExemplarIndex === null ? null : (prompt?.exemplars[selectedExemplarIndex] ?? null);
  const selected: PromptItem | null = useMemo(
    () =>
      activeObjectId !== null
        ? { kind: "object", objectId: activeObjectId }
        : selectedExemplarIndex !== null
          ? { kind: "exemplar", index: selectedExemplarIndex }
          : null,
    [activeObjectId, selectedExemplarIndex],
  );
  const hoveredItem = itemOnPicture(hoveredEntry);
  const hoveredKind = hoveredItem?.kind ?? null;
  const hoveredId = hoveredItem === null ? null : hoveredItem.kind === "object" ? hoveredItem.objectId : hoveredItem.index;
  const hovered: PromptItem | null = useMemo(
    () =>
      hoveredKind === null || hoveredId === null
        ? null
        : hoveredKind === "object"
          ? { kind: "object", objectId: hoveredId }
          : { kind: "exemplar", index: hoveredId },
    [hoveredKind, hoveredId],
  );

  const activeMark: MarkEntry | null = prompt?.marks.find((entry) => entry.object_id === activeObjectId) ?? null;
  const isExemplarUsed = isKindUsed("exemplar");
  const isMarkUsed = isKindUsed("mark");
  const unused: UnusedDrawings = {
    exemplarCount: prompt === null || isExemplarUsed ? 0 : prompt.exemplars.length,
    markCount: prompt === null || isMarkUsed ? 0 : prompt.marks.length,
  };

  const saveMark = useCallback(
    async (mark: Omit<MarkEntry, "object_id"> & { object_id: number | null }) => {
      if (picture === null) return;
      try {
        const reply = await api.setMark(picture, mark);
        setPendingObjectId(reply.object_id);
        setActiveObjectId(reply.object_id);
      } catch (error) {
        report(errorMessage(error));
      }
    },
    [picture, report],
  );

  const reusableObjectId = useCallback(
    () =>
      isSequential && activeObjectId !== null && prompt?.objects.some((entry) => entry.object_id === activeObjectId)
        ? activeObjectId
        : null,
    [isSequential, activeObjectId, prompt],
  );

  const onBox = useCallback(
    (box: Box, isInverted: boolean) => {
      if (picture === null || className === null) {
        report("Add a class first; drawings are attached to a class.");
        return;
      }
      if (kind === "exemplar") {
        const isPositive = isExcluding === isInverted;
        void call(() => api.addExemplar(picture, className, box, isPositive));
        return;
      }
      if (activeMark !== null) {
        void saveMark({ ...activeMark, box });
        return;
      }
      void saveMark({
        object_id: reusableObjectId(),
        class_name: className,
        positive_points: [],
        negative_points: [],
        box,
      });
    },
    [picture, className, kind, isExcluding, activeMark, call, report, saveMark, reusableObjectId],
  );

  const onPoint = useCallback(
    (point: [number, number], isInverted: boolean, scale: number) => {
      const isNegative = isExcluding !== isInverted;
      if (picture === null || className === null) {
        report("Add a class first; marks are attached to a class.");
        return;
      }
      if (!isPointSupported) {
        report("This model takes boxes only: drag a box around the object.");
        return;
      }
      const radius = PICK_RADIUS_PIXELS / scale;
      const picked = prompt?.marks.find(
        (mark) =>
          mark.object_id !== activeObjectId &&
          [...mark.positive_points, ...mark.negative_points].some(
            ([x, y]) => Math.hypot(x - point[0], y - point[1]) <= radius,
          ),
      );
      if (picked !== undefined) {
        setActiveObjectId(picked.object_id);
        setChosenClass(picked.class_name);
        return;
      }
      if (activeMark !== null) {
        void saveMark({
          ...activeMark,
          positive_points: isNegative ? activeMark.positive_points : [...activeMark.positive_points, point],
          negative_points: isNegative ? [...activeMark.negative_points, point] : activeMark.negative_points,
        });
        return;
      }
      if (isNegative) {
        report("Click on the object first; a Background click then leaves a part of it out.");
        return;
      }
      void saveMark({
        object_id: reusableObjectId(),
        class_name: className,
        positive_points: [point],
        negative_points: [],
        box: null,
      });
    },
    [
      picture,
      className,
      isPointSupported,
      isExcluding,
      prompt,
      activeObjectId,
      activeMark,
      report,
      saveMark,
      reusableObjectId,
    ],
  );

  const finishObject = useCallback(() => setActiveObjectId(null), []);

  const selectItem = useCallback(
    (item: PromptItem | null) => {
      if (item === null || picture === null) {
        setActiveObjectId(null);
        setChosenExemplar(null);
        return;
      }
      if (item.kind === "object") {
        setChosenExemplar(null);
        setActiveObjectId(item.objectId);
        const mark = prompt?.marks.find((entry) => entry.object_id === item.objectId);
        if (mark !== undefined) setChosenClass(mark.class_name);
        return;
      }
      setActiveObjectId(null);
      setChosenExemplar({ picture, item });
    },
    [picture, prompt],
  );

  const removeItem = useCallback(
    (item: PromptItem) => {
      if (picture === null) return;
      setHoveredEntry(null);
      if (item.kind === "object") {
        if (activeObjectId === item.objectId) setActiveObjectId(null);
        void call(() => api.removeMark(picture, item.objectId));
        return;
      }
      setChosenExemplar(null);
      void call(() => api.removeExemplar(picture, item.index));
    },
    [picture, activeObjectId, call],
  );

  const removeActiveObject = useCallback(() => {
    if (activeObjectId !== null) removeItem({ kind: "object", objectId: activeObjectId });
  }, [activeObjectId, removeItem]);

  const removeObjectEverywhere = useCallback(() => {
    if (picture === null || activeObjectId === null) return;
    const objectId = activeObjectId;
    setActiveObjectId(null);
    void call(() => api.removeObject(picture.path, objectId));
  }, [picture, activeObjectId, call]);

  const removeSelectedExemplar = useCallback(() => {
    if (selectedExemplarIndex !== null) removeItem({ kind: "exemplar", index: selectedExemplarIndex });
  }, [selectedExemplarIndex, removeItem]);

  const deselectExemplar = useCallback(() => setChosenExemplar(null), []);

  const step = useCallback(
    (direction: "undo" | "redo") => {
      if (picture === null) return;
      setChosenExemplar(null);
      setHoveredEntry(null);
      void call(() => (direction === "undo" ? api.undoPicturePrompts(picture.path) : api.redoPicturePrompts(picture.path)));
    },
    [picture, call],
  );

  const hasDrawings = prompt !== null && (prompt.exemplars.length > 0 || prompt.marks.length > 0);
  const drawing: ViewerDrawing | null = useMemo(() => {
    if (prompt === null || (kind === null && !hasDrawings)) return null;
    const isDrawing = tool !== "select";
    const colorOf = (className: string) => classColors[className] ?? "";
    const anchored =
      activeMark !== null && isMarkUsed
        ? {
            point: lastPointOf(activeMark),
            content: (
              <ObjectBar
                mark={activeMark}
                color={colorOf(activeMark.class_name)}
                isSequential={isSequential}
                onFinish={finishObject}
                onRemove={removeActiveObject}
                onRemoveEverywhere={removeObjectEverywhere}
              />
            ),
          }
        : selectedExemplar !== null && isExemplarUsed
          ? {
              point: [selectedExemplar.box[2], selectedExemplar.box[1]] as [number, number],
              content: (
                <ExemplarBar
                  exemplar={selectedExemplar}
                  color={colorOf(selectedExemplar.class_name)}
                  onDone={deselectExemplar}
                  onRemove={removeSelectedExemplar}
                />
              ),
            }
          : null;
    return {
      color: DRAW_COLOR,
      isDrawing,
      onBox,
      onPoint: tool === "mark" ? onPoint : null,
      onEmptyClick: () => selectItem(null),
      overlay: (scale: number) => (
        <PromptOverlay
          prompt={prompt}
          scale={scale}
          isExemplarShown={isExemplarUsed}
          isMarkShown={isMarkUsed}
          activeObjectId={activeObjectId}
          selected={selected}
          hovered={hovered}
          onPick={isDrawing ? null : selectItem}
        />
      ),
      hint: isDrawing ? (
        <DrawingHint
          tool={tool}
          activeObjectId={activeMark?.object_id ?? null}
          isPointSupported={isPointSupported}
          isSequential={isSequential}
        />
      ) : null,
      anchored,
    };
  }, [
    prompt,
    kind,
    hasDrawings,
    tool,
    activeMark,
    selectedExemplar,
    classColors,
    onBox,
    onPoint,
    isExemplarUsed,
    isMarkUsed,
    activeObjectId,
    selected,
    hovered,
    isPointSupported,
    isSequential,
    finishObject,
    selectItem,
    deselectExemplar,
    removeActiveObject,
    removeSelectedExemplar,
    removeObjectEverywhere,
  ]);

  const chooseClass = useCallback(
    (name: string) => {
      setChosenClass(name);
      if (activeMark !== null && activeMark.class_name !== name) void saveMark({ ...activeMark, class_name: name });
    },
    [activeMark, saveMark],
  );

  const chooseObject = useCallback(
    (objectId: number | null) => {
      setActiveObjectId(objectId);
      const known = prompt?.objects.find((entry) => entry.object_id === objectId);
      if (known !== undefined) setChosenClass(known.class_name);
    },
    [prompt],
  );

  return {
    kinds,
    tool,
    kind,
    prompt,
    isExcluding,
    className,
    activeObjectId,
    selected,
    hovered,
    canUndo: prompt?.can_undo ?? false,
    canRedo: prompt?.can_redo ?? false,
    isSequential,
    isPointSupported,
    backend,
    unused,
    drawing,
    toggleTool: (chosen) => {
      if (chosen === tool) {
        setIsSelecting(true);
        setActiveObjectId(null);
        return;
      }
      if (!isKindUsed(chosen)) return;
      setChosenExemplar(null);
      setIsSelecting(false);
      setIsExcluding(false);
      if (chosen !== kind) setActiveObjectId(null);
      setKindChoice({ modelKey, kind: chosen });
    },
    stopDrawing: () => {
      setIsSelecting(true);
      setActiveObjectId(null);
    },
    setIsExcluding,
    chooseClass,
    chooseObject,
    finishObject,
    selectItem,
    hoverItem: (item) => setHoveredEntry(item === null || picture === null ? null : { picture, item }),
    removeItem,
    removeSelected: () => {
      if (selected !== null) removeItem(selected);
    },
    undo: () => step("undo"),
    redo: () => step("redo"),
    removeActiveObject,
    removeObjectEverywhere,
    removeUnused: () => {
      if (picture === null || prompt === null) return;
      const exemplarIndices = unused.exemplarCount > 0 ? prompt.exemplars.map((entry) => entry.index) : [];
      const markIds = unused.markCount > 0 ? prompt.marks.map((entry) => entry.object_id) : [];
      setChosenExemplar(null);
      void call(() => api.removeDrawings(picture, exemplarIndices, markIds));
    },
    clearPicture: () => {
      if (picture === null) return;
      setActiveObjectId(null);
      setChosenExemplar(null);
      void call(() => api.clearPicturePrompts(picture));
    },
    startDrawing: (chosen, name) => {
      setKindChoice({ modelKey, kind: chosen });
      setChosenClass(name);
      setActiveObjectId(null);
      setAwaitedPicture(null);
      setIsExcluding(false);
      setIsSelecting(false);
    },
    focusDrawing: (chosen, name, target, objectId) => {
      setKindChoice({ modelKey, kind: chosen });
      setChosenClass(name);
      setActiveObjectId(objectId);
      setAwaitedPicture(prompt !== null && isSamePicture(target, prompt) ? null : target);
      setIsSelecting(false);
    },
  };
}
