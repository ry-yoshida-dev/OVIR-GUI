import type { ReactNode } from "react";
import type { AggregationStep } from "../api/types";
import {
  DIAGRAM_CLASSES,
  DIAGRAM_PROMPTS,
  DIAGRAM_TEMPLATES,
  type DiagramCell,
  LOGIT_SCALE,
  colorNameOf,
  groupsOf,
  isMergedCell,
  itemAt,
  mergedVectors,
  probabilitiesOf,
  reducedSimilarities,
  sentenceCells,
} from "../lib/aggregationDiagram";

interface AggregationDiagramProps {
  steps: readonly AggregationStep[];
  highlightedStep: number | null;
}

interface CellBox {
  cell: DiagramCell;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CellLayout {
  width: number;
  boxes: CellBox[];
}

interface TextProps {
  x: number;
  y: number;
  className: string;
  size: number;
  weight?: number;
  anchor?: "start" | "middle";
  transform?: string;
  children: ReactNode;
}

const DIAGRAM_WIDTH = 1520;
const DIAGRAM_HEIGHT = 460;
const CELL_HEIGHT = 30;
const CELL_WIDTH = 46;
const COLUMN_STEP = 52;
const MERGED_WIDTH = 52;
const STEP_GAP = 44;
const VECTOR_X = 690;
const SOFTMAX_X = 1220;
const CLASS_SCORE_GAP = 42;
const IMAGE_Y = 367;
const COLUMN_SUBSCRIPTS = ["₁", "₂"];

function Text({ x, y, className, size, weight = 400, anchor = "middle", transform, children }: TextProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={weight}
      className={className}
      transform={transform}
    >
      {children}
    </text>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  isAggregation = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isAggregation?: boolean;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      className={isAggregation ? "stroke-agg" : "stroke-ink"}
      markerEnd={isAggregation ? "url(#aggregation-arrow-agg)" : "url(#aggregation-arrow)"}
    />
  );
}

function StageLabel({ x, lines }: { x: number; lines: string[] }) {
  return lines.map((line, index) => (
    <Text key={line} x={x} y={274 + index * 15} className="fill-ink" size={12} weight={700}>
      {line}
    </Text>
  ));
}

function layoutOf(cells: readonly DiagramCell[], x: number): CellLayout {
  const isColumnMerged = cells.some((cell) => cell.columns.length > 1);
  return {
    width: isColumnMerged ? MERGED_WIDTH : COLUMN_STEP + CELL_WIDTH,
    boxes: cells.map((cell) => {
      const isOneRow = cell.prompts.length === 1;
      return {
        cell,
        left: isColumnMerged ? x : x + itemAt(cell.columns, 0) * COLUMN_STEP,
        top: isOneRow ? itemAt(cell.prompts, 0).top : cell.klass.top + 3,
        width: isColumnMerged ? MERGED_WIDTH : CELL_WIDTH,
        height: isOneRow ? CELL_HEIGHT : cell.klass.height - 6,
      };
    }),
  };
}

function centersOf(layout: CellLayout): number[] {
  return [...new Set(layout.boxes.map((box) => box.top + box.height / 2))];
}

function vectorLabelOf(cell: DiagramCell): string {
  const isOneRow = cell.prompts.length === 1;
  const isOneColumn = cell.columns.length === 1;
  if (isOneRow && isOneColumn)
    return `T${itemAt(cell.prompts, 0).subscript}${itemAt(COLUMN_SUBSCRIPTS, itemAt(cell.columns, 0))}`;
  if (!isOneRow && !isOneColumn) return `T̄ ${cell.klass.name}`;
  if (isOneRow) return `T̄${itemAt(cell.prompts, 0).subscript}`;
  return `T̄⁽${itemAt(cell.columns, 0) + 1}⁾`;
}

function probabilityLabelOf(probability: number): string {
  const text = probability.toFixed(2);
  return text.startsWith("0") ? text.slice(1) : text;
}

function similarityLabelOf(cell: DiagramCell, isDerived: boolean): string {
  return (cell.logit / LOGIT_SCALE).toFixed(isDerived ? 3 : 2);
}

