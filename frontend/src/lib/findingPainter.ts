import type { DrawingSurface, Point, Rect, TextStyle, ViewportTransform } from "@video-player-ui/core";
import type { Box, FrameInstance, FramePayload } from "../api/types";
import { textColorOn, type DisplayOptions } from "./displayOptions";
import { comparedOf, FALLBACK_CLASS_COLOR, labelOf, visibleInstancesOf } from "./frameView";

export interface FrameScene {
  frame: FramePayload;
  listedIndices: Set<number> | null;
  highlightedIndex: number | null;
}

const LABEL_FONT_SIZE = 12;
const LABEL_PADDING = 3;
const HIGHLIGHT_COLOR = "#ffffff";
const REJECTED_OPACITY = 0.55;
const COMPARED_OPACITY = 0.75;
const FILLED_BOX_OPACITY = 0.18;
const HIGHLIGHTED_BOX_OPACITY = 0.22;
const LABEL_FONT_FAMILY = "ui-monospace, Menlo, Consolas, monospace";

export class FindingPainter {
  private readonly width: number;
  private readonly height: number;
  private readonly options: DisplayOptions;
  private readonly classColors: Record<string, string>;

  constructor(width: number, height: number, options: DisplayOptions, classColors: Record<string, string>) {
    this.width = width;
    this.height = height;
    this.options = options;
    this.classColors = classColors;
  }

  draw(surface: DrawingSurface, transform: ViewportTransform, scene: FrameScene): void {
    const compared = comparedOf(scene.frame, this.options);
    if (compared !== null) {
      const prefix = `${compared.model_name}: `;
      for (const finding of compared.findings) this.drawCompared(surface, transform, finding, prefix);
    }
    const visible = visibleInstancesOf(scene.frame, scene.listedIndices, this.options);
    for (const finding of visible) {
      if (finding.index !== scene.highlightedIndex) this.drawInstance(surface, transform, finding, false);
    }
    for (const finding of visible) {
      if (finding.index === scene.highlightedIndex) this.drawInstance(surface, transform, finding, true);
    }
  }

  findingAt(framePoint: Point, scene: FrameScene): number | null {
    const point: Point = { x: framePoint.x * this.width, y: framePoint.y * this.height };
    let hit: FrameInstance | null = null;
    let hitArea = Number.POSITIVE_INFINITY;
    for (const finding of visibleInstancesOf(scene.frame, scene.listedIndices, this.options)) {
      const isMaskHit = this.isMaskDrawn(finding) && finding.polygons.some((polygon) => FindingPainter.isInPolygon(point, polygon));
      const isBoxHit = !this.isMaskDrawn(finding) && FindingPainter.isInBox(point, finding.box);
      if (!isMaskHit && !isBoxHit) continue;
      const area = (finding.box[2] - finding.box[0]) * (finding.box[3] - finding.box[1]);
      if (area < hitArea) {
        hit = finding;
        hitArea = area;
      }
    }
    return hit?.index ?? null;
  }

  private drawInstance(surface: DrawingSurface, transform: ViewportTransform, finding: FrameInstance, isHighlighted: boolean): void {
    const color = this.colorOf(finding.class_name);
    const lineWidth = this.options.lineWidth;
    const isMaskDrawn = this.isMaskDrawn(finding);
    surface.save();
    if (!finding.is_accepted) surface.multiplyOpacity(REJECTED_OPACITY);
    if (isMaskDrawn) {
      const fillOpacity = isHighlighted ? Math.min(0.85, this.options.maskOpacity + 0.2) : this.options.maskOpacity;
      const maskLineWidth = Math.max(1, lineWidth - 1);
      for (const polygon of finding.polygons) {
        const points = this.pointsOf(transform, polygon);
        if (points.length < 3) continue;
        if (isHighlighted) surface.strokePolyline(points, true, { color: HIGHLIGHT_COLOR, width: maskLineWidth + 3 });
        surface.fillPolygon(points, FindingPainter.withAlpha(color, fillOpacity));
        surface.strokePolyline(points, true, { color, width: isHighlighted ? maskLineWidth + 1 : maskLineWidth });
      }
    }
    const rect = this.rectOf(transform, finding.box);
    const isBoxHidden = isMaskDrawn && !this.options.isMaskBoxShown && !isHighlighted;
    const isBoxHighlighted = isHighlighted && !isMaskDrawn;
    if (isBoxHighlighted) surface.strokeRect(rect, { color: HIGHLIGHT_COLOR, width: lineWidth + 5 });
    if (isBoxHighlighted) surface.fillRect(rect, FindingPainter.withAlpha(color, HIGHLIGHTED_BOX_OPACITY));
    else if (this.options.isFilled && !isMaskDrawn) surface.fillRect(rect, FindingPainter.withAlpha(color, FILLED_BOX_OPACITY));
    if (!isBoxHidden) surface.strokeRect(rect, { color, width: isBoxHighlighted ? lineWidth + 2 : lineWidth });
    this.drawLabel(surface, rect, color, labelOf(finding, this.options));
    surface.restore();
  }

