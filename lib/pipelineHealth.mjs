/**
 * Evaluate whether current Fivetran evidence is strong enough to certify health.
 *
 * Cached evidence remains useful historical context, but only live evidence
 * may produce a Healthy verdict.
 */
export function evaluateFivetranHealth({
  mode,
  setupState,
  updateState,
  hasWarnings,
  hasTasks,
  paused,
}) {
  const hasLiveEvidence = mode === "mcp_live" || mode === "live";

  const isHealthy =
    hasLiveEvidence &&
    setupState === "connected" &&
    updateState === "on_schedule" &&
    !hasWarnings &&
    !hasTasks &&
    paused === false;

  return {
    hasLiveEvidence,
    isHealthy,
  };
}
