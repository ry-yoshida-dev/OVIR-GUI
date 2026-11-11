import { describe, expect, it } from "vitest";
import type { Finding, RankedScore, ResultPicture, ResultsPayload, TaskValue } from "@/api/types";
import {
  buildRows,
  cellValue,
  columnsOf,
  filterOfScope,
  filterRows,
  type FindingRow,
  frameText,
  formatNumber,
  groupFindings,
  isExportedRow,
  isRowInScope,
  KEPT_TEXT,
  listedIndices,
  listedPictures,
  pictureKeyOf,
  REJECTED_TEXT,
  rowKeyOf,
  sortRows,
  spanOf,
  type TableRow,
  valuesOf,
} from "@/domain/resultTable";

function finding(overrides: Partial<Finding> & Pick<Finding, "index">): Finding {
  return {
    class_name: "cat",
    matched_prompt: "tabby cat",
    matched_template: null,
    confidence: 0.5,
    box: [10, 20, 30, 40],
    area: null,
    is_accepted: true,
    is_passing: true,
    ...overrides,
  };
}

function picture(overrides: Partial<ResultPicture> & Pick<ResultPicture, "path">): ResultPicture {
  return {
    name: overrides.path,
    frame: null,
    seconds: null,
    width: 640,
    height: 480,
    outdated: null,
    scores: [],
    findings: [],
    ...overrides,
  };
}

function payload(pictures: ResultPicture[], task: TaskValue = "detection"): ResultsPayload {
  return { profile_key: null, task, pictures };
}

function findingRowsOf(rows: TableRow[]): FindingRow[] {
  return rows.filter((row): row is FindingRow => row.kind === "finding");
}

function onlyRow(rows: TableRow[]): TableRow {
  const [row] = rows;
  if (row === undefined) throw new Error("no row");
  return row;
}

const SCORES: RankedScore[] = [{ class_name: "cat", score: 0.8, is_reaching_minimum: true }];

describe("columnsOf", () => {
  it("leaves out the frame column for images", () => {
    expect(columnsOf("detection", "images").map((column) => column.key)).not.toContain("frame");
  });

  it("keeps the frame column for videos", () => {
    expect(columnsOf("detection", "videos").map((column) => column.key)).toContain("frame");
  });

  it("uses the columns of the task", () => {
    expect(columnsOf("segmentation", "images").map((column) => column.key)).toContain("area");
    expect(columnsOf("classification", "images").map((column) => column.key)).toContain("template");
    expect(columnsOf("detection", "images").map((column) => column.key)).not.toContain("area");
  });
});

describe("isRowInScope", () => {
  const rows = buildRows(
    payload([
      picture({ path: "a.jpg", findings: [finding({ index: 0 })] }),
      picture({ path: "b.jpg" }),
      picture({ path: "clip.mp4", frame: 3, findings: [finding({ index: 0 })] }),
      picture({ path: "clip.mp4", frame: 6 }),
    ]),
    "hide",
  );

  it("keeps image rows, statuses included, for images", () => {
    expect(rows.filter((row) => isRowInScope(row, "images")).map((row) => row.key)).toEqual(["a.jpg@#0", "b.jpg@#status"]);
  });

  it("keeps only frame findings for videos", () => {
    expect(rows.filter((row) => isRowInScope(row, "videos")).map((row) => row.key)).toEqual(["clip.mp4@3#0"]);
  });
});

describe("filterOfScope", () => {
  const filter = {
    frame: { kind: "range" as const, minimum: 1, maximum: 5 },
    class: { kind: "values" as const, values: ["cat"] },
  };

  it("drops the frame condition for images", () => {
    expect(filterOfScope(filter, "images")).toEqual({ class: filter.class });
  });

  it("keeps every condition for videos", () => {
    expect(filterOfScope(filter, "videos")).toBe(filter);
  });

  it("returns the filter itself when it has no frame condition", () => {
    const withoutFrame = { class: filter.class };
    expect(filterOfScope(withoutFrame, "images")).toBe(withoutFrame);
  });
});

describe("pictureKeyOf and rowKeyOf", () => {
  it("joins the path and the frame", () => {
    expect(pictureKeyOf("a.jpg", null)).toBe("a.jpg@");
    expect(pictureKeyOf("clip.mp4", 12)).toBe("clip.mp4@12");
    expect(pictureKeyOf("clip.mp4", 0)).toBe("clip.mp4@0");
  });

  it("adds the finding index to the picture key", () => {
    expect(rowKeyOf("clip.mp4", 12, 3)).toBe("clip.mp4@12#3");
  });
});

