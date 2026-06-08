import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type FivetranMcpRuntime = {
  attempted: boolean;
  ok: boolean;
  server: "official-fivetran-mcp";
  transport: "stdio";
  tool: "get_connection_details";
  allowWrites: false;
  connectionId: string;
  schemaFile: string;
  mode:
    | "mcp_live"
    | "mcp_unavailable"
    | "mcp_credentials_missing"
    | "mcp_client_unavailable"
    | "mcp_tool_error"
    | "mcp_runtime_error";
  reason?: string;
  data?: {
    id: string;
    service: string;
    schema: string;
    paused: boolean;
    status: Record<string, unknown>;
  };
};

const DEFAULT_MCP_RUNTIME: FivetranMcpRuntime = {
  attempted: true,
  ok: false,
  server: "official-fivetran-mcp",
  transport: "stdio",
  tool: "get_connection_details",
  allowWrites: false,
  connectionId: process.env.FIVETRAN_CONNECTION_ID ?? "chisel_consumption",
  schemaFile: "open-api-definitions/connections/connection_details.json",
  mode: "mcp_unavailable",
  reason: "Fivetran MCP runtime probe did not complete.",
};

function parseMcpProbeOutput(stdout: string): FivetranMcpRuntime {
  const firstJsonLine = stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("{") && line.endsWith("}"));

  if (!firstJsonLine) {
    return {
      ...DEFAULT_MCP_RUNTIME,
      mode: "mcp_runtime_error",
      reason: stdout.slice(0, 500) || "No JSON payload returned.",
    };
  }

  const parsed = JSON.parse(firstJsonLine) as FivetranMcpRuntime;

  return {
    ...DEFAULT_MCP_RUNTIME,
    ...parsed,
    data: parsed.data,
  };
}

async function runProbeWithPython(
  pythonCommand: string,
  probePath: string
): Promise<FivetranMcpRuntime> {
  const { stdout, stderr } = await execFileAsync(pythonCommand, [probePath], {
    timeout: 15000,
    env: {
      ...process.env,
      FIVETRAN_ALLOW_WRITES: "false",
    },
  });

  const result = parseMcpProbeOutput(stdout);

  if (!result.ok && stderr) {
    return {
      ...result,
      reason: `${result.reason ?? "MCP probe failed."} stderr: ${stderr.slice(
        0,
        300
      )}`,
    };
  }

  return result;
}

export async function getFivetranMcpRuntimeStatus(): Promise<FivetranMcpRuntime> {
  const probePath = join(process.cwd(), "scripts", "fivetran_mcp_runtime_probe.py");

  const preferredPython =
    process.env.FIVETRAN_MCP_PYTHON_BIN ??
    "/workspaces/fivetran-mcp/.venv/bin/python";

  try {
    return await runProbeWithPython(preferredPython, probePath);
  } catch (preferredError) {
    if (process.env.FIVETRAN_MCP_PYTHON_BIN) {
      return {
        ...DEFAULT_MCP_RUNTIME,
        mode: "mcp_runtime_error",
        reason:
          preferredError instanceof Error
            ? preferredError.message.slice(0, 500)
            : "Unknown MCP runtime probe error.",
      };
    }

    try {
      return await runProbeWithPython("python", probePath);
    } catch (fallbackError) {
      return {
        ...DEFAULT_MCP_RUNTIME,
        mode: "mcp_runtime_error",
        reason:
          fallbackError instanceof Error
            ? fallbackError.message.slice(0, 500)
            : "Unknown MCP runtime probe error.",
      };
    }
  }
}
