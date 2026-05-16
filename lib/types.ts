export type Incident = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  affectedDashboard: string;
  connectorId: string;
  destinationTable: string;
  businessImpact: string;
  lastSuccessfulRefreshHoursAgo: number;
};

export type FivetranStatus = {
  connectionId: string;
  service?: string;
  schema?: string;
  paused?: boolean;
  status?: unknown;
  mode: "live" | "demo_fallback";
};
