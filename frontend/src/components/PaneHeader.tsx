import type { ReactNode } from "react";
import { type MediaNavigation, MediaStepper } from "./MediaStepper";

interface PaneHeaderProps {
  title: string;
  leading?: ReactNode;
  navigation?: MediaNavigation;
  children?: ReactNode;
}

export function PaneHeader({ title, leading, navigation, children }: PaneHeaderProps) {
  const heading = (
    <h2 className="pane-title" title={title}>
      {title}
    </h2>
  );
  return (
    <div className="pane-header">
      {leading}
      {navigation === undefined ? heading : <MediaStepper navigation={navigation}>{heading}</MediaStepper>}
      <span className="grow" />
      {children}
    </div>
  );
}
