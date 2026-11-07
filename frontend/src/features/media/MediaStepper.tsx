import type { ReactNode } from "react";

export interface MediaNavigation {
  isFirst: boolean;
  isLast: boolean;
  onNavigate: (step: number) => void;
}

interface MediaStepperProps {
  navigation: MediaNavigation;
  children: ReactNode;
}

export function MediaStepper({ navigation, children }: MediaStepperProps) {
  return (
    <div className="media-stepper">
      <button
        className="ghost icon"
        disabled={navigation.isFirst}
        title="Previous image or video (PageUp)"
        aria-label="Previous image or video"
        onClick={() => navigation.onNavigate(-1)}
      >
        ‹
      </button>
      {children}
      <button
        className="ghost icon"
        disabled={navigation.isLast}
        title="Next image or video (PageDown)"
        aria-label="Next image or video"
        onClick={() => navigation.onNavigate(1)}
      >
        ›
      </button>
    </div>
  );
}
