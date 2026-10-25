import type { PromptModeValue, QueryKindValue } from "../api/types";

export type PromptInputKind = "everything" | QueryKindValue | "video";

export interface PromptInput {
  kind: PromptInputKind;
  label: string;
  hint: string;
}

export interface PromptCapabilities {
  prompt_mode: PromptModeValue;
  query_kinds: QueryKindValue[];
  is_sequential: boolean;
}

const PROMPT_INPUTS: PromptInput[] = [
  {
    kind: "everything",
    label: "Everything",
    hint: "Every region of the picture is segmented; no classes are needed",
  },
  {
    kind: "text",
    label: "Phrases",
    hint: "Classes are found from their phrases",
  },
  {
    kind: "visual",
    label: "Example images",
    hint: "Classes are found from example images with boxes around the objects",
  },
  {
    kind: "exemplar",
    label: "Exemplar boxes",
    hint: "Boxes drawn on a picture show (+) or exclude (−) a class there",
  },
  {
    kind: "mark",
    label: "Clicks and boxes",
    hint: "Clicks and boxes drawn on a picture mark each object",
  },
  {
    kind: "video",
    label: "Video tracking",
    hint: "Objects are followed from frame to frame through a video",
  },
];

export function promptInputKindsOf(
  model: PromptCapabilities,
): Set<PromptInputKind> {
  const kinds = new Set<PromptInputKind>(
    model.prompt_mode === "automatic" ? ["everything"] : model.query_kinds,
  );
  if (model.is_sequential) kinds.add("video");
  return kinds;
}

/**
 * The inputs accepted by any of the models, in a fixed order so they can head table columns.
 */
export function promptInputsAcross(
  models: PromptCapabilities[],
): PromptInput[] {
  const kinds = new Set(
    models.flatMap((model) => [...promptInputKindsOf(model)]),
  );
  return PROMPT_INPUTS.filter((input) => kinds.has(input.kind));
}
