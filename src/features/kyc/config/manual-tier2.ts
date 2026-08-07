export function manualTier2RequiresLiveness(): boolean {
  return process.env.MANUAL_TIER2_LIVENESS_ENABLED === 'true';
}
