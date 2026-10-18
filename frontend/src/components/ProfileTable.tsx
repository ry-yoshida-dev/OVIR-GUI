import type { Profile } from "../api/types";
import { useDialogs } from "./DialogHost";

interface ProfileTableProps {
  profiles: Profile[];
  shownKey: string | null;
  comparedKey: string | null;
  onSelect: (key: string) => void;
  onRemove: (key: string) => void;
}

export function ProfileTable({ profiles, shownKey, comparedKey, onSelect, onRemove }: ProfileTableProps) {
  const dialogs = useDialogs();
  const shown = profiles.find((profile) => profile.key === shownKey);
  const optionNames = [...new Set(profiles.flatMap((profile) => profile.options.map((option) => option.name)))];
  const remove = async () => {
    if (shown === undefined) return;
    const isConfirmed = await dialogs.confirm({
      title: "Remove Model Results",
      message: `Forget the ${shown.finding_count} findings of ${shown.backend}/${shown.model_name} (${shown.options_text}) on ${shown.frame_count} pictures?`,
      confirmLabel: "Remove",
      isDanger: true,
    });
    if (isConfirmed) onRemove(shown.key);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div className="panel-title">
        <span className="grow">Models</span>
        <button className="small" disabled={shown === undefined} onClick={() => void remove()}>
          Remove
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
                <td colSpan={8 + optionNames.length}>No results yet. Open images or videos to fill this table.</td>
              </tr>
            )}
            {profiles.map((profile) => (
              <tr
                key={profile.key}
                className={profile.key === shownKey ? "selected" : ""}
                onClick={() => onSelect(profile.key)}
                title={profile.weights_path}
              >
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