describe("buildRows", () => {
  it("returns no rows without results", () => {
    expect(buildRows(null, "dim")).toEqual([]);
  });

  it("makes a row for each passing finding with the picture's details", () => {
    const rows = buildRows(
      payload([
        picture({
          path: "dir/a.jpg",
          name: "a.jpg",
          outdated: "model changed",
          scores: SCORES,
          findings: [finding({ index: 0 }), finding({ index: 1, is_passing: false }), finding({ index: 2 })],
        }),
      ]),
      "hide",
    );
    expect(rows.map((row) => row.key)).toEqual(["dir/a.jpg@#0", "dir/a.jpg@#2"]);
    const first = onlyRow(rows);
    expect(first).toMatchObject({
      kind: "finding",
      path: "dir/a.jpg",
      mediaName: "a.jpg",
      frame: null,
      seconds: null,
      pictureOrder: 0,
      pictureWidth: 640,
      pictureHeight: 480,
      outdated: "model changed",
      scores: SCORES,
    });
  });

  it("lists findings below the minimum when they are dimmed", () => {
    const rows = buildRows(
      payload([picture({ path: "a.jpg", findings: [finding({ index: 0, is_passing: false })] })]),
      "dim",
    );
    expect(rows.map((row) => row.kind)).toEqual(["finding"]);
  });

  it("numbers the pictures in order", () => {
    const rows = buildRows(
      payload([
        picture({ path: "a.jpg", findings: [finding({ index: 0 })] }),
        picture({ path: "b.jpg", findings: [finding({ index: 0 })] }),
      ]),
      "hide",
    );
    expect(rows.map((row) => row.pictureOrder)).toEqual([0, 1]);
  });

  it("makes a status row for a picture without findings", () => {
    const row = onlyRow(buildRows(payload([picture({ path: "a.jpg" })]), "hide"));
    expect(row).toMatchObject({ kind: "status", key: "a.jpg@#status", text: "Nothing found", isBelowMinimum: false });
  });

  it("marks the status row when every finding is hidden below the minimum", () => {
    const row = onlyRow(
      buildRows(
        payload([picture({ path: "a.jpg", findings: [finding({ index: 0, is_passing: false })] })], "classification"),
        "hide",
      ),
    );
    expect(row).toMatchObject({ kind: "status", text: "Low confidence", isBelowMinimum: true });
  });
});

describe("cellValue", () => {
  const [row] = findingRowsOf(
    buildRows(
      payload([
        picture({
          path: "clip.mp4",
          name: "clip.mp4",
          frame: 7,
          findings: [
            finding({
              index: 0,
              class_name: "dog",
              matched_prompt: "puppy",
              matched_template: "a photo of {}",
              confidence: 0.75,
              area: 1234,
              box: [1, 2, 3, 4],
            }),
          ],
        }),
      ]),
      "hide",
    ),
  );
  if (row === undefined) throw new Error("no row");

  it.each([
    ["media", "clip.mp4"],
    ["frame", 7],
    ["keep", KEPT_TEXT],
    ["class", "dog"],
    ["prompt", "puppy"],
    ["template", "a photo of {prompt}"],
    ["confidence", 0.75],
    ["area", 1234],
    ["x1", 1],
    ["y1", 2],
    ["x2", 3],
    ["y2", 4],
  ] as const)("reads the %s of a finding", (key, value) => {
    expect(cellValue(row, key)).toBe(value);
  });

  it("reads a rejected finding and missing values", () => {
    const [bare] = findingRowsOf(
      buildRows(
        payload([
          picture({
            path: "a.jpg",
            findings: [
              finding({ index: 0, is_accepted: false, matched_prompt: null, matched_template: "{}", box: null }),
            ],
          }),
        ]),
        "hide",
      ),
    );
    if (bare === undefined) throw new Error("no row");
    expect(cellValue(bare, "keep")).toBe(REJECTED_TEXT);
    expect(cellValue(bare, "prompt")).toBeNull();
    expect(cellValue(bare, "template")).toBe("None");
    expect(cellValue(bare, "area")).toBeNull();
    expect(cellValue(bare, "x1")).toBeNull();
    expect(cellValue(bare, "y2")).toBeNull();
    expect(cellValue(bare, "frame")).toBeNull();
  });

  it("reads only the media and frame of a status row", () => {
    const status = onlyRow(buildRows(payload([picture({ path: "clip.mp4", frame: 2 })]), "hide"));
    expect(cellValue(status, "media")).toBe("clip.mp4");
    expect(cellValue(status, "frame")).toBe(2);
    expect(cellValue(status, "class")).toBeNull();
    expect(cellValue(status, "keep")).toBeNull();
    expect(cellValue(status, "confidence")).toBeNull();
  });
});

