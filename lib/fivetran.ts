export async function getFivetranConnectionStatus() {
  const apiKey = process.env.FIVETRAN_API_KEY;
  const apiSecret = process.env.FIVETRAN_API_SECRET;
  const connectionId = process.env.FIVETRAN_CONNECTION_ID;

  if (!apiKey || !apiSecret || !connectionId) {
    return {
      connectionId: connectionId ?? "missing_connection_id",
      service: "google_sheets",
      schema: "pipeline_rescue",
      paused: false,
      status: {
        setup_state: "connected",
        sync_state: "scheduled",
      },
      mode: "demo_fallback" as const,
      fallbackReason: "Missing Fivetran environment variables.",
    };
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const response = await fetch(
    `https://api.fivetran.com/v1/connections/${connectionId}`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      connectionId,
      service: "google_sheets",
      schema: "pipeline_rescue",
      paused: false,
      status: {
        setup_state: "connected",
        sync_state: "scheduled",
      },
      mode: "demo_fallback" as const,
      fallbackReason: `Fivetran API returned ${response.status}.`,
    };
  }

  const json = await response.json();

  return {
    connectionId,
    service: json?.data?.service,
    schema: json?.data?.schema,
    paused: json?.data?.paused,
    status: json?.data?.status,
    mode: "live" as const,
  };
}
