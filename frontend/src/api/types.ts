export type Box = [number, number, number, number];

export type TaskValue = "classification" | "detection" | "segmentation";

export type MediaKindValue = "image" | "video";

export type PlaybackValue = "none" | "preparing" | "ready" | "failed";

export type MediaStateValue =
  "not_analyzed" | "partial" | "done" | "outdated" | "failed";

export interface PictureKey {
  path: string;
  frame: number | null;
}

export interface MediaEntry {
  path: string;
  name: string;
  kind: MediaKindValue;
  state: MediaStateValue;
  expected_count: number;
  recognized_count: number;
  kept_count: number;
  description: string;
  frame_count: number | null;
  fps: number | null;
}

export interface CurrentPicture {
  path: string;
  name: string;
  kind: MediaKindValue;
  frame: number | null;
  version: string | null;
  width: number | null;
  height: number | null;
  frame_count: number | null;
  fps: number | null;
  playback: PlaybackValue;
  timestamp: string | null;
  is_sampled: boolean;
}

export type LvisSplitValue = "minival" | "val";

export interface ModelBenchmark {
  lvis_ap: number | null;
  lvis_split: LvisSplitValue | null;
  is_lvis_zero_shot: boolean;
  gflops: number | null;
}

export interface PresetEntry {
  name: string;
  label: string;
  licenses: string[];
  weights_path: string;
  prompt_mode: PromptModeValue;
  query_kinds: QueryKindValue[];
  is_sequential: boolean;
  benchmark: ModelBenchmark | null;
}

export interface StoredWeights {
  weights_path: string;
  size_bytes: number;
  is_in_use: boolean;
}

export interface StoredWeightsPayload {
  stored: StoredWeights[];
}

export interface BoxDetectorEntry {
  label: string;
  licenses: string[];
}

export interface LicenseEntry {
  value: string;
  title: string;
  license_name: string;
  license_url: string;
  notice: string;
  install_command: string;
  is_installed: boolean;
  is_accepted: boolean;
}

export interface BackendEntry {
  value: string;
  presets: PresetEntry[];
  image_poolings: string[];
  is_box_prompted: boolean;
  mode: SegmentationModeValue | null;
}

export type SegmentationModeValue =
  "concept" | "promptable" | "generation" | "tracker" | "concept_tracker";

export type PromptModeValue = "classes" | "marks" | "automatic";

export type QueryKindValue = "text" | "visual" | "exemplar" | "mark";

export type DrawingKindValue = "exemplar" | "mark";

export interface DrawingKindEntry {
  value: DrawingKindValue;
  is_used: boolean;
}

export interface ModelTuning {
  confidence_label: string | null;
  is_nms_shown: boolean;
  is_minimum_confidence_shown: boolean;
}

export interface DeviceEntry {
  value: string;
  is_available: boolean;
}

export interface PrecisionEntry {
  value: string;
  label: string;
  is_available: boolean;
}

export interface ModelSelection {
  backend: string;
  preset_name: string;
  device: string;
  precision: string;
  confidence_threshold: number | null;
  nms_iou_threshold: number | null;
  image_pooling: string | null;
  box_detector_label: string | null;
  tiling_grid_size: number | null;
  text_templates: string[] | null;
  aggregation: AggregationStep[] | null;
  batch_size: number | null;
}

export type AggregationUnitValue = "template" | "prompt" | "template_and_prompt";
export type AggregationTimingValue = "embedding" | "similarity";
export type AggregationMethodValue = "mean" | "max" | "median" | "min" | "logsumexp";

export interface AggregationStep {
  unit: AggregationUnitValue;
  timing: AggregationTimingValue;
  method: AggregationMethodValue;
}

export interface TaskState {
  value: TaskValue;
  options: { value: TaskValue; title: string }[];
}

