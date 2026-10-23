import { useCallback } from "react";
import { api } from "../api/client";
import type {
  LicenseEntry,
  ModelSelection,
  WorkspaceState,
} from "../api/types";
import type { Call } from "./useActionRunner";
import { useLicenseGate } from "./useLicenseGate";

export interface ModelSelector {
  selectPreset: (backend: string, presetName: string) => Promise<void>;
  selectModel: (selection: ModelSelection) => Promise<void>;
}

const NO_LICENSES: LicenseEntry[] = [];

/**
 * Switches the model or its preset once every license the choice needs is accepted.
 */
export function useModelSelection(
  state: WorkspaceState | null,
  call: Call,
  report: (text: string) => void,
): ModelSelector {
  const ensureLicenses = useLicenseGate(
    state?.model.licenses ?? NO_LICENSES,
    report,
  );
  const selectPreset = useCallback(
    async (backend: string, presetName: string) => {
      const licenses =
        state?.model.backends
          .find((entry) => entry.value === backend)
          ?.presets.find((preset) => preset.name === presetName)?.licenses ??
        [];
      if (await ensureLicenses(licenses))
        await call(() => api.selectPreset(backend, presetName));
    },
    [state, ensureLicenses, call],
  );
  const selectModel = useCallback(
    async (selection: ModelSelection) => {
      const licenses =
        state?.model.box_detectors.find(
          (entry) => entry.label === selection.box_detector_label,
        )?.licenses ?? [];
      if (await ensureLicenses(licenses))
        await call(() => api.selectModel(selection));
    },
    [state, ensureLicenses, call],
  );
  return { selectPreset, selectModel };
}