function Cells({
  layout,
  labelOf,
  isVector,
}: {
  layout: CellLayout;
  labelOf: (cell: DiagramCell, index: number) => string;
  isVector: boolean;
}) {
  return layout.boxes.map((box, index) => (
    <g key={`${box.left}-${box.top}`}>
      <rect
        x={box.left}
        y={box.top}
        width={box.width}
        height={box.height}
        rx={5}
        className={`${isMergedCell(box.cell) ? "merged" : "cell"}-${colorNameOf(box.cell)}`}
      />
      <Text
        x={box.left + box.width / 2}
        y={box.top + box.height / 2 + 4.5}
        className={isVector ? `ink-${colorNameOf(box.cell)} mono` : "fill-ink mono"}
        size={isVector ? 12 : 11.5}
        weight={isVector ? 700 : 400}
      >
        {labelOf(box.cell, index)}
      </Text>
    </g>
  ));
}

function ColumnHeaders({ layout, x }: { layout: CellLayout; x: number }) {
  if (layout.width === MERGED_WIDTH) return null;
  return (
    <>
      <Text x={x + 49} y={67} className="fill-muted" size={10}>
        Template
      </Text>
      {DIAGRAM_TEMPLATES.map((_, column) => (
        <Text key={column} x={x + column * COLUMN_STEP + 23} y={80} className="fill-muted" size={10.5} weight={700}>
          ({column + 1})
        </Text>
      ))}
    </>
  );
}

function GroupOutlines({ groups, layout }: { groups: DiagramCell[][]; layout: CellLayout }) {
  return groups.map((group) => {
    const boxes = layout.boxes.filter((box) => group.includes(box.cell));
    const left = Math.min(...boxes.map((box) => box.left)) - 4;
    const right = Math.max(...boxes.map((box) => box.left + box.width)) + 4;
    const top = Math.min(...boxes.map((box) => box.top)) - 3;
    const bottom = Math.max(...boxes.map((box) => box.top + box.height)) + 3;
    return (
      <rect key={`${left}-${top}`} x={left} y={top} width={right - left} height={bottom - top} rx={8} className="group-agg" />
    );
  });
}

interface StageResult {
  parts: ReactNode[];
  cells: DiagramCell[];
  layout: CellLayout;
  x: number;
}

/**
 * Draws the steps of one timing: the outlines of the groups every step merges, arrows to the cells it leaves, and
 * those cells.
 */
function drawSteps(
  indexedSteps: { step: AggregationStep; index: number }[],
  start: StageResult,
  highlightedStep: number | null,
  merge: (cells: DiagramCell[], step: AggregationStep) => DiagramCell[],
  labelOf: (cell: DiagramCell) => string,
  isVector: boolean,
): StageResult {
  let { cells, layout, x } = start;
  const parts: ReactNode[] = [];
  for (const { step, index: stepIndex } of indexedSteps) {
    const merged = merge(cells, step);
    const nextX = x + layout.width + STEP_GAP;
    const nextLayout = layoutOf(merged, nextX);
    parts.push(
      <g key={`step-${stepIndex}`} className={highlightedStep === stepIndex ? "diagram-step hl" : "diagram-step"}>
        <GroupOutlines groups={groupsOf(cells, step.unit)} layout={layout} />
        {centersOf(nextLayout).map((center) => (
          <Arrow key={center} x1={x + layout.width + 6} y1={center} x2={nextX - 4} y2={center} isAggregation />
        ))}
      </g>,
      <Cells key={`cells-${stepIndex}`} layout={nextLayout} labelOf={labelOf} isVector={isVector} />,
    );
    cells = merged;
    x = nextX;
    layout = nextLayout;
  }
  return { parts, cells, layout, x };
}