export interface ModelState {
  backends: BackendEntry[];
  modes: { value: SegmentationModeValue; title: string }[];
  drawing_kinds: DrawingKindEntry[];
  is_sequential: boolean;
  is_point_supported: boolean;
  tuning: ModelTuning;
  devices: DeviceEntry[];
  precisions: PrecisionEntry[];
  box_detectors: BoxDetectorEntry[];
  licenses: LicenseEntry[];
  selection: ModelSelection;
  is_image_prompt_supported: boolean;
  text_templates: string[] | null;
  saved_templates: string[];
  aggregation: AggregationStep[] | null;
  aggregation_methods: { value: AggregationMethodValue; title: string }[];
  weights_path: string;
  description: string;
  benchmark_phrase_count: number;
}

export interface ProfileOption {
  name: string;
  value: string;
}

export interface Profile {
  key: string;
  task: TaskValue;
  backend: string;
  model_name: string;
  weights_path: string;
  device: string;
  precision: string;
  options: ProfileOption[];
  options_text: string;
  file_count: number;
  done_file_count: number;
  expected_frame_count: number;
  recognized_frame_count: number;
  outdated_count: number;
  finding_count: number;
}

export interface ReferenceEntry {
  name: string;
  digest: string;
  width: number;
  height: number;
  boxes: Box[];
}

export interface ClassEntry {
  name: string;
  color: string;
  phrases: string[];
  references: ReferenceEntry[];
  exemplar_count: number;
  object_count: number;
}

export interface ClassSetState {
  name: string;
  is_edited: boolean;
  is_unsaved: boolean;
  names: string[];
  directory: string;
}

export interface Thresholds {
  default_minimum: number;
  class_minimums: Record<string, number>;
  prompt_minimums: Record<string, Record<string, number>>;
}

export type LabelModeValue = "single_label" | "multi_label";

export interface LabelModeState {
  value: LabelModeValue;
  modes: { value: LabelModeValue; title: string }[];
}

export interface DuplicateSuppression {
  is_enabled: boolean;
  overlap_threshold: number;
  class_overlap_thresholds: Record<string, number>;
}

export interface Progress {
  title: string;
  processed_count: number;
  total_count: number;
}

export interface ExportSummary {
  format_name: string;
  output_directory: string;
  picture_count: number;
  finding_count: number;
  file_count: number;
}

export type InferenceModeValue = "shown" | "all";

export interface InferenceState {
  mode: InferenceModeValue;
  is_auto: boolean;
  modes: { value: InferenceModeValue; label: string }[];
  pause_reason: string | null;
  is_following_playback: boolean;
}

export interface ExemplarEntry {
  index: number;
  class_name: string;
  box: Box;
  is_positive: boolean;
}

export interface MarkEntry {
  object_id: number;
  class_name: string;
  positive_points: [number, number][];
  negative_points: [number, number][];
  box: Box | null;
}

export interface MarkedObject {
  object_id: number;
  class_name: string;
  frames: (number | null)[];
}

export interface PicturePrompt {
  path: string;
  frame: number | null;
  exemplars: ExemplarEntry[];
  marks: MarkEntry[];
  objects: MarkedObject[];
  next_object_id: number;
}

export interface WorkspaceState {
  media: MediaEntry[];
  current: CurrentPicture | null;
  picture_prompt: PicturePrompt | null;
  background_key: PictureKey | null;
  task: TaskState;
  model: ModelState;
  profiles: Profile[];
  shown_profile_key: string | null;
  compared_profile_key: string | null;
  classes: ClassEntry[];
  class_set: ClassSetState;
  thresholds: Thresholds;
  suppression: DuplicateSuppression;
  label_mode: LabelModeState | null;
  standard_minimum: number;
  standard_overlap_threshold: number;
  status: { message: string; serial: number };
  activity: string;
  summary: string;
  progress: Progress | null;
  background_progress: Progress | null;
  is_busy: boolean;
  inference: InferenceState;
  sampling: { frame_step: number };
  last_export: ExportSummary | null;
  palette: string[];
  upload_directory: string;
  accepted_suffixes: string[];
}

