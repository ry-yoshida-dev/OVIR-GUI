import type { MarkEntry } from "@/api/types";
import { ListGlyph, TrashGlyph } from "@/components/Glyphs";
import { PopoverButton } from "@/components/PopoverButton";
import { isSameItem, type PromptItem } from "./promptItem";
import type { PicturePromptEditor } from "./usePicturePromptEditor";

interface PromptListProps {
  readonly editor: PicturePromptEditor;
  readonly isMarkShown: boolean;
  readonly isExemplarShown: boolean;
  readonly colorOf: (className: string) => string;
}

interface Row {
  item: PromptItem;
  name: string;
  className: string;
  detail: string;
}

function detailOf(mark: MarkEntry): string {
  const parts: string[] = [];
  if (mark.positive_points.length > 0) parts.push(`${mark.positive_points.length} +`);
  if (mark.negative_points.length > 0) parts.push(`${mark.negative_points.length} −`);
  if (mark.box !== null) parts.push("box");
  return parts.join(" · ");
}

/**
 * Every prompt drawn on the shown picture, one row each, so drawings lying on top of one another can still be told
 * apart, chosen and removed one at a time; pointing at a row outlines its drawing on the picture.
 */
export function PromptList({ editor, isMarkShown, isExemplarShown, colorOf }: PromptListProps) {
  const { prompt } = editor;
  if (prompt === null) return null;
  const rows: Row[] = [
    ...(isMarkShown
      ? prompt.marks.map(
          (mark): Row => ({
            item: { kind: "object", objectId: mark.object_id },
            name: `Object ${mark.object_id}`,
            className: mark.class_name,
            detail: detailOf(mark),
          }),
        )
      : []),
    ...(isExemplarShown
      ? prompt.exemplars.map(
          (exemplar): Row => ({
            item: { kind: "exemplar", index: exemplar.index },
            name: `Exemplar ${exemplar.index + 1}`,
            className: exemplar.class_name,
            detail: exemplar.is_positive ? "Match" : "Not this",
          }),
        )
      : []),
  ];
  return (
    <PopoverButton
      className="ghost toolbar-button prompt-list-button"
      label="Prompts on this picture"
      title="List the prompts drawn on this picture to choose or remove one, e.g. when they overlap"
      trigger={
        <>
          <ListGlyph />
          <span className="prompt-list-label">Prompts</span>
          <span className="prompt-list-count">{rows.length}</span>
        </>
      }
    >
      <div className="popover-title">Prompts on this picture</div>
      {rows.length === 0 ? (
        <div className="prompt-list-empty">Nothing is drawn on this picture.</div>
      ) : (
        <ul className="prompt-list" onMouseLeave={() => editor.hoverItem(null)}>
          {rows.map((row) => {
            const isSelected = isSameItem(row.item, editor.selected);
            return (
              <li
                key={row.name}
                className={isSelected ? "selected" : ""}
                onMouseEnter={() => editor.hoverItem(row.item)}
              >
                <button
                  className="prompt-list-choose"
                  title={isSelected ? "Chosen on the picture" : "Choose it on the picture"}
                  onClick={() => editor.selectItem(isSelected ? null : row.item)}
                >
                  <span className="swatch" style={{ background: colorOf(row.className) }} />
                  <span className="prompt-list-name">
                    {row.name} · {row.className}
                  </span>
                  <span className="prompt-list-detail">{row.detail}</span>
                </button>
                <button
                  className="prompt-list-remove"
                  title={`Remove ${row.name}`}
                  aria-label={`Remove ${row.name}`}
                  onClick={() => editor.removeItem(row.item)}
                >
                  <TrashGlyph />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PopoverButton>
  );
}
