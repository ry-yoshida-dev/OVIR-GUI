import { useEffect, useRef, useState } from "react";
import type { Profile } from "../api/types";
import { clamp } from "../lib/numbers";
import { withMembership } from "../lib/sets";
import { useDialogs } from "./DialogHost";
import { ProfilesGlyph, TrashGlyph } from "./Glyphs";
import { Section } from "./Section";

interface ProfileTableProps {
  profiles: Profile[];
  shownKey: string | null;
  comparedKey: string | null;
  isBusy: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (key: string) => void;
  onRemove: (keys: string[]) => void;
  onUpdateOutdated: () => void;
}

interface ProfileDetail {
  name: string;
  valueOf: (profile: Profile) => string;
}

function detailsOf(profiles: Profile[]): ProfileDetail[] {
  const optionNames = [...new Set(profiles.flatMap((profile) => profile.options.map((option) => option.name)))];
  return [
    { name: "Device", valueOf: (profile: Profile) => profile.device },
    { name: "Precision", valueOf: (profile: Profile) => profile.precision },
    ...optionNames.map((name) => ({
      name,
      valueOf: (profile: Profile) => profile.options.find((option) => option.name === name)?.value ?? "",
    })),
  ];
}

function isVideoOpen(profile: Profile): boolean {
  return profile.expected_frame_count !== profile.file_count;
}

function progressText(profile: Profile): string {
  return isVideoOpen(profile)
    ? `${profile.recognized_frame_count}/${profile.expected_frame_count} frames`
    : `${profile.done_file_count}/${profile.file_count} files`;
}

function progressTooltip(profile: Profile): string {
  return (
    `${profile.done_file_count} of ${profile.file_count} open files fully recognized\n` +
    `${profile.recognized_frame_count} of ${profile.expected_frame_count} pictures recognized`
  );
}

function rowTooltip(profile: Profile): string {
  const options = profile.options.map((option) => `\n${option.name}: ${option.value}`).join("");
  return `${profile.weights_path}\nDevice: ${profile.device}\nPrecision: ${profile.precision}${options}`;
}

export function ProfileTable({
  profiles,
  shownKey,
  comparedKey,
  isBusy,
  isCollapsed,
  onToggleCollapsed,
  onSelect,
  onRemove,
  onUpdateOutdated,
}: ProfileTableProps) {
  const dialogs = useDialogs();
  const [checkedKeys, setCheckedKeys] = useState<ReadonlySet<string>>(new Set());
  const headerCheckbox = useRef<HTMLInputElement>(null);
  const checked = profiles.filter((profile) => checkedKeys.has(profile.key));
  const isAllChecked = profiles.length > 0 && checked.length === profiles.length;
  const isSomeChecked = checked.length > 0 && !isAllChecked;
  const differingDetails = detailsOf(profiles).filter(
    (detail) => new Set(profiles.map((profile) => detail.valueOf(profile))).size > 1,
  );

  useEffect(() => {
    if (headerCheckbox.current !== null) headerCheckbox.current.indeterminate = isSomeChecked;
  }, [isSomeChecked]);

  const setChecked = (key: string, isChecked: boolean) =>
    setCheckedKeys((current) => withMembership(current, key, isChecked));

  const remove = async () => {
    if (checked.length === 0) return;
    const findingCount = checked.reduce((total, profile) => total + profile.finding_count, 0);
    const [only] = checked;
    const isConfirmed = await dialogs.confirm({
      title: "Remove Model Results",
      message:
        checked.length === 1 && only !== undefined
          ? `Forget the ${findingCount} findings of ${only.backend}/${only.model_name} (${only.options_text}) on ${only.recognized_frame_count} pictures?`
          : `Forget the ${findingCount} findings of ${checked.length} models?`,
      confirmLabel: "Remove",
      isDanger: true,
    });
    if (!isConfirmed) return;
    onRemove(checked.map((profile) => profile.key));
    setCheckedKeys(new Set());
  };
  return (
    <Section
      title="Models"
      icon={<ProfilesGlyph />}
      count={profiles.length}
      isCollapsed={isCollapsed}
      onToggle={onToggleCollapsed}
      isStretched
      isFlush
      actions={
        <button
          className="section-action"
          disabled={checked.length === 0}
          onClick={() => void remove()}
          title="Remove the checked models (Delete)"
          aria-label="Remove the checked models"
        >
          <TrashGlyph />
        </button>
      }
    >
      <div
        className="table-wrap"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Delete" || event.key === "Backspace") void remove();
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const index = profiles.findIndex((profile) => profile.key === shownKey);
            const next = profiles[clamp(index + (event.key === "ArrowDown" ? 1 : -1), 0, profiles.length - 1)];
            if (next !== undefined && next.key !== shownKey) onSelect(next.key);
          }
        }}
      >
        <table className="grid fitted">
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
              <th>Preset</th>
              {differingDetails.map((detail) => (
                <th key={detail.name}>{detail.name}</th>
              ))}
              <th title="How much of the open media this model has recognized">Progress</th>
              <th title="Objects found across the recognized pictures">Findings</th>
              <th />
              <th className="filler" />
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 && (
              <tr className="status">
                <td colSpan={7 + differingDetails.length}>No results yet. Open images or videos to fill this table.</td>
              </tr>
            )}
            {profiles.map((profile) => (
              <tr
                key={profile.key}
                className={profile.key === shownKey ? "selected" : ""}
                onClick={() => onSelect(profile.key)}
                title={rowTooltip(profile)}
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
                {differingDetails.map((detail) => (
                  <td key={detail.name} className="ellipsis" title={detail.valueOf(profile)}>
                    {detail.valueOf(profile)}
                  </td>
                ))}
                <td className="number" title={progressTooltip(profile)}>
                  {progressText(profile)}
                </td>
                <td className="number">{profile.finding_count}</td>
                <td>
                  {profile.outdated_count > 0 &&
                    (profile.key === shownKey ? (
                      <button
                        className="ghost small"
                        disabled={isBusy}
                        title={`${profile.outdated_count} pictures were recognized before the classes changed; recognize them again`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onUpdateOutdated();
                        }}
                      >
                        Re-run ({profile.outdated_count})
                      </button>
                    ) : (
                      <span
                        style={{ color: "var(--warning)" }}
                        title={`${profile.outdated_count} pictures were recognized before the classes changed; select this model to re-run them`}
                      >
                        ⚠ {profile.outdated_count}
                      </span>
                    ))}
                </td>
                <td className="filler" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
