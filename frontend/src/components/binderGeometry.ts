export const BINDER_GEOMETRY = {
  tabWidth: 184,
  tabGap: 2,
  band: 40,
  backDrop: 7,
  sheetRadius: 14,
  tabRadius: 11,
  fillet: 10,
} as const;

export function tabXOf(index: number): number {
  return index * (BINDER_GEOMETRY.tabWidth + BINDER_GEOMETRY.tabGap);
}

export function tabsWidthOf(count: number): number {
  return count * BINDER_GEOMETRY.tabWidth + Math.max(0, count - 1) * BINDER_GEOMETRY.tabGap;
}

export function isTabAtSheetEdge(tabX: number): boolean {
  return tabX < BINDER_GEOMETRY.fillet + BINDER_GEOMETRY.sheetRadius;
}

export function tabPath(tabX: number): string {
  const { tabWidth, band, tabRadius: t, fillet: f } = BINDER_GEOMETRY;
  const left = tabX;
  const right = tabX + tabWidth;
  const base = band + 1;
  const parts: string[] = isTabAtSheetEdge(tabX)
    ? [`M0 ${base}`, `L0 ${t}`, `A${t} ${t} 0 0 1 ${t} 0`]
    : [
        `M${left - f} ${base}`,
        `L${left - f} ${band}`,
        `A${f} ${f} 0 0 0 ${left} ${band - f}`,
        `L${left} ${t}`,
        `A${t} ${t} 0 0 1 ${left + t} 0`,
      ];
  parts.push(
    `L${right - t} 0`,
    `A${t} ${t} 0 0 1 ${right} ${t}`,
    `L${right} ${band - f}`,
    `A${f} ${f} 0 0 0 ${right + f} ${band}`,
    `L${right + f} ${base}`,
    "Z",
  );
  return parts.join(" ");
}

export function backPath(x: number): string {
  const { tabWidth, band, tabRadius: t, backDrop } = BINDER_GEOMETRY;
  const top = backDrop;
  const bottom = band + 12;
  return `M${x} ${bottom} L${x} ${top + t} A${t} ${t} 0 0 1 ${x + t} ${top} L${x + tabWidth - t} ${top} A${t} ${t} 0 0 1 ${x + tabWidth} ${top + t} L${x + tabWidth} ${bottom} Z`;
}
