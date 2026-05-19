"use client";

import { useEffect, useMemo, useState } from "react";

type Incident = {
  id: string;
  title: string;
  severity: string;
  affectedDashboard: string;
  connectorId: string;
  destinationTable: string;
  businessImpact: string;
  lastSuccessfulRefreshHoursAgo: number;
};

type TimelineStep = {
  step: string;
  tool: string;
  status: "success" | "fallback" | "error";
  summary: string;
  evidence?: Record<string, unknown>;
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

type InvestigationResult = {
  ok: boolean;
  mode: string;
  incident: Incident;
  timeline: TimelineStep[];
  recoveryPlan: RecoveryPlan;
  approvalRequired: boolean;
  error?: string;
};

function formatFreshness(minutes?: number) {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) {
    return "Freshness checked";
  }

  if (minutes < 60) {
    return `${minutes} min stale`;
  }

  const hours = Math.round(minutes / 60);
  return `~${hours} hrs stale`;
}

function conciseText(text: string, maxLength = 190) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const firstSentenceMatch = normalized.match(/^.*?[.!?](?:\s|$)/);
  const firstSentence = firstSentenceMatch?.[0]?.trim() ?? normalized;

  if (firstSentence.length <= maxLength) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, maxLength).trim()}…`;
}

function getStepBadge(step: TimelineStep) {
  if (step.tool.toLowerCase().includes("fivetran")) return "Live Fivetran";
  if (step.tool.toLowerCase().includes("freshness")) return "Live BigQuery";
  if (step.tool.toLowerCase().includes("gemini")) return "Gemini Live";
  if (step.tool.toLowerCase().includes("incident")) return "Incident";
  return step.tool;
}

export default function Home() {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(
    null
  );
  const [approved, setApproved] = useState(false);
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

  const activeIncident = investigation?.incident ?? incident;
  const timeline = useMemo(
    () => investigation?.timeline ?? [],
    [investigation?.timeline]
  );
  const recoveryPlan = investigation?.recoveryPlan ?? null;

  const freshnessMinutes = useMemo(() => {
    const freshnessStep = timeline.find((step) =>
      step.tool.toLowerCase().includes("freshness")
    );

    const value = freshnessStep?.evidence?.actualFreshnessMinutes;
    return typeof value === "number" ? value : undefined;
  }, [timeline]);

  const freshnessLabel = formatFreshness(freshnessMinutes);

  async function runInvestigation() {
    setIsInvestigating(true);
    setApproved(false);
    setInvestigation(null);

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
      });
      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error ?? "Investigation failed.");
      }

      setInvestigation(json);
      setIncident(json.incident);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown investigation error";

      setInvestigation({
        ok: false,
        mode: "error",
        incident:
          activeIncident ??
          ({
            id: "incident_sales_stale_001",
            title: "Monday Sales Dashboard is stale",
            severity: "high",
            affectedDashboard: "Executive Sales Overview",
            connectorId: "google_sheets_sales_orders",
            destinationTable: "sales_orders",
            businessImpact: "Leadership meeting soon may use outdated sales data.",
            lastSuccessfulRefreshHoursAgo: 0,
          } satisfies Incident),
        timeline: [
          {
            step: "Investigation failed",
            tool: "Pipeline Rescue Agent",
            status: "error",
            summary: message,
          },
        ],
        recoveryPlan: {
          likelyCause: "The investigation could not complete.",
          businessRisk: "The dashboard freshness risk remains unresolved.",
          recommendedAction: "Retry the investigation or check service credentials.",
          approvalRequired: true,
          severity: "high",
          evidence: [message],
          nextSteps: ["Retry the investigation.", "Check service credentials."],
          stakeholderMessage:
            "The dashboard investigation could not complete. Please retry or contact the data operations owner.",
        },
        approvalRequired: true,
        error: message,
      });
    } finally {
      setIsInvestigating(false);
    }
  }

  async function approveBrief() {
    setIsApproving(true);

    try {
      await fetch("/api/approval/generate-brief", {
        method: "POST",
      });
      setApproved(true);
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] text-slate-100">
      <section className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6">
        <header className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-2xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-300">
                Google Cloud Rapid Agent Hackathon · Fivetran Track
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Pipeline Rescue Agent
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
                A data operations agent that turns a stale reporting pipeline
                into an evidence-backed, human-approved recovery brief.
              </p>
            </div>

            <div className="grid min-w-[280px] grid-cols-2 gap-2 text-xs font-bold uppercase">
              <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-blue-200">
                Gemini Live
              </div>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-200">
                Fivetran Live
              </div>
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-cyan-200">
                BigQuery Live
              </div>
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-200">
                Human Approval
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.35fr]">
          <div className="rounded-3xl border border-red-400/25 bg-red-950/20 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-300">
                  Active Incident
                </p>
                <h2 className="mt-3 text-2xl font-black leading-tight">
                  {activeIncident?.title ?? "Loading incident..."}
                </h2>
              </div>
              <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-black uppercase text-white">
                High
              </span>
            </div>

            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-2xl bg-slate-950/70 p-4">
                <p className="text-slate-400">Affected dashboard</p>
                <p className="mt-1 font-bold">
                  {activeIncident?.affectedDashboard ?? "Executive Sales Overview"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-950/70 p-4">
                  <p className="text-slate-400">Destination table</p>
                  <p className="mt-1 font-bold">
                    {activeIncident?.destinationTable ?? "sales_orders"}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-400/30 bg-amber-950/25 p-4">
                  <p className="text-slate-400">Freshness signal</p>
                  <p className="mt-1 font-bold text-amber-200">
                    {timeline.length ? freshnessLabel : "Pending investigation"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/70 p-4">
                <p className="text-slate-400">Business impact</p>
                <p className="mt-1 font-bold">
                  {activeIncident?.businessImpact ??
                    "Leadership meeting may use outdated sales data."}
                </p>
              </div>
            </div>

            <button
              onClick={runInvestigation}
              disabled={isInvestigating}
              className="mt-5 w-full rounded-2xl bg-blue-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isInvestigating ? "Investigating..." : "Run Rescue Investigation"}
            </button>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
                  Agent Tool Timeline
                </p>
                <h2 className="mt-3 text-2xl font-black">
                  One click, multi-tool investigation
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  The backend orchestration route checks Fivetran, BigQuery, and
                  Gemini in one controlled workflow.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs text-slate-300">
                <span className="font-bold text-slate-100">Agent loop:</span>{" "}
                Investigate → Reason → Approve → Brief
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {(timeline.length
                ? timeline
                : [
                    {
                      step: "Load incident",
                      tool: "Incident store",
                      status: "fallback" as const,
                      summary: "Waiting to start investigation.",
                    },
                    {
                      step: "Check Fivetran connection",
                      tool: "Fivetran API",
                      status: "fallback" as const,
                      summary: "Live Fivetran check will run here.",
                    },
                    {
                      step: "Check BigQuery freshness",
                      tool: "Freshness check",
                      status: "fallback" as const,
                      summary: "Live BigQuery freshness check will run here.",
                    },
                    {
                      step: "Generate recovery plan",
                      tool: "Gemini on Google Cloud",
                      status: "fallback" as const,
                      summary: "Gemini will generate the recovery plan.",
                    },
                  ]
              ).map((step, index) => {
                const success = step.status === "success";
                const error = step.status === "error";

                return (
                  <div
                    key={`${step.step}-${index}`}
                    className={`rounded-2xl border p-4 ${
                      error
                        ? "border-red-300 bg-red-50 text-red-800"
                        : success
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-700 bg-slate-950 text-slate-300"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                      <p className="font-black">
                        {index + 1}. {step.step}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase text-slate-800">
                          {getStepBadge(step)}
                        </span>
                        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black uppercase text-slate-800">
                          {step.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 opacity-90">
                      {step.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {recoveryPlan ? (
          <section className="rounded-3xl border border-amber-400/25 bg-amber-950/10 p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
                  Recovery Plan · Human Approval Required
                </p>
                <h2 className="mt-3 text-2xl font-black">
                  Evidence-backed recommendation
                </h2>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-blue-200">
                  Gemini Live
                </span>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-200">
                  Approval Required
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Cause</p>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  {conciseText(recoveryPlan.likelyCause)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Risk</p>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  {conciseText(recoveryPlan.businessRisk)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Action</p>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  {conciseText(recoveryPlan.recommendedAction)}
                </p>
              </div>
            </div>

            <button
              onClick={approveBrief}
              disabled={isApproving}
              className="mt-5 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isApproving ? "Generating brief..." : "Approve Recovery Brief"}
            </button>
          </section>
        ) : null}

        {approved && recoveryPlan ? (
          <section className="rounded-3xl border border-emerald-400/25 bg-emerald-950/10 p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                  Approved Output
                </p>
                <h2 className="mt-3 text-2xl font-black">
                  Pipeline Rescue Recovery Brief
                </h2>
                <p className="mt-2 text-emerald-200">
                  Approved for stakeholder communication
                </p>
              </div>

              <span className="rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-black uppercase text-emerald-200">
                Human Approved
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Stakeholder message</p>
                <p className="mt-2 leading-7 text-slate-100">
                  {conciseText(recoveryPlan.stakeholderMessage, 260)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Next steps</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-100">
                  {recoveryPlan.nextSteps.slice(0, 3).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-950/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
                Before / After
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-black text-slate-100">Before</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    <li>Analyst checks pipeline tools manually</li>
                    <li>Freshness risk is unclear</li>
                    <li>No stakeholder-ready message</li>
                  </ul>
                </div>
                <div>
                  <p className="font-black text-slate-100">After</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    <li>Agent checks Fivetran and BigQuery evidence</li>
                    <li>Gemini generates the recovery recommendation</li>
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
