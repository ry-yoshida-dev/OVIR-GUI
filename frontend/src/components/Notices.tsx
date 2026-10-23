import type { Notice } from "../hooks/useWorkspace";

interface NoticesProps {
  notices: Notice[];
  onDismiss: (id: number) => void;
}

/**
 * Stack of notices pushed by the server, each dismissed on its own.
 */
export function Notices({ notices, onDismiss }: NoticesProps) {
  if (notices.length === 0) return null;
  return (
    <div className="notices">
      {notices.map((notice) => (
        <div key={notice.id} className="notice">
          <div className="body">
            <div className="title">{notice.title}</div>
            {notice.message}
          </div>
          <button className="ghost icon" onClick={() => onDismiss(notice.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