export interface Finding {
  index: number;
  class_name: string;
  matched_prompt: string | null;
  matched_template: string | null;
  confidence: number;
  box: Box | null;
  area: number | null;
  similarity?: number | null;
  is_accepted: boolean;
  is_passing: boolean;
}

export interface FrameInstance extends Finding {
  box: Box;
  polygons: number[][];
  color?: string | null;
}

export interface DocumentObject {
  index: number;
  class_name: string;
  matched_prompt: string;
  confidence: number;
  box: Box;
  area: number;
  polygons: [number, number][][];
}

export interface ObjectDocument {
  format: "ovir-gui-objects";
  version: number;
  model: string | null;
  coordinate_space: string;
  pictures: {
    path: string;
    frame: number | null;
    width: number;
    height: number;
    objects: DocumentObject[];
  }[];
}

export interface ClassScore {
  class_name: string;
  score: number;
  logit: number;
  similarity: number | null;
  matched_prompt: string | null;
  matched_template: string | null;
}

export interface RankedScore {
  class_name: string;
  score: number;
  is_reaching_minimum: boolean;
}

export interface FramePayload {
  path: string;
  frame: number | null;
  task: TaskValue;
  result_frame: number | null;
  is_recognized: boolean;
  is_exact: boolean;
  outdated: string | null;
  findings: (Finding | FrameInstance)[];
  scores: ClassScore[];
  compared: {
    model_name: string;
    findings: FrameInstance[];
    top_class: string | null;
  } | null;
}

export interface VideoFramesPayload {
  path: string;
  frames: FramePayload[];
}

export interface ResultPicture {
  path: string;
  name: string;
  frame: number | null;
  seconds: number | null;
  outdated: string | null;
  scores: RankedScore[];
  findings: Finding[];
}

export interface ResultsPayload {
  profile_key: string | null;
  task: TaskValue;
  pictures: ResultPicture[];
}

export interface TimelinePayload {
  path: string;
  frame_count: number;
  fps: number;
  frame_step: number;
  frames: number[];
  top_classes: (string | null)[];
  classes: { name: string; color: string; values: number[] }[];
}

export type ActionStatus = "done" | "rejected" | "needs_approval";

export interface ShowReply {
  is_following_playback: boolean;
}

export interface ActionReply {
  status: ActionStatus;
  message: string;
  skipped_class_names: string[];
}

export interface HistogramPayload {
  bin_counts: number[];
  bin_width: number;
}

export interface ConfidenceSummaryPayload {
  count: number;
  minimum: number;
  lower_decile: number;
  lower_quartile: number;
  median: number;
  upper_quartile: number;
  upper_decile: number;
  maximum: number;
  mean: number;
}

export interface ThresholdCurvePayload {
  finding_counts: number[];
  picture_counts: number[];
}

export interface SizeDistributionPayload {
  small_count: number;
  medium_count: number;
  large_count: number;
  median_area_share: number | null;
}

export interface ClassStatisticsPayload {
  class_name: string;
  picture_count: number;
  finding_count: number;
  rejected_count: number;
  below_minimum_count: number;
  kept_count: number;
  peak_count: number;
  confidences: ConfidenceSummaryPayload | null;
  kept_confidences: ConfidenceSummaryPayload | null;
  threshold_curve: ThresholdCurvePayload;
  sizes: SizeDistributionPayload | null;
}

export interface ClassMatrixPayload {
  class_names: string[];
  counts: number[][];
}

export interface PictureStatisticsPayload {
  path: string;
  frame: number | null;
  label: string;
  finding_count: number;
  kept_count: number;
  kept_class_names: string[];
  best_confidence: number | null;
  borderline_count: number;
  top_margin: number | null;
}

export interface PictureListsPayload {
  most_kept: PictureStatisticsPayload[];
  empty: PictureStatisticsPayload[];
  borderline: PictureStatisticsPayload[];
  ambiguous: PictureStatisticsPayload[];
}

