import { useCallback, useMemo, useState } from "react";
import { api, errorMessage } from "../api/client";
import type {
  Box,
  DrawingKindEntry,
  DrawingKindValue,
  MarkEntry,
  PictureKey,
  PicturePrompt,
  WorkspaceState,
} from "../api/types";
import { PromptOverlay } from "../components/PromptOverlay";
import type { ViewerDrawing } from "../lib/viewerDrawing";
import type { Call } from "./useActionRunner";

export interface PicturePromptEditor {
  kinds: DrawingKindEntry[];
  kind: DrawingKindValue | null;
  isKindUsed: boolean;
  prompt: PicturePrompt | null;
  isEnabled: boolean;
  isExcluding: boolean;
  className: string | null;
  activeObjectId: number | null;
  isSequential: boolean;
  isPointSupported: boolean;
  drawing: ViewerDrawing | null;
  setIsEnabled: (isEnabled: boolean) => void;
  setIsExcluding: (isExcluding: boolean) => void;
  chooseKind: (kind: DrawingKindValue) => void;
  chooseClass: (className: string) => void;
  chooseObject: (objectId: number | null) => void;
  removeExemplar: (index: number) => void;
  removeMarkHere: (objectId: number) => void;
  removeObject: (objectId: number) => void;
  clearPicture: () => void;
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

const DRAW_COLOR = "#ffcc00";
const KIND_PREFERENCE: DrawingKindValue[] = ["mark", "exemplar"];
const NO_KINDS: DrawingKindEntry[] = [];

/**
 * The drawing the user chose for the current model, or else the one the model reads.
 */
function kindOf(kinds: DrawingKindEntry[], chosen: DrawingKindValue | null): DrawingKindValue | null {
  if (chosen !== null && kinds.some((entry) => entry.value === chosen)) return chosen;
  const preferred = KIND_PREFERENCE.find((value) => kinds.some((entry) => entry.value === value && entry.is_used));
  return preferred ?? kinds[0]?.value ?? null;
}

function modelKeyOf(state: WorkspaceState | null): string {
  return state === null ? "" : `${state.model.selection.backend}/${state.model.selection.preset_name}`;
}

export function usePicturePromptEditor({ state, call, report }: PicturePromptEditorOptions): PicturePromptEditor {
  const kinds = state?.model.drawing_kinds ?? NO_KINDS;
  const modelKey = modelKeyOf(state);
  const [kindChoice, setKindChoice] = useState<KindChoice | null>(null);
  const kind = kindOf(kinds, kindChoice?.modelKey === modelKey ? kindChoice.kind : null);
  const isKindUsed = kinds.some((entry) => entry.value === kind && entry.is_used);
  const prompt = state?.picture_prompt ?? null;
  const isSequential = state?.model.is_sequential ?? false;
  const isPointSupported = state?.model.is_point_supported ?? true;
  const classNames = useMemo(() => (state?.classes ?? []).map((entry) => entry.name), [state?.classes]);
  const classColors = useMemo(
    () => Object.fromEntries((state?.classes ?? []).map((entry) => [entry.name, entry.color])),
    [state?.classes],
  );
  const [isEnabled, setIsEnabled] = useState(true);
  const [isExcluding, setIsExcluding] = useState(false);
  const [chosenClass, setChosenClass] = useState<string | null>(null);
  const [activeObjectId, setActiveObjectId] = useState<number | null>(null);
  const className = chosenClass !== null && classNames.includes(chosenClass) ? chosenClass : (classNames[0] ?? null);
  const picture: PictureKey | null = useMemo(
    () => (prompt === null ? null : { path: prompt.path, frame: prompt.frame }),
    [prompt],
  );

  if (activeObjectId !== null && prompt !== null) {
    const isKnown = isSequential
      ? prompt.objects.some((entry) => entry.object_id === activeObjectId)
      : prompt.marks.some((entry) => entry.object_id === activeObjectId);
    if (!isKnown) setActiveObjectId(null);
  }

  const activeMark: MarkEntry | null =
    prompt?.marks.find((entry) => entry.object_id === activeObjectId) ?? null;

  const saveMark = useCallback(
    async (mark: Omit<MarkEntry, "object_id"> & { object_id: number | null }) => {
      if (picture === null) return;
      try {
        const reply = await api.setMark(picture, mark);
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
    (point: [number, number], isInverted: boolean) => {
      const isNegative = isExcluding !== isInverted;
      if (picture === null || className === null) {
        report("Add a class first; marks are attached to a class.");
        return;
      }
      if (!isPointSupported) {
        report("This model takes boxes only: drag a box around the object.");
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
        report("Click on the object first; Exclude then removes a spot from it.");
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
    [picture, className, isPointSupported, isExcluding, activeMark, report, saveMark, reusableObjectId],
  );

  const drawing: ViewerDrawing | null = useMemo(() => {
    if (kind === null || prompt === null || !isEnabled) return null;
    return {
      color: DRAW_COLOR,
      onBox,
      onPoint: kind === "mark" ? onPoint : null,
      overlay: (scale: number) => (
        <PromptOverlay
          prompt={prompt}
          scale={scale}
          classColors={classColors}
          activeObjectId={activeObjectId}
          activeKind={kind}
        />
      ),
    };
  }, [kind, prompt, isEnabled, onBox, onPoint, classColors, activeObjectId]);

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
    kind,
    isKindUsed,
    prompt,
    isEnabled,
    isExcluding,
    className,
    activeObjectId,
    isSequential,
    isPointSupported,
    drawing,
    setIsEnabled,
    setIsExcluding,
    chooseKind: (chosen) => {
      setActiveObjectId(null);
      setKindChoice({ modelKey, kind: chosen });
    },
    chooseClass,
    chooseObject,
    removeExemplar: (index) => {
      if (picture !== null) void call(() => api.removeExemplar(picture, index));
    },
    removeMarkHere: (objectId) => {
      if (picture !== null) void call(() => api.removeMark(picture, objectId));
    },
    removeObject: (objectId) => {
      if (picture === null) return;
      setActiveObjectId(null);
      void call(() => api.removeObject(picture.path, objectId));
    },
    clearPicture: () => {
      if (picture === null) return;
      setActiveObjectId(null);
      void call(() => api.clearPicturePrompts(picture));
    },
  };
}
