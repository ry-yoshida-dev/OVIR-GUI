import { useEffect, useRef, useState } from "react";
import type { Profile } from "../api/types";
import { useDialogs } from "./DialogHost";

interface ProfileTableProps {
  profiles: Profile[];
  shownKey: string | null;
  comparedKey: string | null;
  onSelect: (key: string) => void;
  onRemove: (keys: string[]) => void;
}

export function ProfileTable({ profiles, shownKey, comparedKey, onSelect, onRemove }: ProfileTableProps) {
  const dialogs = useDialogs();
  const [checkedKeys, setCheckedKeys] = useState<ReadonlySet<string>>(new Set());
  const headerCheckbox = useRef<HTMLInputElement>(null);
  const checked = profiles.filter((profile) => checkedKeys.has(profile.key));
  const isAllChecked = profiles.length > 0 && checked.length === profiles.length;
  const isSomeChecked = checked.length > 0 && !isAllChecked;
  const optionNames = [...new Set(profiles.flatMap((profile) => profile.options.map((option) => option.name)))];

  useEffect(() => {
    if (headerCheckbox.current !== null) headerCheckbox.current.indeterminate = isSomeChecked;
  }, [isSomeChecked]);

  const setChecked = (key: string, isChecked: boolean) =>
    setCheckedKeys((current) => {
      const next = new Set(current);
      if (isChecked) next.add(key);
      else next.delete(key);
      return next;
    });

  const remove = async () => {
    if (checked.length === 0) return;
    const findingCount = checked.reduce((total, profile) => total + profile.finding_count, 0);
    const [only] = checked;
    const isConfirmed = await dialogs.confirm({
      title: "Remove Model Results",
      message:
        checked.length === 1 && only !== undefined
          ? `Forget the ${findingCount} findings of ${only.backend}/${only.model_name} (${only.options_text}) on ${only.frame_count} pictures?`
          : `Forget the ${findingCount} findings of ${checked.length} models?`,
      confirmLabel: "Remove",
      isDanger: true,
    });
    if (!isConfirmed) return;
    onRemove(checked.map((profile) => profile.key));
    setCheckedKeys(new Set());
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div className="panel-title">
        <span className="grow">Models</span>
        <button
          className="ghost icon"
          disabled={checked.length === 0}
          onClick={() => void remove()}
          title="Remove the checked models (Delete)"
        >
          🗑
        </button>
      </div>
      <div
        className="table-wrap"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Delete" || event.key === "Backspace") void remove();
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const index = profiles.findIndex((profile) => profile.key === shownKey);
            const next = profiles[Math.max(0, Math.min(profiles.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
            if (next !== undefined && next.key !== shownKey) onSelect(next.key);
          }
        }}
      >
        <table className="grid">
          <thead>
            <tr>
              <th>
                <input
                  ref={headerCheckbox}
                  type="checkbox"
                  checked={isAllChecked}
                  disabled={profiles.length === 0}
                  title="Check every model"
                  onChange={(event) =>
                    setCheckedKeys(new Set(event.target.checked ? profiles.map((profile) => profile.key) : []))
                  }
                />
              </th>
              <th>Backend</th>
              <th>Model</th>
              <th>Device</th>
              <th>Prec.</th>
              {optionNames.map((name) => (
                <th key={name}>{name}</th>
              ))}
              <th>Media</th>
              <th>Pictures</th>
              <th>Outdated</th>
              <th>Findings</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 && (
              <tr className="status">
                <td colSpan={9 + optionNames.length}>No results yet. Open images or videos to fill this table.</td>
              </tr>
            )}
            {profiles.map((profile) => (
              <tr
                key={profile.key}
                className={profile.key === shownKey ? "selected" : ""}
                onClick={() => onSelect(profile.key)}
                title={profile.weights_path}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={checkedKeys.has(profile.key)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setChecked(profile.key, event.target.checked)}
                  />
                </td>
                <td>{profile.backend}</td>
                <td>
                  {profile.model_name}
                  {profile.key === comparedKey && <span className="badge" style={{ marginLeft: 6 }}>compared</span>}
                </td>
                <td>{profile.device}</td>
                <td>{profile.precision}</td>
                {optionNames.map((name) => (
                  <td key={name} className="ellipsis" title={profile.options.find((option) => option.name === name)?.value}>
                    {profile.options.find((option) => option.name === name)?.value ?? ""}
                  </td>
                ))}
                <td className="number">{profile.media_count}</td>
                <td className="number">{profile.frame_count}</td>
                <td className="number" style={{ color: profile.outdated_count > 0 ? "var(--warning)" : undefined }}>
                  {profile.outdated_count}
                </td>
                <td className="number">{profile.finding_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
