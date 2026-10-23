import { useCallback, useMemo, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { Box, DrawingKindValue, MarkEntry, PictureKey, PicturePrompt, WorkspaceState } from "../api/types";
import { PromptOverlay } from "../components/PromptOverlay";
import type { ViewerDrawing } from "../lib/viewerDrawing";
import type { Call } from "./useActionRunner";

export interface PicturePromptEditor {
  kind: DrawingKindValue | null;
  prompt: PicturePrompt | null;
  isEnabled: boolean;
  className: string | null;
  activeObjectId: number | null;
  isSequential: boolean;
  isPointSupported: boolean;
  drawing: ViewerDrawing | null;
  setIsEnabled: (isEnabled: boolean) => void;
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

const DRAW_COLOR = "#ffcc00";

function kindOf(state: WorkspaceState | null): DrawingKindValue | null {
  const kinds = state?.model.drawing_kinds ?? [];
  if (kinds.includes("mark")) return "mark";
  if (kinds.includes("exemplar")) return "exemplar";
  return null;
}

export function usePicturePromptEditor({ state, call, report }: PicturePromptEditorOptions): PicturePromptEditor {
  const kind = kindOf(state);
  const prompt = state?.picture_prompt ?? null;
  const isSequential = state?.model.is_sequential ?? false;
  const isPointSupported = state?.model.is_point_supported ?? true;
  const classNames = useMemo(() => (state?.classes ?? []).map((entry) => entry.name), [state?.classes]);
  const classColors = useMemo(
    () => Object.fromEntries((state?.classes ?? []).map((entry) => [entry.name, entry.color])),
    [state?.classes],
  );
  const [isEnabled, setIsEnabled] = useState(true);
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
    (box: Box, isNegative: boolean) => {
      if (picture === null || className === null) {
        report("Add a class first; drawings are attached to a class.");
        return;
      }
      if (kind === "exemplar") {
        void call(() => api.addExemplar(picture, className, box, !isNegative));
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
    [picture, className, kind, activeMark, call, report, saveMark, reusableObjectId],
  );

  const onPoint = useCallback(
    (point: [number, number], isNegative: boolean) => {
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
        report("Click on the object first; a right-click then excludes a spot from it.");
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
    [picture, className, isPointSupported, activeMark, report, saveMark, reusableObjectId],
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
          isExemplarShown={kind === "exemplar"}
          isMarkShown={kind === "mark"}
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
    kind,
    prompt,
    isEnabled,
    className,
    activeObjectId,
    isSequential,
    isPointSupported,
    drawing,
    setIsEnabled,
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
