import type { ConnectionState } from "../hooks/useWorkspace";

interface ConnectionIndicatorProps {
  connection: ConnectionState;
}

function textOf(connection: ConnectionState): string {
  switch (connection) {
    case "open":
      return "● connected";
    case "closed":
      return "● disconnected";
    case "connecting":
      return "● connecting";
  }
}

export function ConnectionIndicator({ connection }: ConnectionIndicatorProps) {
  const text = textOf(connection);
  return <span className={`connection ${connection}`} title={text} aria-label={text} role="status" />;
}
