import { type RefObject, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import type { TemplateCombinationValue } from "../api/types";
import { placeInViewport } from "../lib/viewportPlacement";
import { PLAIN_TEMPLATE, wordsOf } from "../lib/textTemplate";
import { TrashGlyph } from "./Glyphs";
import { MixedCheckbox } from "./MixedCheckbox";
import { TemplateWordsField } from "./TemplateWordsField";

export interface TemplateChoice {
  saved: string[];
  inUse: string[];
}

export interface TemplateCombinationChoice {
  value: TemplateCombinationValue;
  options: { value: TemplateCombinationValue; title: string }[];
}

interface TemplatePanelProps {
  anchor: RefObject<HTMLElement | null>;
  choice: TemplateChoice;
  combination: TemplateCombinationChoice;
  examplePrompt: string;
  isDisabled: boolean;
  onChange: (choice: TemplateChoice) => void;
  onCombinationChange: (combination: TemplateCombinationValue) => void;
  onReport: (text: string) => void;
  onClose: () => void;
}

const PANEL_MARGINS = { near: 8, far: 8 };
const PANE_GAP = 10;
const HEADER_OFFSET = 40;

/**
 * Panel beside the setup pane choosing how the sentences of a prompt, one per template in use, become its score, above
 * the table of the saved templates led by None, which uses the prompt as written: the check of a row chooses whether
 * it is used, the words of a template are edited in place, and new templates are added at the end. When nothing is
 * checked, None is used. It stays open while the user works elsewhere and closes with its close button or Escape
 * outside a field, so nothing typed is lost.
 */
export function TemplatePanel({
  anchor,
  choice,
  combination,
  examplePrompt,
  isDisabled,
  onChange,
  onCombinationChange,
  onReport,
  onClose,
}: TemplatePanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !(event.target instanceof HTMLInputElement)) close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useLayoutEffect(() => {
    const field = anchor.current;
    if (field === null || panel.current === null) return;
    const pane = field.closest(".pane") ?? field;
    setPosition(
      placeInViewport(
        {
          left: pane.getBoundingClientRect().right + PANE_GAP,
          top: field.getBoundingClientRect().top - HEADER_OFFSET,
        },
        panel.current.getBoundingClientRect(),
        PANEL_MARGINS,
      ),
    );
  }, [anchor]);

  const inUse = new Set(choice.inUse);
  const isCombinable = choice.inUse.length > 1;
  const needle = search.trim().toLowerCase();
  const shown = choice.saved.filter((template) => {
    if (needle === "") return true;
    const { before, after } = wordsOf(template);
    return `${before} ${after}`.toLowerCase().includes(needle);
  });

  const commit = (saved: string[], used: Set<string>) => {
    const chosen = [PLAIN_TEMPLATE, ...saved].filter((template) => used.has(template));
    onChange({ saved, inUse: chosen.length === 0 ? [PLAIN_TEMPLATE] : chosen });
  };
  const isTaken = (template: string) => {
    if (!choice.saved.includes(template)) return false;
    onReport("That template is already saved.");
    return true;
  };

  const toggle = (template: string, isUsed: boolean) => {
    const used = new Set(inUse);
    if (isUsed) used.add(template);
    else used.delete(template);
    commit(choice.saved, used);
  };
  const toggleAll = (isUsed: boolean) =>
    commit(choice.saved, new Set(isUsed ? [PLAIN_TEMPLATE, ...choice.saved] : []));
  const isOnlyNone = choice.inUse.length === 1 && inUse.has(PLAIN_TEMPLATE);
  const edit = (previous: string, next: string | null) => {
    if (next === null || isTaken(next)) return;
    const used = new Set(inUse);
    if (used.delete(previous)) used.add(next);
    commit(
      choice.saved.map((template) => (template === previous ? next : template)),
      used,
    );
  };
  const remove = (template: string) =>
    commit(
      choice.saved.filter((candidate) => candidate !== template),
      inUse,
    );
  const add = (template: string | null) => {
    setIsAdding(false);
    if (template === null || isTaken(template)) return;
    commit([...choice.saved, template], new Set([...inUse, template]));
  };

  return (
    <div
      ref={panel}
      className="popover template-panel"
      role="dialog"
      aria-label="Templates"
      style={position}
    >
      <div className="template-panel-header">
        <span className="popover-title">Templates</span>
        <span className="grow" />
        <button className="ghost icon" title="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="template-section-heading">Combine</div>
      <div className="template-combine">
        <span
          className="segmented"
          role="radiogroup"
          aria-label="Combine"
          title={isCombinable ? undefined : "Use two or more templates to combine their scores"}
        >
          {combination.options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === combination.value}
              className={option.value === combination.value ? "active" : ""}
              disabled={isDisabled || !isCombinable}
              onClick={() => onCombinationChange(option.value)}
            >
              {option.title}
            </button>
          ))}
        </span>
        <span className="template-note">How the scores of a prompt in each template in use become its score</span>
      </div>
      <div className="template-section-heading">
        Templates
        <span className="template-count">
          {choice.inUse.length} of {choice.saved.length + 1} in use
        </span>
        <span className="grow" />
        <input
          type="search"
          className="template-search"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="template-table-wrap">
        <table className="grid fitted template-table">
          <thead>
            <tr>
              <th className="template-check">
                <MixedCheckbox
                  checkedCount={choice.inUse.length}
                  totalCount={choice.saved.length + 1}
                  title="Use every template, or none"
                  onChange={toggleAll}
                />
              </th>
              <th className="filler">
                Template <span className="template-note">— words before and after each prompt</span>
              </th>
              <th className="template-actions" />
            </tr>
          </thead>
          <tbody>
            <tr className={inUse.has(PLAIN_TEMPLATE) ? "template-none" : "template-none unused"}>
              <td className="template-check">
                <input
                  type="checkbox"
                  checked={inUse.has(PLAIN_TEMPLATE)}
                  disabled={isDisabled || isOnlyNone}
                  title={isOnlyNone ? "Used while no template is chosen" : "Also use the prompt as written"}
                  onChange={(event) => toggle(PLAIN_TEMPLATE, event.target.checked)}
                />
              </td>
              <td colSpan={2}>
                <span className="template-none-name">None</span>
                <span className="template-note">
                  the prompt as written, e.g. <code>{examplePrompt}</code>
                </span>
              </td>
            </tr>
            {shown.map((template) => (
              <tr key={template} className={inUse.has(template) ? undefined : "unused"}>
                <td className="template-check">
                  <input
                    type="checkbox"
                    checked={inUse.has(template)}
                    disabled={isDisabled}
                    title={inUse.has(template) ? "Stop using this template" : "Use this template"}
                    onChange={(event) => toggle(template, event.target.checked)}
                  />
                </td>
                <td>
                  <TemplateWordsField
                    template={template}
                    examplePrompt={examplePrompt}
                    isDisabled={isDisabled}
                    onCommit={(next) => edit(template, next)}
                  />
                </td>
                <td className="template-actions">
                  <button
                    className="ghost icon template-remove"
                    title="Delete this template"
                    disabled={isDisabled}
                    onClick={() => remove(template)}
                  >
                    <TrashGlyph />
                  </button>
                </td>
              </tr>
            ))}
            {isAdding && (
              <tr className="template-adding">
                <td className="template-check">
                  <input type="checkbox" checked disabled title="Used once added" />
                </td>
                <td colSpan={2}>
                  <TemplateWordsField
                    template={null}
                    examplePrompt={examplePrompt}
                    isDisabled={isDisabled}
                    isFocusedAtStart
                    onCommit={add}
                  />
                </td>
              </tr>
            )}
            {shown.length === 0 && !isAdding && choice.saved.length > 0 && (
              <tr>
                <td colSpan={3} className="template-empty">
                  No match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="template-panel-footer">
        {!isAdding && (
          <button
            className="ghost"
            disabled={isDisabled}
            onClick={() => {
              setSearch("");
              setIsAdding(true);
            }}
          >
            + New template
          </button>
        )}
      </div>
    </div>
  );
}
