import { wordsOf } from "../lib/textTemplate";

interface TemplateTextProps {
  template: string;
}

/**
 * A template read as a sentence, with a fixed mark where the prompt goes.
 */
export function TemplateText({ template }: TemplateTextProps) {
  const { before, after } = wordsOf(template);
  return (
    <span className="template-text">
      {before}
      <span className="template-slot">prompt</span>
      {after}
    </span>
  );
}
