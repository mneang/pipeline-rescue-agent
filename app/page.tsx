"use client";

import { useEffect, useState } from "react";

type Incident = {
  id: string;
  title: string;
  severity: string;
  affectedDashboard: string;
  destinationTable: string;
  businessImpact: string;
  lastSuccessfulRefreshHoursAgo: number;
};

type ToolStep = {
  name: string;
  status: "pending" | "running" | "success" | "error";
  detail?: string;
  badge?: string;
};

type RecoveryPlan = {
  likelyCause: string;
  businessRisk: string;
  recommendedAction: string;
  approvalRequired: boolean;
  severity: "low" | "medium" | "high";
  evidence: string[];
  nextSteps: string[];
  stakeholderMessage: string;
};

type RecoveryBrief = {
  title: string;
  status: string;
  diagnosis: {
    likelyCause: string;
  };
  stakeholderMessage: string;
  recommendedActions: string[];
};

export default function Home() {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [steps, setSteps] = useState<ToolStep[]>([
    { name: "Load incident", status: "pending" },
    { name: "Check Fivetran connection", status: "pending" },
    { name: "Check data freshness", status: "pending" },
    { name: "Generate Gemini recovery plan", status: "pending" },
  ]);
  const [recoveryPlan, setRecoveryPlan] = useState<RecoveryPlan | null>(null);
  const [brief, setBrief] = useState<RecoveryBrief | null>(null);
  const [plannerMode, setPlannerMode] = useState<string | null>(null);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    async function loadIncident() {
      const response = await fetch("/api/incidents");
      const json = await response.json();
      setIncident(json.incidents[0]);
    }

    loadIncident();
  }, []);

  function updateStep(index: number, update: Partial<ToolStep>) {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...update } : step))
    );
  }

  async function runInvestigation() {
    setIsInvestigating(true);
    setRecoveryPlan(null);
    setBrief(null);
    setPlannerMode(null);

    setSteps([
      { name: "Load incident", status: "running" },
      { name: "Check Fivetran connection", status: "pending" },
      { name: "Check data freshness", status: "pending" },
      { name: "Generate Gemini recovery plan", status: "pending" },
    ]);

    try {
      const incidentsResponse = await fetch("/api/incidents");
      const incidentsJson = await incidentsResponse.json();
      const activeIncident = incidentsJson.incidents[0];
      setIncident(activeIncident);

      updateStep(0, {
        status: "success",
        badge: "Incident loaded",
        detail: `${activeIncident.title} loaded for investigation.`,
      });

      updateStep(1, { status: "running" });
      const fivetranResponse = await fetch("/api/fivetran/status");
      const fivetranJson = await fivetranResponse.json();
      const fivetranStatus = fivetranJson.result.status;

      updateStep(1, {
        status: "success",
        badge: "Live Fivetran",
        detail: `Service: ${fivetranJson.result.service}. Schema: ${fivetranJson.result.schema}. Status: ${fivetranStatus?.setup_state ?? "checked"} / ${fivetranStatus?.update_state ?? "available"}.`,
      });

      updateStep(2, { status: "running" });
      const freshnessResponse = await fetch("/api/data/freshness");
      const freshnessJson = await freshnessResponse.json();

      updateStep(2, {
        status: "success",
        badge: "Freshness check",
        detail: `${freshnessJson.result.table} is ${freshnessJson.result.status}. Actual freshness: ${freshnessJson.result.actualFreshnessMinutes} minutes vs expected ${freshnessJson.result.expectedFreshnessMinutes} minutes.`,
      });

      updateStep(3, { status: "running" });
      const planResponse = await fetch("/api/agent/recovery-plan", {
        method: "POST",
      });
      const planJson = await planResponse.json();

      setPlannerMode(planJson.mode);
      setRecoveryPlan(planJson.result);

      updateStep(3, {
        status: "success",
        badge: planJson.mode === "gemini_live" ? "Gemini live" : "Fallback safe",
        detail:
          planJson.mode === "gemini_live"
            ? "Gemini generated a recovery plan from incident, Fivetran, and freshness evidence."
            : "Fallback recovery plan generated to keep the demo stable.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown investigation error";

      setSteps((current) =>
        current.map((step) =>
          step.status === "running"
            ? { ...step, status: "error", detail: message }
            : step
        )
      );
    } finally {
      setIsInvestigating(false);
    }
  }

  async function approveBrief() {
    setIsApproving(true);

    try {
      const response = await fetch("/api/approval/generate-brief", {
        method: "POST",
      });
      const json = await response.json();
      setBrief(json.result);
    } finally {
      setIsApproving(false);
    }
  }

  const statusStyle: Record<ToolStep["status"], string> = {
    pending: "border-slate-200 bg-slate-50 text-slate-500",
    running: "border-blue-200 bg-blue-50 text-blue-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            Google Cloud Rapid Agent Hackathon · Fivetran Track
          </p>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Pipeline Rescue Agent
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-slate-300">
                A Gemini-powered data operations agent that investigates stale
                reporting pipelines, checks live Fivetran status, reviews data
                freshness, and produces an approval-gated recovery brief.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-400/30 bg-blue-950/30 p-4 text-sm text-blue-100">
              <p className="font-bold text-blue-200">Agent loop</p>
              <p>Investigate → Reason → Approve → Brief</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-2xl border border-red-400/30 bg-red-950/30 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-red-300">
                  Active Incident
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  {incident?.title ?? "Loading incident..."}
                </h2>
              </div>
              <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold uppercase text-white">
                High
              </span>
            </div>

            <div className="space-y-3 text-sm text-slate-200">
              <div className="rounded-xl bg-slate-900/70 p-4">
                <p className="text-slate-400">Affected dashboard</p>
                <p className="font-semibold">
                  {incident?.affectedDashboard ?? "Executive Sales Overview"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-900/70 p-4">
                <p className="text-slate-400">Destination table</p>
                <p className="font-semibold">
                  {incident?.destinationTable ?? "sales_orders"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-900/70 p-4">
                <p className="text-slate-400">Business impact</p>
                <p className="font-semibold">
                  {incident?.businessImpact ??
                    "Leadership meeting may use outdated sales data."}
                </p>
              </div>
            </div>

            <button
              onClick={runInvestigation}
              disabled={isInvestigating}
              className="mt-6 w-full rounded-xl bg-blue-500 px-5 py-3 font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {isInvestigating ? "Investigating..." : "Run Investigation"}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
              Agent Tool Timeline
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Evidence-driven investigation
            </h2>

            <div className="mt-6 space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.name}
                  className={`rounded-xl border p-4 ${statusStyle[step.status]}`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="font-bold">
                      {index + 1}. {step.name}
                    </p>
                    <div className="flex gap-2">
                      {step.badge ? (
                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase text-slate-800">
                          {step.badge}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                        {step.status}
                      </span>
                    </div>
                  </div>

                  {step.detail ? (
                    <p className="mt-2 text-sm opacity-90">{step.detail}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        {recoveryPlan ? (
          <section className="rounded-2xl border border-amber-300/30 bg-amber-950/20 p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">
                  Recovery Plan · Human Approval Required
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  Recommended action
                </h2>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-bold uppercase">
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-blue-200">
                  {plannerMode === "gemini_live"
                    ? "Gemini live"
                    : "Fallback safe"}
                </span>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-200">
                  Approval required
                </span>
              </div>
            </div>

            <p className="mt-4 text-slate-200">
              {recoveryPlan.recommendedAction}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-sm text-slate-400">Likely cause</p>
                <p className="mt-2 font-medium">{recoveryPlan.likelyCause}</p>
              </div>

              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-sm text-slate-400">Business risk</p>
                <p className="mt-2 font-medium">{recoveryPlan.businessRisk}</p>
              </div>
            </div>

            <button
              onClick={approveBrief}
              disabled={isApproving}
              className="mt-6 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {isApproving
                ? "Generating approved brief..."
                : "Approve Recovery Brief"}
            </button>
          </section>
        ) : null}

        {brief ? (
          <section className="rounded-2xl border border-emerald-300/30 bg-emerald-950/20 p-6 shadow-xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
                  Approved Output
                </p>
                <h2 className="mt-2 text-3xl font-bold">{brief.title}</h2>
                <p className="mt-2 text-emerald-200">{brief.status}</p>
              </div>

              <span className="rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-bold uppercase text-emerald-200">
                Human approved
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-sm text-slate-400">Diagnosis</p>
                <p className="mt-2 font-medium">{brief.diagnosis.likelyCause}</p>
              </div>

              <div className="rounded-xl bg-slate-900/80 p-4">
                <p className="text-sm text-slate-400">Stakeholder message</p>
                <p className="mt-2 font-medium">{brief.stakeholderMessage}</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-900/80 p-4">
              <p className="text-sm text-slate-400">Recommended next steps</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                {brief.recommendedActions.map((action: string) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </div>

            <div className="mt-6 rounded-xl border border-blue-400/20 bg-blue-950/20 p-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-300">
                Before / After
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-bold text-slate-200">Before</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                    <li>Analyst manually checks multiple systems</li>
                    <li>Dashboard freshness risk is unclear</li>
                    <li>No stakeholder-ready message</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-slate-200">After</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                    <li>Agent checks Fivetran and freshness evidence</li>
                    <li>Gemini generates a recovery recommendation</li>
                    <li>Human-approved recovery brief is ready</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
