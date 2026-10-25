import type { ReactNode } from "react";

type GlyphClassName =
  | "icon-glyph"
  | "panel-glyph"
  | "chevron-glyph"
  | "save-glyph"
  | "media-kind-glyph"
  | "task-glyph";

interface GlyphProps {
  className?: GlyphClassName;
  viewBox?: string;
  children: ReactNode;
}

export function Glyph({
  className = "icon-glyph",
  viewBox = "0 0 16 16",
  children,
}: GlyphProps) {
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true">
      {children}
    </svg>
  );
}

export function AnnotationsGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 1.75h5.75l3.25 3.25v9.25h-9z" />
        <path d="M9.25 1.75V5h3.25M5.75 8h4.5M5.75 10.5h4.5M5.75 13h2.5" />
      </g>
    </Glyph>
  );
}

export function ChevronGlyph() {
  return (
    <Glyph className="chevron-glyph">
      <path d="M4.5 6.25 8 9.75l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </Glyph>
  );
}

export function ClassFoldersGlyph() {
  return (
    <Glyph>
      <path
        d="M1.75 4.25A1 1 0 0 1 2.75 3.25h3.5l1.5 1.5h5.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}

export function ClassesGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.25 3.25v3.6a1 1 0 0 0 .3.7l6.2 6.2a1 1 0 0 0 1.4 0l3.1-3.1a1 1 0 0 0 0-1.4l-6.2-6.2a1 1 0 0 0-.7-.3h-3.6a.5.5 0 0 0-.5.5Z" />
        <circle cx="5.25" cy="5.75" r="0.9" />
      </g>
    </Glyph>
  );
}

export function CropGlyph() {
  return (
    <Glyph>
      <path
        d="M4.25 1.25v10.5h10.5M1.25 4.25h10.5v10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}

export function ExpandGlyph() {
  return (
    <Glyph>
      <path
        d="M9.75 2.25h4v4M13.75 2.25 9.25 6.75M6.25 13.75h-4v-4M2.25 13.75l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}

export function ExportGlyph() {
  return (
    <Glyph className="panel-glyph" viewBox="0 0 24 24">
      <path
        d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14.5v4A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}

export function FilterGlyph() {
  return (
    <Glyph>
      <path
        d="M2.25 3h11.5L9.25 8.5v4.25l-2.5 1.25V8.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}

export function FindingsGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.25" y="2.25" width="7" height="7" rx="1" />
        <rect x="6.75" y="6.75" width="7" height="7" rx="1" />
      </g>
    </Glyph>
  );
}

export function GearGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.50 3.65L6.67 2.25A1.45 1.45 0 0 1 9.33 2.25L9.50 3.65A4.6 4.6 0 0 1 11.02 4.53L12.31 3.98A1.45 1.45 0 0 1 13.64 6.28L12.52 7.12A4.6 4.6 0 0 1 12.52 8.88L13.64 9.72A1.45 1.45 0 0 1 12.31 12.02L11.02 11.47A4.6 4.6 0 0 1 9.50 12.35L9.33 13.75A1.45 1.45 0 0 1 6.67 13.75L6.50 12.35A4.6 4.6 0 0 1 4.98 11.47L3.69 12.02A1.45 1.45 0 0 1 2.36 9.72L3.48 8.88A4.6 4.6 0 0 1 3.48 7.12L2.36 6.28A1.45 1.45 0 0 1 3.69 3.98L4.98 4.53A4.6 4.6 0 0 1 6.50 3.65Z" />
        <circle cx="8" cy="8" r="1.9" />
      </g>
    </Glyph>
  );
}

export function InfoGlyph() {
  return (
    <Glyph>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.25v3.75" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.85" fill="currentColor" />
    </Glyph>
  );
}

export function MediaGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <circle cx="5.75" cy="6.5" r="1.1" />
        <path d="M2.5 11.5 6 8.25l2.5 2.25 2-1.75 3 2.75" />
      </g>
    </Glyph>
  );
}

export function ModelGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.75 13.5 4.75v6.5L8 14.25 2.5 11.25v-6.5Z" />
        <path d="M2.5 4.75 8 7.75l5.5-3M8 7.75v6.5" />
      </g>
    </Glyph>
  );
}

export function PlusGlyph() {
  return (
    <Glyph>
      <path d="M8 3.25v9.5M3.25 8h9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Glyph>
  );
}

export function ProfilesGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2.25 14 5.25 8 8.25 2 5.25Z" />
        <path d="M2 8.25l6 3 6-3M2 11.25l6 3 6-3" />
      </g>
    </Glyph>
  );
}

export function ResetGlyph() {
  return (
    <Glyph>
      <path
        d="M3.1 8a4.9 4.9 0 1 0 1.45-3.48M3.1 2.9v2.6h2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}

export function SaveGlyph() {
  return (
    <Glyph className="save-glyph" viewBox="0 0 24 24">
      <path
        d="M5 3.5h11.2l3.3 3.3V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7.5 3.5v5h8v-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="12" y="4.8" width="2" height="2.4" fill="currentColor" />
      <rect x="6.5" y="13" width="11" height="7.5" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Glyph>
  );
}

export function SlidersGlyph() {
  return (
    <Glyph>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
        <circle cx="10" cy="4.5" r="1.6" />
        <circle cx="6" cy="11.5" r="1.6" />
      </g>
    </Glyph>
  );
}

export function StatisticsGlyph() {
  return (
    <Glyph className="panel-glyph" viewBox="0 0 24 24">
      <path d="M4 20h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="5.5" y="11" width="3" height="6.5" rx="0.6" fill="currentColor" />
      <rect x="10.5" y="5" width="3" height="12.5" rx="0.6" fill="currentColor" />
      <rect x="15.5" y="8.5" width="3" height="9" rx="0.6" fill="currentColor" />
    </Glyph>
  );
}

export function TrashGlyph() {
  return (
    <Glyph>
      <path
        d="M2.75 4.25h10.5M6.25 4.25V3a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25M4.25 4.25l.6 8.6a1 1 0 0 0 1 .9h4.3a1 1 0 0 0 1-.9l.6-8.6M6.75 7v4M9.25 7v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Glyph>
  );
}
