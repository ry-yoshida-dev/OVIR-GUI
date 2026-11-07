export const PLAIN_TEMPLATE = "{}";

export interface TemplateWords {
  before: string;
  after: string;
}

const SLOT = "{}";
const ATTACHED_AFTER = /^[.,!?;:)\]'"’”]/;

function escapeBraces(text: string): string {
  return text.replaceAll("{", "{{").replaceAll("}", "}}");
}

function unescapeBraces(text: string): string {
  return text.replaceAll("{{", "{").replaceAll("}}", "}");
}

function slotIndexOf(template: string): number {
  for (let index = 0; index < template.length - 1; index += 1) {
    const pair = template.slice(index, index + 2);
    if (pair === SLOT) return index;
    if (pair === "{{" || pair === "}}") index += 1;
  }
  return -1;
}

/**
 * Words a template puts before and after the prompt, with literal braces unescaped.
 */
export function wordsOf(template: string): TemplateWords {
  const slot = slotIndexOf(template);
  if (slot < 0) return { before: unescapeBraces(template).trim(), after: "" };
  return {
    before: unescapeBraces(template.slice(0, slot)).trim(),
    after: unescapeBraces(template.slice(slot + SLOT.length)).trim(),
  };
}

/**
 * Template putting the words around the prompt, spaced like a sentence; null when there are no words.
 */
export function templateOf({ before, after }: TemplateWords): string | null {
  const trimmedBefore = before.trim();
  const trimmedAfter = after.trim();
  if (trimmedBefore === "" && trimmedAfter === "") return null;
  const head = trimmedBefore === "" ? "" : `${escapeBraces(trimmedBefore)} `;
  const tail =
    trimmedAfter === "" || ATTACHED_AFTER.test(trimmedAfter)
      ? escapeBraces(trimmedAfter)
      : ` ${escapeBraces(trimmedAfter)}`;
  return head + SLOT + tail;
}

/**
 * Template read as text, "None" for the prompt as written and "{prompt}" where the prompt goes.
 */
export function templateLabelOf(template: string): string {
  return template === PLAIN_TEMPLATE ? "None" : filledWith(template, "{prompt}");
}

/**
 * Sentence a template turns a prompt into.
 */
export function filledWith(template: string, prompt: string): string {
  const slot = slotIndexOf(template);
  if (slot < 0) return prompt;
  return unescapeBraces(template.slice(0, slot)) + prompt + unescapeBraces(template.slice(slot + SLOT.length));
}
