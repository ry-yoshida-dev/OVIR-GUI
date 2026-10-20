import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { EmbedBridge, type EmbedHandlers, type EmbedNotice } from "../lib/embedBridge";

export function useEmbedBridge(handlers: EmbedHandlers) {
  const latestHandlers = useRef(handlers);
  latestHandlers.current = handlers;
  const bridge = useRef<EmbedBridge | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    if (window.parent === window) return;
    let isDisposed = false;
    const delegate: EmbedHandlers = {
      open: (paths, shownPath) => latestHandlers.current.open(paths, shownPath),
      show: (path, frame) => latestHandlers.current.show(path, frame),
      close: (paths) => latestHandlers.current.close(paths),
      results: (paths) => latestHandlers.current.results(paths),
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