function Inputs() {
  return (
    <>
      <rect x={20} y={56} width={180} height={196} rx={8} className="box-object" />
      <line x1={20} y1={77} x2={200} y2={77} className="stroke-faint" />
      <Text x={110} y={70.5} className="fill-muted" size={11} weight={700}>
        Prompts
      </Text>
      {DIAGRAM_CLASSES.map((klass) => (
        <g key={klass.name}>
          <Text x={57} y={klass.center + 5} className={`ink-${klass.name}`} size={14} weight={700}>
            {klass.name}
          </Text>
          <path
            d={`M100,${klass.top + 3} h-6 V${klass.top + klass.height - 3} h6`}
            className={`bracket-${klass.name}`}
            fill="none"
          />
        </g>
      ))}
      <line x1={30} y1={185} x2={190} y2={185} className="stroke-faint" strokeDasharray="3 3" />
      {DIAGRAM_PROMPTS.map((prompt) => (
        <g key={prompt.text}>
          <rect x={106} y={prompt.top} width={84} height={30} rx={6} className={`cell-${prompt.text}`} />
          <Text x={148} y={prompt.top + 19.5} className={`ink-${prompt.text} mono`} size={12.5} weight={700}>
            {prompt.text}
          </Text>
        </g>
      ))}
      <Text x={218} y={165} className="fill-ink" size={24} weight={300}>
        ×
      </Text>
      <rect x={236} y={56} width={196} height={196} rx={8} className="box-object" />
      <line x1={236} y1={77} x2={432} y2={77} className="stroke-faint" />
      <Text x={334} y={70.5} className="fill-muted" size={11} weight={700}>
        Templates
      </Text>
      {DIAGRAM_TEMPLATES.map((template, index) => {
        const y = 100 + index * 40;
        return (
          <g key={template}>
            <Text x={252} y={y + 19.5} className="fill-muted" size={11} weight={700}>
              ({index + 1})
            </Text>
            <rect x={266} y={y} width={156} height={30} rx={6} className="box-template" />
            <Text x={344} y={y + 19.5} className="fill-ink mono" size={12}>
              {template}
            </Text>
          </g>
        );
      })}
      {[
        { center: 120, count: "dog: 2 × 2 = 4 sentences", example: "a photo of a dog …" },
        { center: 230, count: "cat: 1 × 2 = 2 sentences", example: "a photo of a cat …" },
      ].map(({ center, count, example }) => (
        <g key={center}>
          <Arrow x1={434} y1={center} x2={586} y2={center} />
          <Text x={510} y={center - 9} className="fill-ink" size={11.5} weight={600}>
            {count}
          </Text>
          <Text x={510} y={center + 18} className="fill-muted mono" size={10}>
            {example}
          </Text>
        </g>
      ))}
      <polygon points="590,72 660,96 660,234 590,258" className="box-encoder" />
      <Text x={625} y={169} className="fill-ink" size={13} weight={700} transform="rotate(-90 625 165)">
        Text Encoder
      </Text>
      {DIAGRAM_PROMPTS.map((prompt) => (
        <Arrow key={prompt.text} x1={662} y1={prompt.top + 15} x2={686} y2={prompt.top + 15} />
      ))}
    </>
  );
}

function ImageBranch({ operatorX }: { operatorX: number }) {
  return (
    <>
      <rect x={20} y={312} width={180} height={110} rx={8} className="box-image" />
      <circle cx={165} cy={340} r={11} className="fill-faint" />
      <polygon points="28,414 84,350 118,384 145,362 192,414" className="fill-faint" />
      <Text x={110} y={446} className="fill-ink" size={13} weight={700}>
        Input image
      </Text>
      <Arrow x1={202} y1={IMAGE_Y} x2={588} y2={IMAGE_Y} />
      <polygon points="590,302 660,320 660,414 590,432" className="box-encoder" />
      <Text x={625} y={371} className="fill-ink" size={11.5} weight={700} transform={`rotate(-90 625 ${IMAGE_Y})`}>
        Image Encoder
      </Text>
      <Arrow x1={662} y1={IMAGE_Y} x2={operatorX - 28} y2={IMAGE_Y} />
      <rect x={operatorX - 24} y={352} width={48} height={30} rx={5} className="box-value" />
      <Text x={operatorX} y={372} className="fill-ink mono" size={13} weight={700}>
        I
      </Text>
      <Text x={operatorX} y={402} className="fill-ink" size={12} weight={700}>
        Image vector
      </Text>
    </>
  );
}

function TimingBadge({ x, mark, title, isActive }: { x: number; mark: string; title: string; isActive: boolean }) {
  return (
    <>
      <circle cx={x + 4} cy={38} r={11} className={isActive ? "badge-active" : "badge-idle"} />
      <Text x={x + 4} y={42.5} className={isActive ? "fill-surface" : "fill-muted"} size={12} weight={700}>
        {mark}
      </Text>
      <Text x={x + 21} y={42.5} className={isActive ? "fill-ink" : "fill-muted"} size={12} weight={700} anchor="start">
        {title}
      </Text>
    </>
  );
}