describe("filterRows", () => {
  const rows = buildRows(
    payload([
      picture({
        path: "a.jpg",
        findings: [
          finding({ index: 0, class_name: "cat", confidence: 0.2 }),
          finding({ index: 1, class_name: "dog", confidence: 0.5 }),
          finding({ index: 2, class_name: "bird", confidence: 0.9 }),
        ],
      }),
      picture({ path: "b.jpg" }),
    ]),
    "hide",
  );

  it("returns the rows themselves without conditions", () => {
    expect(filterRows(rows, {})).toBe(rows);
  });

  it("keeps rows whose value is among the chosen values", () => {
    const kept = filterRows(rows, { class: { kind: "values", values: ["cat", "bird"] } });
    expect(kept.map((row) => row.key)).toEqual(["a.jpg@#0", "a.jpg@#2"]);
  });

  it("keeps rows inside an inclusive range", () => {
    const kept = filterRows(rows, { confidence: { kind: "range", minimum: 0.5, maximum: 0.9 } });
    expect(kept.map((row) => row.key)).toEqual(["a.jpg@#1", "a.jpg@#2"]);
  });

  it("treats a missing bound as open", () => {
    expect(filterRows(rows, { confidence: { kind: "range", minimum: null, maximum: 0.5 } })).toHaveLength(2);
    expect(filterRows(rows, { confidence: { kind: "range", minimum: 0.6, maximum: null } })).toHaveLength(1);
  });

  it("drops rows without a value in a filtered column", () => {
    const kept = filterRows(rows, { confidence: { kind: "range", minimum: null, maximum: null } });
    expect(kept.every((row) => row.kind === "finding")).toBe(true);
    expect(kept).toHaveLength(3);
  });

  it("requires every condition", () => {
    const kept = filterRows(rows, {
      class: { kind: "values", values: ["cat", "dog"] },
      confidence: { kind: "range", minimum: 0.4, maximum: null },
    });
    expect(kept.map((row) => row.key)).toEqual(["a.jpg@#1"]);
  });

  it("matches the media of status rows", () => {
    const kept = filterRows(rows, { media: { kind: "values", values: ["b.jpg"] } });
    expect(kept.map((row) => row.kind)).toEqual(["status"]);
  });
});

describe("sortRows", () => {
  const rows = buildRows(
    payload([
      picture({ path: "img10.jpg", findings: [finding({ index: 0, confidence: 0.3, area: 5 })] }),
      picture({ path: "img2.jpg", findings: [finding({ index: 0, confidence: 0.9 })] }),
      picture({ path: "img3.jpg" }),
      picture({ path: "Img1.jpg", findings: [finding({ index: 0, confidence: 0.3, area: 2 })] }),
    ]),
    "hide",
  );

  it("returns the rows themselves without an order", () => {
    expect(sortRows(rows, null)).toBe(rows);
  });

  it("sorts numbers in either direction", () => {
    expect(sortRows(rows, { key: "confidence", isDescending: true }).map((row) => row.mediaName)).toEqual([
      "img2.jpg",
      "img10.jpg",
      "Img1.jpg",
      "img3.jpg",
    ]);
  });

  it("orders equal values by picture order whatever the direction", () => {
    expect(sortRows(rows, { key: "confidence", isDescending: false }).map((row) => row.mediaName)).toEqual([
      "img10.jpg",
      "Img1.jpg",
      "img2.jpg",
      "img3.jpg",
    ]);
  });

  it("sorts text with numbers in natural order ignoring case", () => {
    expect(sortRows(rows, { key: "media", isDescending: false }).map((row) => row.mediaName)).toEqual([
      "Img1.jpg",
      "img2.jpg",
      "img3.jpg",
      "img10.jpg",
    ]);
  });

  it("puts rows without a value last in either direction", () => {
    for (const isDescending of [false, true]) {
      const sorted = sortRows(rows, { key: "area", isDescending });
      expect(sorted.slice(2).map((row) => row.mediaName)).toEqual(["img2.jpg", "img3.jpg"]);
    }
    expect(sortRows(rows, { key: "area", isDescending: true }).map((row) => row.mediaName).slice(0, 2)).toEqual([
      "img10.jpg",
      "Img1.jpg",
    ]);
  });

  it("does not change the given rows", () => {
    const keys = rows.map((row) => row.key);
    sortRows(rows, { key: "media", isDescending: true });
    expect(rows.map((row) => row.key)).toEqual(keys);
  });
});