  private drawCompared(surface: DrawingSurface, transform: ViewportTransform, finding: FrameInstance, prefix: string): void {
    const color = this.colorOf(finding.class_name);
    const lineWidth = Math.max(1, this.options.lineWidth - 1);
    surface.save();
    surface.multiplyOpacity(COMPARED_OPACITY);
    if (finding.polygons.length > 0 && this.options.isMaskShown) {
      for (const polygon of finding.polygons) {
        const points = this.pointsOf(transform, polygon);
        if (points.length >= 3) surface.strokePolyline(points, true, { color, width: lineWidth });
      }
    }
    const rect = this.rectOf(transform, finding.box);
    surface.strokeRect(rect, { color: HIGHLIGHT_COLOR, width: lineWidth + 2 });
    surface.strokeRect(rect, { color, width: lineWidth });
    this.drawLabel(surface, rect, color, labelOf(finding, this.options, prefix));
    surface.restore();
  }

  private drawLabel(surface: DrawingSurface, rect: Rect, color: string, label: string | undefined): void {
    if (label === undefined || label === "") return;
    const style: TextStyle = { color: textColorOn(color), fontSize: LABEL_FONT_SIZE, fontFamily: LABEL_FONT_FAMILY, fontWeight: 400 };
    const labelHeight = LABEL_FONT_SIZE + LABEL_PADDING * 2;
    const labelWidth = surface.measureTextWidth(label, style) + LABEL_PADDING * 2;
    const top = rect.y - labelHeight >= 0 ? rect.y - labelHeight : rect.y;
    surface.fillRect({ x: rect.x, y: top, width: labelWidth, height: labelHeight }, color);
    surface.fillText(label, { x: rect.x + LABEL_PADDING, y: top + LABEL_PADDING }, style);
  }

  private isMaskDrawn(finding: FrameInstance): boolean {
    return finding.polygons.length > 0 && this.options.isMaskShown;
  }

  private colorOf(className: string): string {
    return this.classColors[className] ?? FALLBACK_CLASS_COLOR;
  }

  private rectOf(transform: ViewportTransform, box: Box): Rect {
    const [left, top, right, bottom] = box;
    return transform.rectToView({
      x: left / this.width,
      y: top / this.height,
      width: Math.max(0, right - left) / this.width,
      height: Math.max(0, bottom - top) / this.height,
    });
  }

  private pointsOf(transform: ViewportTransform, polygon: number[]): Point[] {
    const points: Point[] = [];
    for (let index = 0; index + 1 < polygon.length; index += 2) {
      points.push(transform.toView({ x: (polygon[index] ?? 0) / this.width, y: (polygon[index + 1] ?? 0) / this.height }));
    }
    return points;
  }

  private static isInBox(point: Point, box: Box): boolean {
    return point.x >= box[0] && point.x <= box[2] && point.y >= box[1] && point.y <= box[3];
  }

  private static isInPolygon(point: Point, polygon: number[]): boolean {
    let isInside = false;
    const count = Math.floor(polygon.length / 2);
    for (let current = 0, previous = count - 1; current < count; previous = current, current += 1) {
      const currentX = polygon[current * 2] ?? 0;
      const currentY = polygon[current * 2 + 1] ?? 0;
      const previousX = polygon[previous * 2] ?? 0;
      const previousY = polygon[previous * 2 + 1] ?? 0;
      const isCrossing =
        currentY > point.y !== previousY > point.y &&
        point.x < ((previousX - currentX) * (point.y - currentY)) / (previousY - currentY) + currentX;
      if (isCrossing) isInside = !isInside;
    }
    return isInside;
  }

  private static withAlpha(color: string, alpha: number): string {
    const value = Number.parseInt(color.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
}
