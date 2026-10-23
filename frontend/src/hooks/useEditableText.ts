import { useState } from "react";

export interface EditableText {
  text: string;
  setText: (text: string) => void;
  reset: () => void;
}

/**
 * Holds the text typed into a field, starting over from the committed text whenever the committed text changes.
 */
export function useEditableText(committed: string): EditableText {
  const [edited, setEdited] = useState({ text: committed, committed });
  if (edited.committed !== committed) setEdited({ text: committed, committed });
  const text = edited.committed === committed ? edited.text : committed;
  return {
    text,
    setText: (next) => setEdited({ text: next, committed }),
    reset: () => setEdited({ text: committed, committed }),
  };
}
