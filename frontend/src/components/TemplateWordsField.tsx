import { useRef, useState } from "react";
import { filledWith, templateOf, type TemplateWords, wordsOf } from "../lib/textTemplate";

interface TemplateWordsFieldProps {
  template: string | null;
  examplePrompt: string;
  isDisabled: boolean;
  isFocusedAtStart?: boolean;
  onCommit: (template: string | null) => void;
}

const NO_WORDS: TemplateWords = { before: "", after: "" };
const FOCUSED_EMPTY_CHARACTERS = 2;
const FIELD_PADDING = "8px";
const COLLAPSED_WIDTH = "6px";

function fittedWidth(text: string, placeholder: string | undefined, isFocused: boolean): string {
  const characters =
    text.length > 0 ? text.length : (placeholder?.length ?? (isFocused ? FOCUSED_EMPTY_CHARACTERS : 0));
  return characters === 0 ? COLLAPSED_WIDTH : `calc(${characters + 1}ch + ${FIELD_PADDING})`;
}

/**
 * Edits the words a template puts before and after the fixed prompt; commits when the focus leaves both fields or
 * Enter is pressed, with null when both are empty, and Escape restores the saved words.
 */
export function TemplateWordsField({
  template,
  examplePrompt,
  isDisabled,
  isFocusedAtStart = false,
  onCommit,
}: TemplateWordsFieldProps) {
  const committed = template === null ? NO_WORDS : wordsOf(template);
  const [words, setWords] = useState<TemplateWords>(committed);
  const [isFocused, setIsFocused] = useState(isFocusedAtStart);
  const container = useRef<HTMLDivElement>(null);
  const edited = templateOf(words);
  const placeholders = template === null ? { before: "Before", after: "After" } : { before: undefined, after: undefined };

  const commit = () => {
    if (template === null || edited !== template) onCommit(edited);
  };

  return (
    <div
      ref={container}
      className={`template-words${isFocused ? " focused" : ""}`}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && container.current?.contains(event.relatedTarget)) return;
        setIsFocused(false);
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.target.blur();
        if (event.key === "Escape") {
          if (template === null) onCommit(null);
          else setWords(committed);
        }
      }}
    >
      <div className="template-words-row">
        <input
          className="template-before"
          type="text"
          value={words.before}
          placeholder={placeholders.before}
          style={{ width: fittedWidth(words.before, placeholders.before, isFocused) }}
          disabled={isDisabled}
          spellCheck={false}
          autoFocus={isFocusedAtStart}
          onChange={(event) => setWords({ ...words, before: event.target.value })}
        />
        <span className="template-slot">prompt</span>
        <input
          className="template-after"
          type="text"
          value={words.after}
          placeholder={placeholders.after}
          style={{ width: fittedWidth(words.after, placeholders.after, isFocused) }}
          disabled={isDisabled}
          spellCheck={false}
          onChange={(event) => setWords({ ...words, after: event.target.value })}
        />
      </div>
      {isFocused && edited !== null && (
        <div className="template-example">
          Example: <code>{filledWith(edited, examplePrompt)}</code>
        </div>
      )}
    </div>
  );
}