/**
 * Overview of how the prompts and templates of the example classes become class scores: the sentences become text
 * vectors, steps on text vectors merge them into representative vectors, each is compared with the image vector, steps
 * on similarities reduce the similarities, a softmax runs over the candidates left and each class takes its best one.
 * A highlighted step stands out while the others fade.
 */
export function AggregationDiagram({ steps, highlightedStep }: AggregationDiagramProps) {
  const indexedSteps = steps.map((step, index) => ({ step, index }));
  const embeddingSteps = indexedSteps.filter(({ step }) => step.timing === "embedding");
  const similaritySteps = indexedSteps.filter(({ step }) => step.timing === "similarity");
  const sentences = sentenceCells();
  const sentenceLayout = layoutOf(sentences, VECTOR_X);
  const vectors = drawSteps(
    embeddingSteps,
    { parts: [], cells: sentences, layout: sentenceLayout, x: VECTOR_X },
    highlightedStep,
    (cells, step) => mergedVectors(cells, step.unit),
    vectorLabelOf,
    true,
  );

  const operatorX = vectors.x + vectors.layout.width + 24;
  const vectorCenters = centersOf(vectors.layout);
  const similarityX = operatorX + 28;
  const similarityLayout = layoutOf(vectors.cells, similarityX);
  const similarities = drawSteps(
    similaritySteps,
    { parts: [], cells: vectors.cells, layout: similarityLayout, x: similarityX },
    highlightedStep,
    (cells, step) => reducedSimilarities(cells, step.unit, step.method),
    (cell) => similarityLabelOf(cell, true),
    false,
  );

  const candidates = similarities.cells;
  const probabilities = probabilitiesOf(candidates);
  const probabilityX = SOFTMAX_X + 60;
  const probabilityLayout = layoutOf(candidates, probabilityX);
  const classX = probabilityX + probabilityLayout.width + CLASS_SCORE_GAP;
  const hasEmbedding = embeddingSteps.length > 0;
  const hasSimilarity = similaritySteps.length > 0;

  return (
    <svg
      viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
      role="img"
      aria-label="Aggregation of the prompts and templates of each class"
      className={highlightedStep === null ? undefined : "is-highlighting"}
    >
      <defs>
        <marker
          id="aggregation-arrow"
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-ink" />
        </marker>
        <marker
          id="aggregation-arrow-agg"
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-agg" />
        </marker>
      </defs>
      <Text x={20} y={42.5} className="fill-muted" size={12} weight={700} anchor="start">
        Example
      </Text>
      <Inputs />

      <ColumnHeaders layout={sentenceLayout} x={VECTOR_X} />
      <Cells layout={sentenceLayout} labelOf={vectorLabelOf} isVector />
      <StageLabel x={VECTOR_X + sentenceLayout.width / 2} lines={["Text", "vectors"]} />
      {vectors.parts}
      {hasEmbedding && (
        <>
          <rect
            x={VECTOR_X - 8}
            y={56}
            width={vectors.x + vectors.layout.width + 16 - VECTOR_X}
            height={198}
            rx={10}
            className="zone"
          />
          <StageLabel x={vectors.x + vectors.layout.width / 2} lines={["Representative", "vectors"]} />
        </>
      )}

      <line x1={operatorX} y1={350} x2={operatorX} y2={Math.min(...vectorCenters)} className="stroke-ink" />
      {vectorCenters.map((center) => (
        <g key={center}>
          <Arrow x1={vectors.x + vectors.layout.width + 2} y1={center} x2={operatorX - 11} y2={center} />
          <circle cx={operatorX} cy={center} r={9} className="op-node" />
          <circle cx={operatorX} cy={center} r={2.6} className="fill-ink" />
          <Arrow x1={operatorX + 11} y1={center} x2={operatorX + 24} y2={center} />
        </g>
      ))}

      <ColumnHeaders layout={similarityLayout} x={similarityX} />
      <Cells
        layout={similarityLayout}
        labelOf={(cell) => similarityLabelOf(cell, cell.similarities.length > 1)}
        isVector={false}
      />
      <StageLabel x={similarityX + similarityLayout.width / 2} lines={["Similarities"]} />
      {similarities.parts}
      {hasSimilarity && (
        <>
          <rect
            x={similarityX - 8}
            y={56}
            width={similarities.x + similarities.layout.width + 16 - similarityX}
            height={198}
            rx={10}
            className="zone"
          />
          <StageLabel
            x={similarities.x + similarities.layout.width / 2}
            lines={["Representative", "similarities"]}
          />
        </>
      )}

      {centersOf(similarities.layout).map((center) => (
        <Arrow key={center} x1={similarities.x + similarities.layout.width + 2} y1={center} x2={SOFTMAX_X - 2} y2={center} />
      ))}
      <rect x={SOFTMAX_X} y={72} width={40} height={186} rx={8} className="box-encoder" />
      <Text
        x={SOFTMAX_X + 20}
        y={169}
        className="fill-ink"
        size={13}
        weight={700}
        transform={`rotate(-90 ${SOFTMAX_X + 20} 165)`}
      >
        Softmax
      </Text>
      {centersOf(probabilityLayout).map((center) => (
        <Arrow key={center} x1={SOFTMAX_X + 42} y1={center} x2={probabilityX - 4} y2={center} />
      ))}
      <Cells
        layout={probabilityLayout}
        labelOf={(_, index) => probabilityLabelOf(itemAt(probabilities, index))}
        isVector={false}
      />
      <StageLabel x={probabilityX + probabilityLayout.width / 2} lines={["Probabilities"]} />

      <Text x={classX + 40} y={77} className="fill-muted" size={11} weight={700}>
        Class Score
      </Text>
      {DIAGRAM_CLASSES.map((klass) => {
        const indices = probabilityLayout.boxes.flatMap((box, index) => (box.cell.klass === klass ? [index] : []));
        const bestIndex = indices.reduce((left, right) =>
          itemAt(probabilities, right) > itemAt(probabilities, left) ? right : left,
        );
        const best = itemAt(probabilityLayout.boxes, bestIndex);
        const fromX = probabilityX + probabilityLayout.width + 6;
        const fromY = best.top + best.height / 2;
        const score = probabilityLabelOf(itemAt(probabilities, bestIndex));
        const isTall = klass.height > 40;
        return (
          <g key={klass.name}>
            {indices.length > 1 && (
              <rect
                x={best.left - 3}
                y={best.top - 3}
                width={best.width + 6}
                height={best.height + 6}
                rx={7}
                className="pick"
              />
            )}
            {best.left + best.width < probabilityX + probabilityLayout.width && (
              <line
                x1={best.left + best.width + 3}
                y1={fromY}
                x2={fromX}
                y2={fromY}
                className="stroke-muted"
                strokeDasharray="2 3"
              />
            )}
            <path
              d={`M${fromX},${fromY} C${classX - 30},${fromY} ${classX - 30},${klass.center} ${classX - 4},${klass.center}`}
              className="stroke-ink"
              fill="none"
              markerEnd="url(#aggregation-arrow)"
            />
            <rect x={classX} y={klass.top} width={80} height={klass.height} rx={8} className={`class-${klass.name}`} />
            {isTall ? (
              <>
                <Text x={classX + 40} y={klass.center - 4} className={`ink-${klass.name}`} size={14} weight={700}>
                  {klass.name}
                </Text>
                <Text x={classX + 40} y={klass.center + 18} className="fill-ink mono" size={12.5}>
                  {score}
                </Text>
              </>
            ) : (
              <>
                <Text x={classX + 22} y={klass.center + 5} className={`ink-${klass.name}`} size={14} weight={700}>
                  {klass.name}
                </Text>
                <Text x={classX + 58} y={klass.center + 5} className="fill-ink mono" size={12}>
                  {score}
                </Text>
              </>
            )}
          </g>
        );
      })}

      <TimingBadge x={VECTOR_X} mark="①" title="Text vectors" isActive={hasEmbedding} />
      <TimingBadge x={Math.max(similarityX, 810)} mark="②" title="Similarities" isActive={hasSimilarity} />
      <ImageBranch operatorX={operatorX} />
    </svg>
  );
}
