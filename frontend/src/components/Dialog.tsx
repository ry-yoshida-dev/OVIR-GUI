import { type ReactNode, useEffect, useEffectEvent, useId } from "react";

const openDialogs: string[] = [];

export function isAnyDialogOpen(): boolean {
  return openDialogs.length > 0;
}

interface DialogProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  height?: number | string;
  isModal?: boolean;
  className?: string;
}

export function Dialog({ title, onClose, children, footer, width, height, isModal = true, className }: DialogProps) {
  const id = useId();
  useEffect(() => {
    openDialogs.push(id);
    return () => {
      openDialogs.splice(openDialogs.indexOf(id), 1);
    };
  }, [id]);
  const close = useEffectEvent(() => onClose());
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openDialogs[openDialogs.length - 1] === id) {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [id]);

  return (
    <div
      className="overlay"
      style={isModal ? undefined : { background: "transparent", pointerEvents: "none" }}
      onMouseDown={(event) => {
        if (isModal && event.target === event.currentTarget) onClose();
      }}
      onDragEnter={(event) => event.stopPropagation()}
      onDragOver={(event) => {
        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = "none";
      }}
      onDrop={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      <div
        className={className === undefined ? "dialog" : `dialog ${className}`}
        style={{ width, height, pointerEvents: "auto" }}
        role="dialog"
      >
        <div className="dialog-header">
          <span className="grow">{title}</span>
          <button className="ghost icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="dialog-body" style={{ flex: height === undefined ? undefined : 1 }}>
          {children}
        </div>
        {footer !== undefined && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}
