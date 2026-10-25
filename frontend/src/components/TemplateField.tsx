import { useRef, useState } from "react";
import { PLAIN_TEMPLATE } from "../lib/textTemplate";
import { type TemplateChoice, TemplatePanel } from "./TemplatePanel";
import { TemplateText } from "./TemplateText";

interface TemplateFieldProps {
  templates: string[];
  savedTemplates: string[];
  examplePrompt: string;
  isDisabled: boolean;
  onChange: (choice: TemplateChoice) => void;
  onReport: (text: string) => void;
}

/**
 * Picker summing up the templates in use, opening the panel beside the setup pane to choose and edit the saved
 * templates.
 */
export function TemplateField({
  templates,
  savedTemplates,
  examplePrompt,
  isDisabled,
  onChange,
  onReport,
}: TemplateFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const unsaved = templates.filter((template) => template !== PLAIN_TEMPLATE && !savedTemplates.includes(template));
  const saved = [...savedTemplates, ...unsaved];
  const first = templates[0] ?? PLAIN_TEMPLATE;
  return (
    <div ref={field} className="template-field">
      <button
        className={`model-picker${isOpen ? " open" : ""}`}
        disabled={isDisabled}
        title={templates.map((template) => (template === PLAIN_TEMPLATE ? "None" : template)).join("\n")}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <span className="model-picker-name">
          <span className="small muted">{templates.length} in use</span>
          <span className="template-field-first">
            {first === PLAIN_TEMPLATE ? "None" : <TemplateText template={first} />}
            {templates.length > 1 && <span className="muted"> +{templates.length - 1}</span>}
          </span>
        </span>
        <span className="model-picker-chevron" aria-hidden>
          ›
        </span>
      </button>
      {isOpen && (
        <TemplatePanel
          anchor={field}
          choice={{ saved, inUse: templates }}
          examplePrompt={examplePrompt}
          isDisabled={isDisabled}
          onChange={onChange}
          onReport={onReport}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
