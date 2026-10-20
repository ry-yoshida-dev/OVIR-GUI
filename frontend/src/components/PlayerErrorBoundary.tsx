import { Component, type ErrorInfo, type ReactNode } from "react";

interface PlayerErrorBoundaryProps {
  onError: (error: Error) => void;
  children: ReactNode;
}

interface PlayerErrorBoundaryState {
  isFailed: boolean;
}

export class PlayerErrorBoundary extends Component<PlayerErrorBoundaryProps, PlayerErrorBoundaryState> {
  state: PlayerErrorBoundaryState = { isFailed: false };

  static getDerivedStateFromError(): PlayerErrorBoundaryState {
    return { isFailed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    return this.state.isFailed ? null : this.props.children;
  }
}
