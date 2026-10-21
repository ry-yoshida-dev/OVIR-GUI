import type { ConnectionState } from "../hooks/useWorkspace";

interface ConnectionIndicatorProps {
  connection: ConnectionState;
}

export function ConnectionIndicator({ connection }: ConnectionIndicatorProps) {
  if (connection === "open") return null;
  return (
    <span
      className="connection-lost"
      role="status"
      title="The connection to the OVIR server was lost. The view will not update until it reconnects."
    >
      Server disconnected — reconnecting…
    </span>
  );
}
