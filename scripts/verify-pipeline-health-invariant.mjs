import { evaluateFivetranHealth } from "../lib/pipelineHealth.mjs";

const healthyLookingStatus = {
  setupState: "connected",
  updateState: "on_schedule",
  hasWarnings: false,
  hasTasks: false,
  paused: false,
};

const scenarios = [
  {
    name: "Cached non-live evidence cannot certify current health",
    input: {
      ...healthyLookingStatus,
      mode: "cached_fivetran_evidence",
    },
    expectedHealthy: false,
  },
  {
    name: "Live MCP evidence can certify current health",
    input: {
      ...healthyLookingStatus,
      mode: "mcp_live",
    },
    expectedHealthy: true,
  },
  {
    name: "Live API evidence can certify current health",
    input: {
      ...healthyLookingStatus,
      mode: "live",
    },
    expectedHealthy: true,
  },
];

console.log("=== PIPELINE HEALTH INVARIANT CHECK ===");

for (const scenario of scenarios) {
  const result = evaluateFivetranHealth(scenario.input);

  console.log();
  console.log(scenario.name);
  console.log("Evidence mode:", scenario.input.mode);
  console.log("Live evidence:", result.hasLiveEvidence);
  console.log("Healthy:", result.isHealthy);
  console.log("Expected Healthy:", scenario.expectedHealthy);

  if (result.isHealthy !== scenario.expectedHealthy) {
    throw new Error(
      `FAIL: ${scenario.name} — expected Healthy=${scenario.expectedHealthy}, received ${result.isHealthy}`
    );
  }

  console.log("PASS");
}

console.log();
console.log(
  "PASS: non-live evidence cannot certify health, while valid live evidence still can."
);
