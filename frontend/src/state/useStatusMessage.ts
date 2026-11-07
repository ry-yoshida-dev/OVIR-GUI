import { useCallback, useEffect, useRef, useState } from "react";

interface LocalMessage {
  text: string;
  serial: number;
}

export interface StatusMessage {
  text: string | null;
  report: (text: string) => void;
}

const LOCAL_MESSAGE_MILLISECONDS = 7000;

/**
 * Shows a message raised in the browser for a while, until the server reports a newer status.
 */
export function useStatusMessage(statusSerial: number | null): StatusMessage {
  const [message, setMessage] = useState<LocalMessage | null>(null);
  const [shownStatusSerial, setShownStatusSerial] = useState(statusSerial);
  const messageSerial = useRef(0);
  const timers = useRef(new Set<number>());

  if (shownStatusSerial !== statusSerial) {
    setShownStatusSerial(statusSerial);
    setMessage(null);
  }

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const report = useCallback((text: string) => {
    messageSerial.current += 1;
    const serial = messageSerial.current;
    setMessage({ text, serial });
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setMessage((current) => (current?.serial === serial ? null : current));
    }, LOCAL_MESSAGE_MILLISECONDS);
    timers.current.add(timer);
  }, []);

  return { text: message?.text ?? null, report };
}
