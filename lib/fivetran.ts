type FivetranStatus = {
  connectionId: string;
  service: string;
  schema: string;
  paused: boolean;
  status: Record<string, unknown>;
  mode: "live" | "cached_fivetran_evidence" | "fallback";
  fallbackReason?: string;
};

const CACHED_FIVETRAN_EVIDENCE: FivetranStatus = {
  connectionId: process.env.FIVETRAN_CONNECTION_ID ?? "chisel_consumption",
  service: "google_sheets",
  schema: "pipeline_rescue.sales_orders",
  paused: false,
  status: {
    setup_state: "connected",
    schema_status: "ready",
    sync_state: "scheduled",
    update_state: "on_schedule",
    tasks: [],
    warnings: [],
  },
  mode: "cached_fivetran_evidence",
  fallbackReason:
    "Fivetran API unavailable after trial expiration; using cached connection evidence captured from the validated Google Sheets to BigQuery demo pipeline.",
};

export async function getFivetranConnectionStatus(): Promise<FivetranStatus> {
  const apiKey = process.env.FIVETRAN_API_KEY;
  const apiSecret = process.env.FIVETRAN_API_SECRET;
  const connectionId = process.env.FIVETRAN_CONNECTION_ID ?? "chisel_consumption";

  if (!apiKey || !apiSecret) {
    return {
      ...CACHED_FIVETRAN_EVIDENCE,
      connectionId,
      fallbackReason:
        "Fivetran credentials are unavailable; using cached connection evidence captured from the validated Google Sheets to BigQuery demo pipeline.",
    };
  }

  try {
    const response = await fetch(
      `https://api.fivetran.com/v1/connections/${connectionId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString(
            "base64"
          )}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return {
        ...CACHED_FIVETRAN_EVIDENCE,
        connectionId,
        fallbackReason:
          response.status === 402
            ? "Fivetran trial expired; using cached connection evidence captured from the validated Google Sheets to BigQuery demo pipeline."
            : `Fivetran API returned ${response.status}; using cached connection evidence captured from the validated demo pipeline.`,
      };
    }

    const json = await response.json();
    const data = json?.data ?? {};

    return {
      connectionId: data.id ?? connectionId,
      service: data.service ?? "google_sheets",
      schema: data.schema ?? "pipeline_rescue.sales_orders",
      paused: Boolean(data.paused),
      status: data.status ?? {},
      mode: "live",
    };
  } catch (error) {
    return {
      ...CACHED_FIVETRAN_EVIDENCE,
      connectionId,
      fallbackReason:
        error instanceof Error
          ? `Fivetran API error: ${error.message}; using cached connection evidence captured from the validated demo pipeline.`
          : "Unknown Fivetran API error; using cached connection evidence captured from the validated demo pipeline.",
    };
  }
}
