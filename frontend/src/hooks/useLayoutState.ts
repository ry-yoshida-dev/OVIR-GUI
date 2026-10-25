import { useStoredState } from "./useStoredState";

export interface Layout {
  sidebarWidth: number;
  rightWidth: number;
  profileHeight: number;
  reviewHeight: number;
  videoResultsHeight: number;
  collapsedSections: string[];
}

export type LayoutDimension = Exclude<keyof Layout, "collapsedSections">;

export type SectionName =
  | "model"
  | "classes"
  | "media"
  | "image-media"
  | "video-media"
  | "models"
  | "results"
  | "review"
  | "image-results"
  | "video-results";

interface DimensionLimits {
  minimum: number;
  maximum: number;
  isGrowingAgainstDrag: boolean;
}

export interface LayoutState {
  layout: Layout;
  isCollapsed: (section: SectionName) => boolean;
  toggleSection: (section: SectionName) => void;
  resize: (dimension: LayoutDimension, delta: number) => void;
}

const DEFAULT_LAYOUT: Layout = {
  sidebarWidth: 330,
  rightWidth: 560,
  profileHeight: 160,
  reviewHeight: 360,
  videoResultsHeight: 300,
  collapsedSections: [],
};

const DIMENSION_LIMITS: Record<LayoutDimension, DimensionLimits> = {
  sidebarWidth: { minimum: 240, maximum: 640, isGrowingAgainstDrag: false },
  rightWidth: { minimum: 340, maximum: 1100, isGrowingAgainstDrag: true },
  profileHeight: { minimum: 90, maximum: 600, isGrowingAgainstDrag: false },
  reviewHeight: { minimum: 90, maximum: 800, isGrowingAgainstDrag: false },
  videoResultsHeight: {
    minimum: 120,
    maximum: 900,
    isGrowingAgainstDrag: true,
  },
};

/**
 * Keeps the pane sizes and the collapsed sections, remembered across sessions.
 */
export function useLayoutState(): LayoutState {
  const [layout, setLayout] = useStoredState<Layout>(
    "ovir-gui.layout",
    DEFAULT_LAYOUT,
  );
  return {
    layout,
    isCollapsed: (section) => layout.collapsedSections.includes(section),
    toggleSection: (section) =>
      setLayout((current) => ({
        ...current,
        collapsedSections: current.collapsedSections.includes(section)
          ? current.collapsedSections.filter((entry) => entry !== section)
          : [...current.collapsedSections, section],
      })),
    resize: (dimension, delta) => {
      const limits = DIMENSION_LIMITS[dimension];
      setLayout((current) => ({
        ...current,
        [dimension]: Math.max(
          limits.minimum,
          Math.min(
            limits.maximum,
            current[dimension] + (limits.isGrowingAgainstDrag ? -delta : delta),
          ),
        ),
      }));
    },
  };
}
