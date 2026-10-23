import { useRef } from "react";
import { useEditableText } from "../../hooks/useEditableText";

interface InlineInputProps {
  initialValue: string;
  placeholder: string;
  onCommit: (value: string) => Promise<boolean>;
  onCancel: () => void;
}

export function InlineInput({ initialValue, placeholder, onCommit, onCancel }: InlineInputProps) {
  const { text, setText } = useEditableText(initialValue);
  const isCommitting = useRef(false);
  const commit = async () => {
    if (isCommitting.current) return;
    if (text.trim() === "" || text === initialValue) {
      onCancel();
      return;
    }
    isCommitting.current = true;
    await onCommit(text);
    isCommitting.current = false;
  };
  return (
    <input
      type="text"
      autoFocus
      value={text}
      placeholder={placeholder}
      onChange={(event) => setText(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") void commit();
        if (event.key === "Escape") onCancel();
      }}
      onBlur={() => void commit()}
    />
  );
}