describe("valuesOf", () => {
  it("lists each value once in natural order, skipping missing ones", () => {
    const rows = buildRows(
      payload([
        picture({
          path: "a.jpg",
          findings: [
            finding({ index: 0, class_name: "cat10" }),
            finding({ index: 1, class_name: "cat2" }),
            finding({ index: 2, class_name: "cat2" }),
          ],
        }),
        picture({ path: "b.jpg" }),
      ]),
      "hide",
    );
    expect(valuesOf(rows, "class")).toEqual(["cat2", "cat10"]);
    expect(valuesOf(rows, "keep")).toEqual([KEPT_TEXT]);
    expect(valuesOf([], "class")).toEqual([]);
  });

  it("writes numbers as text", () => {
    const rows = buildRows(payload([picture({ path: "a.jpg", findings: [finding({ index: 0, confidence: 0.25 })] })]), "hide");
    expect(valuesOf(rows, "confidence")).toEqual(["0.25"]);
  });
});

describe("spanOf", () => {
  it("returns the smallest and largest number of a column", () => {
    const rows = buildRows(
      payload([
        picture({
          path: "a.jpg",
          findings: [finding({ index: 0, confidence: 0.4 }), finding({ index: 1, confidence: 0.1 })],
        }),
        picture({ path: "b.jpg" }),
      ]),
      "hide",
    );
    expect(spanOf(rows, "confidence")).toEqual([0.1, 0.4]);
  });

  it("returns null when the column has no numbers", () => {
    const rows = buildRows(payload([picture({ path: "a.jpg" })]), "hide");
    expect(spanOf(rows, "confidence")).toBeNull();
    expect(spanOf([], "confidence")).toBeNull();
    expect(spanOf(rows, "media")).toBeNull();
  });
});

const GROUPED_ROWS = buildRows(
  payload([
    picture({
      path: "a.jpg",
      findings: [finding({ index: 0 }), finding({ index: 3, is_accepted: false }), finding({ index: 5 })],
    }),
    picture({ path: "b.jpg" }),
    picture({ path: "clip.mp4", frame: 4, findings: [finding({ index: 1, is_passing: false })] }),
  ]),
  "dim",
);

describe("listedIndices", () => {
  it("collects the listed finding indices of each picture", () => {
    expect(listedIndices(GROUPED_ROWS)).toEqual(
      new Map([
        ["a.jpg@", new Set([0, 3, 5])],
        ["clip.mp4@4", new Set([1])],
      ]),
    );
  });

  it("is empty without rows", () => {
    expect(listedIndices([])).toEqual(new Map());
  });
});

describe("groupFindings", () => {
  it("groups the listed findings by picture in order", () => {
    expect(groupFindings(GROUPED_ROWS)).toEqual([
      { path: "a.jpg", frame: null, indices: [0, 3, 5] },
      { path: "clip.mp4", frame: 4, indices: [1] },
    ]);
  });
});

describe("isExportedRow", () => {
  it("exports only accepted passing findings", () => {
    expect(GROUPED_ROWS.map((row) => isExportedRow(row))).toEqual([true, false, true, false, false]);
  });
});

describe("listedPictures", () => {
  it("lists every listed picture with its exported findings", () => {
    expect(listedPictures(GROUPED_ROWS)).toEqual([
      { path: "a.jpg", frame: null, indices: [0, 5] },
      { path: "b.jpg", frame: null, indices: [] },
      { path: "clip.mp4", frame: 4, indices: [] },
    ]);
  });

  it("is empty without rows", () => {
    expect(listedPictures([])).toEqual([]);
  });
});

describe("formatNumber", () => {
  it.each([
    [0.12345, "confidence", "0.123"],
    [1234.6, "area", "1235"],
    [12, "frame", "12"],
    [10.25, "x1", "10.3"],
    [3, "y2", "3.0"],
  ] as const)("writes %d in the %s column as %s", (value, key, text) => {
    expect(formatNumber(value, key)).toBe(text);
  });
});

describe("frameText", () => {
  it("is empty for a still image", () => {
    expect(frameText(null, 3)).toBe("");
  });

  it("writes only the frame number without a time", () => {
    expect(frameText(12, null)).toBe("#12");
  });

  it("writes the time before the frame number", () => {
    expect(frameText(12, 65.5)).toBe("1:05.5 #12");
  });
});

