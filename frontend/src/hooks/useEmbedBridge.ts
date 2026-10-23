import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { api } from "../api/client";
import { EmbedBridge, type EmbedHandlers, type EmbedNotice } from "../lib/embedBridge";

export function useEmbedBridge(handlers: EmbedHandlers) {
  const open = useEffectEvent((paths: string[], shownPath: string | null) => handlers.open(paths, shownPath));
  const show = useEffectEvent((path: string, frame: number | null) => handlers.show(path, frame));
  const close = useEffectEvent((paths: string[]) => handlers.close(paths));
  const results = useEffectEvent((paths: string[] | null) => handlers.results(paths));
  const bridge = useRef<EmbedBridge | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    if (window.parent === window) return;
    let isDisposed = false;
    const delegate: EmbedHandlers = {
      open: (paths, shownPath) => open(paths, shownPath),
      show: (path, frame) => show(path, frame),
      close: (paths) => close(paths),
      results: (paths) => results(paths),
    };
    api
      .embedding()
      .then(({ parent_origins: origins }) => {
        if (isDisposed || origins.length === 0) return;
        const started = new EmbedBridge(window.parent, origins, delegate);
        started.start();
        bridge.current = started;
        setIsEmbedded(true);
      })
      .catch(() => undefined);
    return () => {
      isDisposed = true;
      bridge.current?.stop();
      bridge.current = null;
      setIsEmbedded(false);
    };
  }, []);

  const notify = useCallback((notice: EmbedNotice) => bridge.current?.notify(notice), []);
  return { isEmbedded, notify };
}
