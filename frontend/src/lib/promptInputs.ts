import type { ModelState, QueryKindValue } from "../api/types";

const QUERY_KIND_LABELS: Record<QueryKindValue, string> = {
  text: "Phrases",
  visual: "Example images",
  exemplar: "Exemplar boxes",
  mark: "Clicks and boxes",
};

const QUERY_KIND_HINTS: Record<QueryKindValue, string> = {
  text: "Classes are found from their phrases",
  visual: "Classes are found from example images with boxes around the objects",
  exemplar: "Boxes drawn on a picture show (+) or exclude (−) a class there",
  mark: "Clicks and boxes drawn on a picture mark each object",
};

export interface PromptInput {
  label: string;
  hint: string;
}

export function promptInputsOf(model: ModelState): PromptInput[] {
  const inputs: PromptInput[] =
    model.prompt_mode === "automatic"
      ? [
          {
            label: "Everything",
            hint: "Every region of the picture is segmented; no classes are needed",
          },
        ]
      : model.query_kinds.map((kind) => ({
          label: QUERY_KIND_LABELS[kind],
          hint: QUERY_KIND_HINTS[kind],
        }));
  return model.is_sequential
    ? [
        ...inputs,
        {
          label: "Video tracking",
          hint: "Objects are followed from frame to frame through a video",
        },
      ]
    : inputs;
}
