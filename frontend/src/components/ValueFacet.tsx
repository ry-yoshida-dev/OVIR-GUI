import { useState } from "react";
import { percentText, type ValueShare } from "../lib/columnFacets";
import type { ColumnCondition, ColumnDefinition } from "../lib/resultTable";
import { withMembership } from "../lib/sets";

interface ValueFacetProps {
  column: ColumnDefinition;
  shares: ValueShare[];
  condition: ColumnCondition | undefined;
  colorOf: ((value: string) => string) | null;
  onChange: (condition: ColumnCondition | undefined) => void;
}

const SEARCHED_VALUE_COUNT = 8;
const BAR_COLOR = "var(--action-fill)";

/**
 * Checklist of a column's values, each with its share of the findings, whose changes apply at once.
 */
export function ValueFacet({ column, shares, condition, colorOf, onChange }: ValueFacetProps) {
  const [search, setSearch] = useState("");
  const checked = new Set(
    condition?.kind === "values" ? condition.values : shares.map((share) => share.value),
  );
  const shownShares = shares.filter((share) => share.value.toLowerCase().includes(search.toLowerCase()));

  const setChecked = (value: string, isChecked: boolean) => {
    const next = withMembership(checked, value, isChecked);
    const isEveryChecked = shares.every((share) => next.has(share.value));
    onChange(isEveryChecked ? undefined : { kind: "values", values: [...next] });
  };

  return (
    <>
      <div className="filter-panel-detail-head">
        <span className="filter-panel-detail-title">{column.label}</span>
        <span className="grow" />
        <button className="ghost small" disabled={condition === undefined} onClick={() => onChange(undefined)}>
          Select all
        </button>
      </div>
      {shares.length > SEARCHED_VALUE_COUNT && (
        <input type="search" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
      )}
      <div className="filter-value-list">
        {shownShares.length === 0 && <div className="faint small">No values</div>}
        {shownShares.map((share) => {
          const isChecked = checked.has(share.value);
          const color = colorOf?.(share.value) ?? BAR_COLOR;
          return (
            <label key={share.value} className={`filter-value-row${isChecked ? "" : " off"}`}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(event) => setChecked(share.value, event.target.checked)}
              />
              <span className="filter-value-name" title={share.value}>
                {colorOf !== null && <span className="swatch inline-swatch" style={{ background: color }} />}
                {share.value}
              </span>
              <span className="filter-value-bar">
                <span style={{ width: `${share.share * 100}%`, background: color }} />
              </span>
              <span className="filter-value-share">{percentText(share.share)}</span>
            </label>
          );
        })}
      </div>
    </>
  );
}
