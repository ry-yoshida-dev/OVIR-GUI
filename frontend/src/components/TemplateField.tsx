import { useEffect, useState } from "react";

interface TemplateFieldProps {
  templates: string[];
  isDisabled: boolean;
  onCommit: (templates: string[]) => void;
}

const PLAIN_TEMPLATE = "{}";

function textOf(templates: string[]): string {
  return templates.filter((template) => template !== PLAIN_TEMPLATE).join("\n");
}

function templatesOf(text: string): string[] {
  const templates = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return templates.length === 0 ? [PLAIN_TEMPLATE] : templates;
}

export function TemplateField({ templates, isDisabled, onCommit }: TemplateFieldProps) {
  const committedText = textOf(templates);
  const [text, setText] = useState(committedText);
  useEffect(() => setText(committedText), [committedText]);
  const commit = () => {
    const next = templatesOf(text);
    if (next.join("\n") !== templates.join("\n")) onCommit(next);
  };
  return (
    <textarea
      className="template-field"
      value={text}
      rows={Math.min(4, Math.max(1, text.split("\n").length))}
      disabled={isDisabled}
      placeholder="None — phrases are used as written"
      spellCheck={false}
      title={"Sentences every phrase is written into, one per line, with {} where the phrase goes; leave empty to use the phrases as written"}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") setText(committedText);
      }}
    />
  );
}
