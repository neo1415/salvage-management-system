/**
 * Detect whether the identity widget finished the full workflow vs. an intermediate step.
 * Dojah can fire callbacks after liveness alone — those must not submit to our API.
 */

export interface DojahWidgetCallbackResponse {
  reference_id?: string;
  referenceId?: string;
  reference?: string;
  verification_reference?: string;
  workflow_reference?: string;
  status?: boolean | string;
  verification_status?: string;
  verificationStatus?: string;
  message?: string;
  data?: Record<string, unknown> & {
    reference_id?: string;
    referenceId?: string;
    reference?: string;
    selfie?: unknown;
    government_data?: unknown;
    id?: unknown;
    business_id?: unknown;
    business_data?: unknown;
  };
}

export function resolveDojahWidgetReference(response?: DojahWidgetCallbackResponse): string | undefined {
  if (!response) return undefined;
  return (
    response.reference_id ||
    response.referenceId ||
    response.reference ||
    response.verification_reference ||
    response.workflow_reference ||
    response.data?.reference_id ||
    response.data?.referenceId ||
    response.data?.reference ||
    undefined
  );
}

function workflowStatusText(response: DojahWidgetCallbackResponse): string {
  const raw = response.verification_status ?? response.verificationStatus;
  if (raw) return String(raw).trim().toLowerCase();
  if (typeof response.status === 'string') return response.status.trim().toLowerCase();
  return '';
}

function isCompletedWorkflowStatus(statusText: string): boolean {
  const normalized = statusText.replace(/[_-]+/g, ' ').trim();
  return normalized === 'completed' || normalized === 'complete';
}

/** Full workflow finished (safe to call /api/kyc/complete). */
export function isDojahWidgetFinalSuccess(response?: DojahWidgetCallbackResponse): boolean {
  if (!response) return false;

  const reference = resolveDojahWidgetReference(response);
  if (!reference) return false;

  if (response.status === false) return false;

  return isCompletedWorkflowStatus(workflowStatusText(response));
}

/** Widget reported a step failure but the overall session may still have finished (manual review). */
export function isDojahWidgetRecoverableAfterError(err: unknown): boolean {
  const errorObj = err as { message?: string; referenceId?: string; reference_id?: string };
  const hasReference = Boolean(errorObj.referenceId || errorObj.reference_id);
  const message = (errorObj.message ?? '').toLowerCase();
  return hasReference && message.includes('completed');
}

/** Intermediate step (e.g. liveness only) — has a reference or partial data but workflow not done. */
export function isDojahWidgetIntermediateStep(response?: DojahWidgetCallbackResponse): boolean {
  if (!response || isDojahWidgetFinalSuccess(response)) return false;
  const reference = resolveDojahWidgetReference(response);
  const data = response.data;
  const hasPartialData = Boolean(
    data?.selfie || data?.government_data || data?.id || data?.business_id || data?.business_data
  );
  const statusText = workflowStatusText(response);
  const providerStillWorking = ['ongoing', 'pending', 'submitted', 'failed', 'abandoned'].some((status) =>
    statusText.includes(status)
  );
  return Boolean(reference || hasPartialData || response.status === true || providerStillWorking);
}
