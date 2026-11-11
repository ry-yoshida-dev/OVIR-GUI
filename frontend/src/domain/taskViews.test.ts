import { describe, expect, it } from "vitest";
import type { TaskValue } from "@/api/types";
import { DEFAULT_DISPLAY_OPTIONS } from "@/domain/displayOptions";
import { BOX_FINDING_COLUMNS, MASK_FINDING_COLUMNS, SCORE_COLUMNS } from "@/domain/resultColumns";
import { DEFAULT_TASK, TASK_ORDER, taskViewOf } from "@/domain/taskViews";

const TASKS: TaskValue[] = ["classification", "detection", "segmentation"];

function toggleKeysOf(task: TaskValue): string[] {
  return taskViewOf(task).displayToggles.map((toggle) => toggle.key);
}

describe("taskViewOf", () => {
  it.each(TASKS)("returns the view of %s", (task) => {
    expect(taskViewOf(task).task).toBe(task);
  });

  it("uses the score columns for classification and finding columns for the others", () => {
    expect(taskViewOf("classification").columns).toBe(SCORE_COLUMNS);
    expect(taskViewOf("detection").columns).toBe(BOX_FINDING_COLUMNS);
    expect(taskViewOf("segmentation").columns).toBe(MASK_FINDING_COLUMNS);
  });

  it("scores only classification and shows embedding tuning only there", () => {
    expect(TASKS.filter((task) => taskViewOf(task).isScoreBased)).toEqual(["classification"]);
    expect(TASKS.filter((task) => taskViewOf(task).isEmbeddingTuningShown)).toEqual(["classification"]);
  });

  it("shows the line width for the drawn tasks and the mask opacity only for segmentation", () => {
    expect(TASKS.filter((task) => taskViewOf(task).isLineWidthShown)).toEqual(["detection", "segmentation"]);
    expect(TASKS.filter((task) => taskViewOf(task).isMaskOpacityShown)).toEqual(["segmentation"]);
  });

  it("offers the gallery for every task", () => {
    expect(TASKS.every((task) => taskViewOf(task).isGalleryAvailable)).toBe(true);
  });

  it("leaves the label toggle out of classification and adds the score panel", () => {
    expect(toggleKeysOf("classification")).toEqual([
      "isConfidenceShown",
      "isRejectedShown",
      "isComparedShown",
      "isScorePanelShown",
    ]);
  });

  it("offers box filling and interpolation for detection", () => {
    expect(toggleKeysOf("detection")).toEqual([
      "isLabelShown",
      "isConfidenceShown",
      "isRejectedShown",
      "isComparedShown",
      "isFilled",
      "isInterpolated",
    ]);
  });

  it("offers masks, mask boxes and interpolation for segmentation", () => {
    expect(toggleKeysOf("segmentation")).toEqual([
      "isLabelShown",
      "isConfidenceShown",
      "isRejectedShown",
      "isComparedShown",
      "isMaskShown",
      "isMaskBoxShown",
      "isInterpolated",
    ]);
  });

  it.each(TASKS)("gives every toggle of %s a label and a boolean display option", (task) => {
    for (const toggle of taskViewOf(task).displayToggles) {
      expect(toggle.label).not.toBe("");
      expect(typeof DEFAULT_DISPLAY_OPTIONS[toggle.key]).toBe("boolean");
    }
  });

  it("names the status of a picture with nothing found", () => {
    expect(taskViewOf("classification").emptyPictureText).toBe("Low confidence");
    expect(taskViewOf("detection").emptyPictureText).toBe("Nothing found");
    expect(taskViewOf("segmentation").emptyPictureText).toBe("Nothing found");
  });
});

describe("TASK_ORDER", () => {
  it("lists every task once, including the default", () => {
    expect([...TASK_ORDER].sort()).toEqual([...TASKS].sort());
    expect(TASK_ORDER).toContain(DEFAULT_TASK);
  });
});
