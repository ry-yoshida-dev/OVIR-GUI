import { useCallback } from "react";
import { api, errorMessage } from "../api/client";
import type { LicenseEntry } from "../api/types";
import { useDialogs } from "../components/DialogHost";

export function useLicenseGate(
  licenses: LicenseEntry[],
  report: (text: string) => void,
): (required: string[]) => Promise<boolean> {
  const dialogs = useDialogs();
  return useCallback(
    async (required: string[]) => {
      for (const value of required) {
        const entry = licenses.find((license) => license.value === value);
        if (entry === undefined) {
          report(`Unknown licensed module: ${value}`);
          return false;
        }
        if (entry.is_accepted) continue;
        if (!entry.is_installed) {
          report(
            `${entry.title} (${entry.license_name}) is not installed. Install it with: ${entry.install_command}`,
          );
          return false;
        }
        const isAccepted = await dialogs.confirm({
          title: `${entry.title} license (${entry.license_name})`,
          message: (
            <>
              {entry.notice}
              {"\n\n"}
              <a href={entry.license_url} target="_blank" rel="noreferrer">
                {entry.license_url}
              </a>
            </>
          ),
          confirmLabel: "I Accept",
        });
        if (!isAccepted) return false;
        try {
          await api.acceptLicense(entry.value);
        } catch (error) {
          report(errorMessage(error));
          return false;
        }
      }
      return true;
    },
    [licenses, dialogs, report],
  );
}
