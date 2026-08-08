"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

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
  status: "success" | "fallback" | "error" | "pending";
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

type AgentRun = {
  agentName: string;
  goal: string;
  plan: string[];
  toolsUsed: { step: string; tool: string; status: string }[];
  observations: string[];
  decision: {
    pipelineStatus: string;
    dataStatus: string;
    likelyIssue: string;
    decisionSummary: string;
    confidence: string;
    recommendedHumanAction: string;
    approvalRequired: boolean;
  };
  guardrails: string[];
  finalArtifact: {
    type: string;
    status: string;
    stakeholderMessagePreview: string;
  };
};

type InvestigationResult = {
  ok: boolean;
  mode: string;
  incident: Incident;
  timeline: TimelineStep[];
  agentRun?: AgentRun;
  recoveryPlan: RecoveryPlan;
  approvalRequired: boolean;
  error?: string;
};

const pendingTimeline: TimelineStep[] = [
  {
    step: "Load incident",
    tool: "Incident store",
    status: "pending",
    summary: "Start the run to load the active incident.",
  },
  {
    step: "Check Fivetran connection",
    tool: "Fivetran API",
    status: "pending",
    summary: "The agent will inspect the live Fivetran connection status.",
  },
  {
    step: "Check BigQuery freshness",
    tool: "Freshness check",
    status: "pending",
    summary: "The agent will check whether the BigQuery table is fresh enough to trust.",
  },
  {
    step: "Generate recovery plan",
    tool: "Gemini on Google Cloud",
    status: "pending",
    summary: "Gemini will turn the collected evidence into a recovery recommendation.",
  },
];

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28 },
};

function freshnessSentence(minutes?: number) {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) return "Freshness check has not run yet.";
  if (minutes < 60) return `${minutes} minutes stale against a 6-hour expectation.`;
  return `~${Math.round(minutes / 60)} hours stale against a 6-hour expectation.`;
}

function conciseText(text: string, maxLength = 190) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? normalized;
  return firstSentence.length <= maxLength ? firstSentence : `${firstSentence.slice(0, maxLength).trim()}…`;
}

function getOutcomeValue(
  timeline: TimelineStep[],
  recoveryPlan: RecoveryPlan | null,
  agentRun: AgentRun | null
) {
  const fivetranStep = timeline.find((step) => step.tool.toLowerCase().includes("fivetran"));
  const freshnessStep = timeline.find((step) => step.tool.toLowerCase().includes("freshness"));

  return {
    pipeline:
      agentRun?.decision.pipelineStatus ??
      (fivetranStep?.status === "success"
        ? "Healthy"
        : fivetranStep?.status === "fallback"
          ? "Needs review"
          : "Not checked"),
    data: freshnessStep?.evidence?.status === "stale" ? "Stale" : "Not checked",
    likelyIssue:
      agentRun?.decision.likelyIssue ??
      (freshnessStep?.evidence?.status === "stale"
        ? "Upstream source"
        : "Pending evidence"),
    approval: recoveryPlan?.approvalRequired ? "Required" : "Pending",
  };
}

function getStepBadge(step: TimelineStep) {
  const tool = step.tool.toLowerCase();
  if (tool.includes("fivetran")) return "Fivetran";
  if (tool.includes("freshness")) return "BigQuery";
  if (tool.includes("gemini")) return "Gemini";
  if (tool.includes("incident")) return "Incident";
  return step.tool;
}

function getStepSummary(step: TimelineStep, freshnessMinutes?: number) {
  if (step.tool.toLowerCase().includes("freshness") && freshnessMinutes) {
    return freshnessSentence(freshnessMinutes);
  }
  return step.summary;
}

