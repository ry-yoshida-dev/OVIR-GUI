import { useCallback } from "react";
import { attempt, errorMessage } from "../api/client";
import type { ActionReply } from "../api/types";
import { useDialogs } from "../components/DialogHost";

export type Call = (action: () => Promise<unknown>) => Promise<boolean>;

export type RunAction = (
  action: (isSkippingApproved: boolean) => Promise<ActionReply>,
) => Promise<boolean>;

export interface ActionRunner {
  call: Call;
  runAction: RunAction;
}

/**
 * Runs requests to the server, reporting their errors, and asks before skipping reference-only classes.
 */
export function useActionRunner(report: (text: string) => void): ActionRunner {
  const dialogs = useDialogs();
  const call = useCallback<Call>((action) => attempt(action, report), [report]);
  const runAction = useCallback<RunAction>(
    async (action) => {
      try {
        let reply = await action(false);
        if (reply.status === "needs_approval") {
          const isApproved = await dialogs.confirm({
            title: "Skip reference-only classes?",
            message: reply.message,
            confirmLabel: "Infer Without Them",
          });
          if (!isApproved) return false;
          reply = await action(true);
        }
        if (reply.status === "rejected") {
          report(reply.message);
          return false;
        }
        return reply.status === "done";
      } catch (error) {
        report(errorMessage(error));
        return false;
      }
    },
    [dialogs, report],
  );
  return { call, runAction };
}
