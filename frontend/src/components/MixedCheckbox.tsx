import { useEffect, useRef } from "react";

interface MixedCheckboxProps {
  checkedCount: number;
  totalCount: number;
  title: string;
  onChange: (isChecked: boolean) => void;
}

/**
 * A checkbox for a group: checked when every member is, mixed when only some are.
 */
export function MixedCheckbox({ checkedCount, totalCount, title, onChange }: MixedCheckboxProps) {
  const input = useRef<HTMLInputElement>(null);
  const isAllChecked = totalCount > 0 && checkedCount === totalCount;
  const isSomeChecked = checkedCount > 0 && !isAllChecked;

  useEffect(() => {
    if (input.current !== null) input.current.indeterminate = isSomeChecked;
  }, [isSomeChecked]);

  return (
    <input
      ref={input}
      type="checkbox"
      checked={isAllChecked}
      disabled={totalCount === 0}
      title={title}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