function StatusPill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "blue" | "emerald" | "amber" | "red" | "purple" | "slate";
}) {
  const toneClass = {
    blue: "border-blue-400/30 bg-blue-500/10 text-blue-200",
    emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    red: "border-red-400/30 bg-red-500/10 text-red-200",
    purple: "border-purple-400/30 bg-purple-500/10 text-purple-200",
    slate: "border-slate-700 bg-slate-900 text-slate-300",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${toneClass}`}>
      {children}
    </span>
  );
}

function PanelButton({
  active,
  label,
  eyebrow,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  eyebrow: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-blue-400/50 bg-blue-500/15 shadow-lg shadow-blue-500/10"
          : "border-slate-700 bg-slate-950/70 hover:border-blue-400/40 hover:bg-blue-500/10"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
        {eyebrow}
      </p>
      <p className="mt-2 text-base font-black text-slate-100">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
    </button>
  );
}

export default function Home() {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [approved, setApproved] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [openPanel, setOpenPanel] = useState<"evidence" | "audit" | "recovery" | null>(null);

  useEffect(() => {
    async function loadIncident() {
      const response = await fetch("/api/incidents");
      const json = await response.json();
      setIncident(json.incidents[0]);
    }
    loadIncident();
  }, []);

  const activeIncident = investigation?.incident ?? incident;
  const timeline = useMemo(() => investigation?.timeline ?? [], [investigation?.timeline]);
  const displayTimeline = timeline.length ? timeline : pendingTimeline;
  const recoveryPlan = investigation?.recoveryPlan ?? null;
  const agentRun = investigation?.agentRun ?? null;
  const investigationComplete = Boolean(investigation);

  const freshnessMinutes = useMemo(() => {
    const freshnessStep = timeline.find((step) => step.tool.toLowerCase().includes("freshness"));
    const value = freshnessStep?.evidence?.actualFreshnessMinutes;
    return typeof value === "number" ? value : undefined;
  }, [timeline]);

  const outcome = getOutcomeValue(timeline, recoveryPlan, agentRun);
  const pipelineHealthy = outcome.pipeline === "Healthy";
  const nextAction = approved
    ? "Stakeholder recovery brief is ready."
    : recoveryPlan
      ? "Approve the recovery brief."
      : isInvestigating
        ? "The agent is checking live evidence."
        : "Click Run Rescue Investigation to start.";

  const stageLabel = approved
    ? "Complete"
    : recoveryPlan
      ? "Needs approval"
      : investigationComplete
        ? "Evidence collected"
        : "Not started";

  const trustDecisionTitle = recoveryPlan
    ? "Dashboard not cleared"
    : "Can leadership trust this dashboard?";

  const trustDecisionDetail = recoveryPlan
    ? "No. The dashboard may be available, but the underlying sales data is stale."
    : "Run the agent to check Fivetran, BigQuery, and Gemini evidence.";

  const primaryActionLabel = isInvestigating
    ? "Investigating..."
    : investigationComplete
      ? "Evidence Collected"
      : "Run Rescue Investigation";

  async function runInvestigation() {
    setIsInvestigating(true);
    setApproved(false);
    setInvestigation(null);
    setOpenPanel(null);

    try {
      const response = await fetch("/api/investigate", { method: "POST" });
      const json = await response.json();
      if (!json.ok) throw new Error(json.error ?? "Investigation failed.");
      setInvestigation(json);
      setIncident(json.incident);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown investigation error";
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
        agentRun: {
          agentName: "Pipeline Rescue Agent",
          goal: "Investigate whether a stale reporting dashboard can be trusted before stakeholders use it for business decisions.",
          plan: ["Retry the investigation.", "Check service credentials."],
          toolsUsed: [{ step: "Investigation failed", tool: "Pipeline Rescue Agent", status: "error" }],
          observations: [message],
          decision: {
            pipelineStatus: "Needs review",
            dataStatus: "Unknown",
            likelyIssue: "Investigation error",
            decisionSummary: "The investigation could not complete.",
            confidence: "low",
            recommendedHumanAction: "Retry the investigation or check service credentials.",
            approvalRequired: true,
          },
          guardrails: [
            "The agent does not send stakeholder communication automatically.",
            "The agent does not perform destructive pipeline operations automatically.",
            "The recovery brief requires human approval before it is treated as stakeholder-ready.",
          ],
          finalArtifact: {
            type: "human_approved_recovery_brief",
            status: "blocked",
            stakeholderMessagePreview: "The dashboard investigation could not complete. Please retry or contact the data operations owner.",
          },
        },
        recoveryPlan: {
          likelyCause: "The investigation could not complete.",
          businessRisk: "The dashboard freshness risk remains unresolved.",
          recommendedAction: "Retry the investigation or check service credentials.",
          approvalRequired: true,
          severity: "high",
          evidence: [message],
          nextSteps: ["Retry the investigation.", "Check service credentials."],
          stakeholderMessage: "The dashboard investigation could not complete. Please retry or contact the data operations owner.",
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
      await fetch("/api/approval/generate-brief", { method: "POST" });
      setApproved(true);
    } finally {
      setIsApproving(false);
    }
  }

  function resetDemo() {
    setInvestigation(null);
    setApproved(false);
    setIsInvestigating(false);
    setIsApproving(false);
    setOpenPanel(null);
  }

  return (
    <main className="min-h-screen bg-[#050816] text-slate-100 [background-image:radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_30%),linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:auto,44px_44px,44px_44px]">
      <section className="mx-auto flex max-w-7xl flex-col gap-4 px-5 pb-28 pt-5">
        <motion.header
          {...cardMotion}
          className="rounded-3xl border border-slate-800 bg-slate-950/85 p-5 shadow-2xl backdrop-blur"
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-blue-300">
                Google Cloud Rapid Agent Hackathon · Fivetran Track
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                Pipeline Rescue Agent
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
                Stale dashboard → evidence → approved recovery brief.
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                A guided incident cockpit for trust decisions, auditability, and human-approved communication.
              </p>
            </div>

            <div className="grid min-w-[280px] grid-cols-2 gap-2 text-xs font-bold uppercase">
              <div className="flex items-center gap-2 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-blue-200">
                <Sparkles className="h-4 w-4" />
                Gemini Plan
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Fivetran Healthy
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-cyan-200">
                <Database className="h-4 w-4" />
                BigQuery Stale
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-200">
                <ShieldCheck className="h-4 w-4" />
                Human Approval
              </div>
            </div>
          </div>
        </motion.header>

        <motion.section
          {...cardMotion}
          className="rounded-3xl border border-blue-400/25 bg-slate-950/90 p-5 shadow-2xl shadow-blue-500/5 backdrop-blur"
        >
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-stretch">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                    <Activity className="h-4 w-4" />
                    Executive Incident Cockpit
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-100">
                    {trustDecisionTitle}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    {trustDecisionDetail}
                  </p>
                </div>

                <StatusPill tone={approved ? "emerald" : recoveryPlan ? "amber" : "blue"}>
                  {stageLabel}
                </StatusPill>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-red-200">Incident</p>
                  <p className="mt-1 text-sm font-black text-slate-100">
                    {activeIncident?.title ?? "Loading..."}
                  </p>
                </div>
                <div
                  className={`rounded-2xl border p-4 ${
                    pipelineHealthy
                      ? "border-emerald-400/25 bg-emerald-500/10"
                      : "border-amber-400/25 bg-amber-500/10"
                  }`}
                >
                  <p
                    className={`text-[11px] font-black uppercase tracking-wider ${
                      pipelineHealthy ? "text-emerald-200" : "text-amber-200"
                    }`}
                  >
                    Pipeline
                  </p>
                  <p
                    className={`mt-1 text-xl font-black ${
                      pipelineHealthy ? "text-emerald-100" : "text-amber-100"
                    }`}
                  >
                    {outcome.pipeline}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-amber-200">Data</p>
                  <p className="mt-1 text-xl font-black text-amber-100">{outcome.data}</p>
                </div>
                <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 p-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-purple-200">Approval</p>
                  <p className="mt-1 text-xl font-black text-purple-100">{outcome.approval}</p>
                </div>
              </div>

              {recoveryPlan ? (
                <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200">
                        Mission result
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-100">
                        {agentRun
                          ? `${agentRun.decision.pipelineStatus} · ${agentRun.decision.dataStatus} · approval required`
                          : `${outcome.pipeline} · ${outcome.data} · approval required`}
                      </p>
                    </div>
                    <StatusPill tone="amber">Do not clear dashboard</StatusPill>
                  </div>
                </div>
              ) : null}
            </div>

            <div id="incident" className="scroll-mt-24 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                <ArrowRight className="h-4 w-4" />
                Next action
              </p>
              <h3 className="mt-3 text-2xl font-black text-slate-100">{nextAction}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The flow is intentionally short: run the agent, review the decision, approve the brief.
              </p>

              <div className="mt-5 grid gap-2">
                <motion.button
                  whileHover={{ scale: isInvestigating || investigationComplete ? 1 : 1.01 }}
                  whileTap={{ scale: isInvestigating || investigationComplete ? 1 : 0.98 }}
                  onClick={runInvestigation}
                  disabled={isInvestigating || investigationComplete}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-300/30 transition hover:bg-blue-400 hover:shadow-blue-400/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:ring-slate-600"
                >
                  {primaryActionLabel}
                  <ArrowRight className="h-5 w-5" />
                </motion.button>

                {recoveryPlan ? (
                  <motion.button
                    whileHover={{ scale: isApproving || approved ? 1 : 1.01 }}
                    whileTap={{ scale: isApproving || approved ? 1 : 0.98 }}
                    onClick={approveBrief}
                    disabled={isApproving || approved}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-500/30 ring-1 ring-emerald-300/30 transition hover:bg-emerald-400 hover:shadow-emerald-400/30 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:ring-slate-600"
                  >
                    {isApproving ? "Generating brief..." : approved ? "Brief Approved" : "Approve Recovery Brief"}
                    <ShieldCheck className="h-5 w-5" />
                  </motion.button>
                ) : null}

                {investigationComplete ? (
                  <button
                    onClick={resetDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-wider text-slate-300 transition hover:border-blue-400/60 hover:text-blue-100"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reset Demo
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-blue-400/25 bg-blue-500/10 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-blue-200">1 · Run</p>
                  <p className="mt-1 text-sm font-bold text-slate-100">Collect evidence</p>
                </div>
                <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-purple-200">2 · Review</p>
                  <p className="mt-1 text-sm font-bold text-slate-100">Trust decision</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-200">3 · Approve</p>
                  <p className="mt-1 text-sm font-bold text-slate-100">Recovery brief</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          {...cardMotion}
          className="rounded-3xl border border-slate-800 bg-slate-950/85 p-5 shadow-2xl backdrop-blur"
        >
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Optional proof panels
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-100">
                Evidence, audit, and recovery details stay available.
              </h2>
            </div>
            <StatusPill tone={recoveryPlan ? "emerald" : "slate"}>
              {recoveryPlan ? "Evidence collected" : "Run first"}
            </StatusPill>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <PanelButton
              active={openPanel === "evidence"}
              eyebrow="Proof"
              label="Evidence Trail"
              detail={recoveryPlan ? "4 checks completed" : "Appears after run"}
              onClick={() => setOpenPanel(openPanel === "evidence" ? null : "evidence")}
            />
            <PanelButton
              active={openPanel === "audit"}
              eyebrow="Agent"
              label="Audit Ledger"
              detail={agentRun ? "Decision + guardrails" : "Appears after run"}
              onClick={() => setOpenPanel(openPanel === "audit" ? null : "audit")}
            />
            <PanelButton
              active={openPanel === "recovery"}
              eyebrow="Action"
              label="Recovery Path"
              detail={recoveryPlan ? "Cause, risk, action" : "Appears after run"}
              onClick={() => setOpenPanel(openPanel === "recovery" ? null : "recovery")}
            />
          </div>

          {openPanel === "evidence" ? (
            <div id="evidence" className="mt-5 scroll-mt-24 rounded-2xl border border-blue-400/20 bg-blue-950/10 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
                <Activity className="h-4 w-4" />
                Evidence Trail
              </p>
              <div className="mt-4 grid gap-3">
                {displayTimeline.map((step, index) => {
                  const success = step.status === "success";
                  const error = step.status === "error";

                  return (
                    <div
                      key={`${step.step}-${index}`}
                      className={`rounded-2xl border p-3 ${
                        error
                          ? "border-red-300 bg-red-50 text-red-800"
                          : success
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : step.status === "pending"
                              ? "border-slate-700 bg-slate-950 text-slate-300"
                              : "border-amber-300 bg-amber-50 text-amber-900"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                        <p className="font-black">{index + 1}. {step.step}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase text-slate-800">{getStepBadge(step)}</span>
                          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black uppercase text-slate-800">{step.status}</span>
                        </div>
                      </div>
                      <details className="mt-2 group">
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider opacity-75 transition hover:opacity-100">
                          View evidence detail
                        </summary>
                        <p className="mt-2 text-sm leading-6 opacity-90">{getStepSummary(step, freshnessMinutes)}</p>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {openPanel === "audit" && agentRun ? (
            <div id="audit" className="mt-5 scroll-mt-24 rounded-2xl border border-purple-400/20 bg-purple-950/10 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-purple-300">
                <ClipboardCheck className="h-4 w-4" />
                Agent Audit Ledger
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl bg-slate-950/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-purple-300">Decision</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">
                    {agentRun.decision.pipelineStatus} pipeline · {agentRun.decision.dataStatus} data · likely issue: {agentRun.decision.likelyIssue}
                  </p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Confidence: {agentRun.decision.confidence}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-950/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-purple-300">Guardrails</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">
                    No auto-send. No destructive pipeline action. Human approval required.
                  </p>
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-purple-200/80 transition hover:text-purple-100">
                      Full audit detail
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Goal</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{agentRun.goal}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tools</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {agentRun.toolsUsed.map((tool) => (
                            <span key={`${tool.step}-${tool.tool}`} className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-100">
                              {tool.tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          ) : null}

          {openPanel === "recovery" && recoveryPlan ? (
            <div id="approval" className="mt-5 scroll-mt-24 rounded-2xl border border-amber-400/20 bg-amber-950/10 p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
                <LockKeyhole className="h-4 w-4" />
                Recovery Recommendation
              </p>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl bg-slate-950/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cause</p>
                  <p className="mt-2 text-lg font-black text-slate-100">Source freshness</p>
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-amber-200/80 transition hover:text-amber-100">Detail</summary>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{conciseText(recoveryPlan.likelyCause)}</p>
                  </details>
                </div>
                <div className="rounded-2xl bg-slate-950/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Risk</p>
                  <p className="mt-2 text-lg font-black text-slate-100">Stale executive data</p>
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-amber-200/80 transition hover:text-amber-100">Detail</summary>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{conciseText(recoveryPlan.businessRisk)}</p>
                  </details>
                </div>
                <div className="rounded-2xl bg-slate-950/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Action</p>
                  <p className="mt-2 text-lg font-black text-slate-100">Verify source + sync</p>
                  <details className="mt-2 group">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-amber-200/80 transition hover:text-amber-100">Detail</summary>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{conciseText(recoveryPlan.recommendedAction)}</p>
                  </details>
                </div>
              </div>
            </div>
          ) : null}
        </motion.section>

        {approved && recoveryPlan ? (
          <motion.section id="brief" {...cardMotion} className="scroll-mt-24 rounded-3xl border border-emerald-400/25 bg-emerald-950/10 p-5 shadow-lg shadow-emerald-500/5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Approved Brief
                </p>
                <h2 className="mt-3 text-2xl font-black">Approved Stakeholder Brief</h2>
                <p className="mt-2 text-emerald-200">Approved for stakeholder communication</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-black uppercase text-emerald-200">
                Human Approved
              </span>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Stakeholder message</p>
                <p className="mt-2 text-lg font-black leading-7 text-slate-100">
                  Sales data is stale. Use caution until freshness is verified.
                </p>
                <details className="mt-2 group">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-emerald-200/80 transition hover:text-emerald-100">
                    Full stakeholder message
                  </summary>
                  <p className="mt-2 leading-7 text-slate-300">{conciseText(recoveryPlan.stakeholderMessage, 320)}</p>
                </details>
              </div>

              <div className="rounded-2xl bg-slate-950/80 p-4">
                <p className="text-sm text-slate-400">Next steps</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-100">
                  {recoveryPlan.nextSteps.slice(0, 2).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <details className="mt-2 group">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-emerald-200/80 transition hover:text-emerald-100">
                    More steps
                  </summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-300">
                    {recoveryPlan.nextSteps.slice(2, 4).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </details>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-950/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300">Before / After</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="font-black text-slate-100">Before</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    <li>Manual checks</li>
                    <li>Unclear dashboard trust</li>
                    <li>No approved brief</li>
                  </ul>
                </div>
                <div>
                  <p className="font-black text-slate-100">After</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    <li>Evidence collected</li>
                    <li>Trust decision ready</li>
                    <li>Brief approved</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-200">Next action</p>
              <p className="mt-1 text-sm font-bold text-slate-100">{nextAction}</p>
            </div>
            {!approved ? (
              <motion.button
                whileHover={{ scale: isInvestigating || isApproving ? 1 : 1.01 }}
                whileTap={{ scale: isInvestigating || isApproving ? 1 : 0.98 }}
                onClick={recoveryPlan ? approveBrief : runInvestigation}
                disabled={isInvestigating || isApproving || (!recoveryPlan && investigationComplete)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isInvestigating ? "Investigating..." : isApproving ? "Approving..." : recoveryPlan ? "Approve Brief" : investigationComplete ? "Evidence Collected" : "Run Investigation"}
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            ) : (
              <button onClick={resetDemo} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black uppercase tracking-wider text-slate-300 transition hover:border-emerald-400/60 hover:text-emerald-100">
                <RefreshCcw className="h-4 w-4" />
                Reset Demo
              </button>
            )}
          </div>
        </motion.div>
      </section>
    </main>
  );
}
