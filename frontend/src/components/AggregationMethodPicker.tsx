import { type KeyboardEvent, Suspense, lazy, useEffect, useState } from "react";
import type { AggregationMethodValue, ScoreActivationValue } from "../api/types";
import { useDismiss } from "../hooks/useDismiss";
import { useViewportPosition } from "../hooks/useViewportPosition";

interface AggregationMethodPickerProps {
  label: string;
  value: AggregationMethodValue | null;
  methods: { value: AggregationMethodValue; title: string }[];
  activation: ScoreActivationValue;
  isDisabled: boolean;
  disabledTitle: string;
  onChoose: (method: AggregationMethodValue) => void;
  onPreview: (method: AggregationMethodValue | null) => void;
}

const TeX = lazy(() => import("./TeX").then((module) => ({ default: module.TeX })));
const MENU_MARGINS = { near: 4, far: 4 };
const NO_METHOD = "—";
const FORMULAS: Record<AggregationMethodValue, string> = {
  mean: String.raw`\frac{1}{n}\sum_{i=1}^{n} s_i`,
  max: String.raw`\max_{i} s_i`,
  median: String.raw`\operatorname{median}_{i} s_i`,
  min: String.raw`\min_{i} s_i`,
  logsumexp: String.raw`\log \sum_{i=1}^{n} e^{s_i}`,
};
const LOGSUMEXP_DESCRIPTIONS: Record<ScoreActivationValue, string> = {
  softmax: "Soft maximum: the same as adding up the probabilities of the members.",
  sigmoid: "Soft maximum: every strong member raises it a little more.",
};
const DESCRIPTIONS: Record<Exclude<AggregationMethodValue, "logsumexp">, string> = {
  mean: "Average of every member: each member counts equally.",
  max: "The most similar member: one good match is enough.",
  median: "The middle member: a few outliers are ignored.",
  min: "The least similar member: every member has to match.",
};

function describe(method: AggregationMethodValue, activation: ScoreActivationValue): string {
  return method === "logsumexp" ? LOGSUMEXP_DESCRIPTIONS[activation] : DESCRIPTIONS[method];
}

function MethodMenu({
  anchor,
  value,
  methods,
  activation,
  onChoose,
  onPreview,
  onClose,
}: {
  anchor: HTMLElement;
  value: AggregationMethodValue | null;
  methods: { value: AggregationMethodValue; title: string }[];
  activation: ScoreActivationValue;
  onChoose: (method: AggregationMethodValue) => void;
  onPreview: (method: AggregationMethodValue | null) => void;
  onClose: () => void;
}) {
  const bounds = anchor.getBoundingClientRect();
  const { element, position } = useViewportPosition<HTMLDivElement>(bounds.left, bounds.bottom + 2, MENU_MARGINS);
  const [activeIndex, setActiveIndex] = useState(() => methods.findIndex((method) => method.value === value));
  useDismiss([element, { current: anchor }], onClose);
  useEffect(() => element.current?.focus(), [element]);

  const activate = (index: number) => {
    setActiveIndex(index);
    onPreview(methods[index]?.value ?? null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const count = methods.length;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        activate((activeIndex + 1 + count) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        activate((activeIndex - 1 + count) % count);
        break;
      case "Enter": {
        event.preventDefault();
        const method = methods[activeIndex];
        if (method !== undefined) onChoose(method.value);
        break;
      }
    }
  };

  return (
    <div
      ref={element}
      className="menu aggregation-method-menu"
      role="listbox"
      tabIndex={-1}
      style={position}
      onKeyDown={onKeyDown}
      onMouseLeave={() => onPreview(null)}
    >
      <div className="aggregation-method-menu-heading">
        Combine the similarities <TeX expression={String.raw`s_1, \dots, s_n`} /> of a group
      </div>
      {methods.map((method, index) => (
        <div
          key={method.value}
          role="option"
          aria-selected={method.value === value}
          className={`menu-item aggregation-method-option${index === activeIndex ? " active" : ""}`}
          onMouseEnter={() => activate(index)}
          onClick={() => onChoose(method.value)}
        >
          <span className="aggregation-method-check">{method.value === value ? "✓" : ""}</span>
          <span className="aggregation-method-text">
            <span className="aggregation-method-title">
              {method.title}
              <span className="aggregation-method-formula">
                <TeX expression={FORMULAS[method.value]} />
              </span>
            </span>
            <span className="aggregation-method-description">{describe(method.value, activation)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Field choosing how the similarities of every group of a step become one, opening a menu showing the formula of each
 * method; pointing at a method previews it.
 */
export function AggregationMethodPicker({
  label,
  value,
  methods,
  activation,
  isDisabled,
  disabledTitle,
  onChoose,
  onPreview,
}: AggregationMethodPickerProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const title = methods.find((method) => method.value === value)?.title ?? NO_METHOD;
  const close = () => {
    setAnchor(null);
    onPreview(null);
  };

  return (
    <>
      <button
        type="button"
        className={`aggregation-method${anchor === null ? "" : " open"}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={anchor !== null}
        disabled={isDisabled}
        title={isDisabled ? disabledTitle : undefined}
        onClick={(event) => (anchor === null ? setAnchor(event.currentTarget) : close())}
      >
        <span>{title}</span>
        <span className="aggregation-method-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {anchor !== null && (
        <Suspense fallback={null}>
          <MethodMenu
            anchor={anchor}
            value={value}
            methods={methods}
            activation={activation}
            onChoose={(method) => {
              close();
              if (method !== value) onChoose(method);
            }}
            onPreview={onPreview}
            onClose={close}
          />
        </Suspense>
      )}
    </>
  );
}
