const endpoint = process.env.PIPELINE_RESCUE_URL
  ? `${process.env.PIPELINE_RESCUE_URL.replace(/\/$/, "")}/api/investigate`
  : "http://localhost:3000/api/investigate";

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
});

if (!response.ok) {
  throw new Error(`Investigation request failed with HTTP ${response.status}`);
}

const data = await response.json();

const fivetran = data.timeline?.find((step) =>
  String(step.tool).toLowerCase().includes("fivetran")
);

if (!fivetran) {
  throw new Error("Fivetran timeline step was not found");
}

const mode = fivetran.evidence?.mode;
const liveEvidence = fivetran.evidence?.liveEvidence;
const verdict = data.agentRun?.decision?.pipelineStatus;

console.log("=== FALSE GREEN REGRESSION CHECK ===");
console.log("Evidence mode:", mode);
console.log("Live evidence:", liveEvidence);
console.log("Pipeline verdict:", verdict);

if (mode === "cached_fivetran_evidence") {
  if (liveEvidence !== false) {
    throw new Error(
      `Expected cached evidence to be non-live, received: ${liveEvidence}`
    );
  }

  if (verdict === "Healthy") {
    throw new Error(
      "REGRESSION: cached non-live Fivetran evidence produced a Healthy verdict"
    );
  }

  if (verdict !== "Needs review") {
    throw new Error(
      `Expected Needs review for cached evidence, received: ${verdict}`
    );
  }
}

console.log("PASS: non-live cached evidence cannot produce a Healthy verdict.");
