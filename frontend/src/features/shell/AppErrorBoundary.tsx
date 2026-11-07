import { Component, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Replaces the whole interface with the error and a Reload button when rendering fails, instead of a blank page.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <div className="empty-center connecting">
        <div className="drop-zone">
          <div className="headline">The interface stopped because of an error</div>
          <div className="small">{this.state.error.message}</div>
          <div className="small">Results and settings are kept on the server.</div>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