export interface ResultStatisticsPayload {
  picture_count: number;
  recognized_count: number;
  finding_count: number;
  kept_count: number;
  rejected_count: number;
  below_minimum_count: number;
  empty_picture_count: number;
  borderline_picture_count: number;
  threshold_step_count: number;
  borderline_margin: number;
  overlap_threshold: number;
  classes: ClassStatisticsPayload[];
  kept_count_distribution: number[];
  picture_lists: PictureListsPayload;
  co_occurrence: ClassMatrixPayload;
  overlaps: ClassMatrixPayload | null;
  runner_ups: ClassMatrixPayload | null;
  margins: HistogramPayload | null;
}

export interface ClassComparisonPayload {
  class_name: string;
  shown_count: number;
  compared_count: number;
  matched_count: number;
  shown_only_count: number;
  compared_only_count: number;
  agreement: number | null;
  mean_matched_overlap: number | null;
}

export interface PictureDisagreementPayload {
  path: string;
  frame: number | null;
  label: string;
  shown_count: number;
  compared_count: number;
  matched_count: number;
  shown_only_count: number;
  compared_only_count: number;
}

export interface ProfileComparisonPayload {
  picture_count: number;
  iou_threshold: number;
  disagreeing_picture_count: number;
  classes: ClassComparisonPayload[];
  pictures: PictureDisagreementPayload[];
  confusion: ClassMatrixPayload | null;
}

export interface StatisticsPayload {
  model: string | null;
  compared_model: string | null;
  task: TaskValue;
  statistics: ResultStatisticsPayload | null;
  comparison: ProfileComparisonPayload | null;
}

export interface ClassSetListEntry {
  name: string;
  saved_at: string;
  is_readable: boolean;
  class_names: string[];
  description: string;
}

export interface ClassSetPreview {
  name: string;
  classes: ClassEntry[];
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  directories: string[];
  files: { name: string; kind: MediaKindValue }[];
  shortcuts: { name: string; path: string }[];
}

export interface ExportFormat {
  value: string;
  label: string;
  is_confidence_supported: boolean;
  purpose: ExportPurposeValue;
  group_label: string;
}

export type ExportPurposeValue = "annotations" | "crops" | "class_folders";

export type CropImageFormatValue = "jpeg" | "png";

export interface ExportChoice {
  export_format: string;
  output_directory: string;
  is_confidence_included: boolean;
  is_annotated_image_saved: boolean;
  is_annotated_video_saved: boolean;
  crop_image_format: CropImageFormatValue;
  crop_margin_percent: number;
}

export interface ExportPreviewChoice {
  export_format: string;
  is_confidence_included: boolean;
  crop_image_format: CropImageFormatValue;
  crop_margin_percent: number;
}

export interface ExportPreviewRequest extends ExportPreviewChoice {
  media: MediaKindValue;
  listed_findings: PictureFindings[] | null;
}

export interface LabelPreview {
  file_name: string;
  text: string;
  is_shown_picture_only: boolean;
  is_truncated: boolean;
}

export interface ExportRequest extends ExportChoice {
  media: MediaKindValue;
  listed_findings: PictureFindings[] | null;
  is_label_confidence_shown: boolean;
}

export interface ExportPlan {
  model_name: string;
  options_text: string;
  task: TaskValue;
  media: MediaKindValue;
  picture_count: number;
  pending_count: number;
  is_pending_inferable: boolean;
  issue: string;
  formats: ExportFormat[];
  purposes: { value: ExportPurposeValue; label: string; description: string }[];
  crop_image_formats: { value: CropImageFormatValue; label: string }[];
  default_directory: string;
}

export interface ReferenceDraft {
  draft_id: string;
  name: string;
  width: number;
  height: number;
}

export interface PictureFindings {
  path: string;
  frame: number | null;
  indices: number[];
}

export type WorkspaceTopic = "state" | "results" | "class_sets";

export type ServerEvent =
  | { type: "changed"; topics: WorkspaceTopic[] }
  | { type: "notice"; level: "info" | "error"; title: string; message: string };
