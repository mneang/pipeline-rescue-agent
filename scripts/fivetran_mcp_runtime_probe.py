import asyncio
import json
import os
import sys
from pathlib import Path


CONNECTION_ID = os.getenv("FIVETRAN_CONNECTION_ID", "chisel_consumption")
SERVER_DIR = Path(os.getenv("FIVETRAN_MCP_SERVER_DIR", "/workspaces/fivetran-mcp"))
SCHEMA_FILE = "open-api-definitions/connections/connection_details.json"


def emit(payload: dict) -> None:
    print(json.dumps(payload))


async def main() -> None:
    base_payload = {
        "attempted": True,
        "server": "official-fivetran-mcp",
        "transport": "stdio",
        "tool": "get_connection_details",
        "allowWrites": False,
        "connectionId": CONNECTION_ID,
        "schemaFile": SCHEMA_FILE,
    }

    if not SERVER_DIR.exists():
        emit(
            {
                **base_payload,
                "ok": False,
                "mode": "mcp_unavailable",
                "reason": f"Fivetran MCP server directory not found: {SERVER_DIR}",
            }
        )
        return

    server_py = SERVER_DIR / "server.py"
    if not server_py.exists():
        emit(
            {
                **base_payload,
                "ok": False,
                "mode": "mcp_unavailable",
                "reason": f"Fivetran MCP server.py not found: {server_py}",
            }
        )
        return

    missing = [
        name
        for name in ["FIVETRAN_API_KEY", "FIVETRAN_API_SECRET"]
        if not os.getenv(name)
    ]
    if missing:
        emit(
            {
                **base_payload,
                "ok": False,
                "mode": "mcp_credentials_missing",
                "reason": f"Missing environment variables: {missing}",
            }
        )
        return

    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except Exception as exc:
        emit(
            {
                **base_payload,
                "ok": False,
                "mode": "mcp_client_unavailable",
                "reason": f"Python MCP client unavailable: {exc}",
            }
        )
        return

    server_params = StdioServerParameters(
        command=sys.executable,
        args=["server.py"],
        cwd=str(SERVER_DIR),
        env={
            "FIVETRAN_API_KEY": os.environ["FIVETRAN_API_KEY"],
            "FIVETRAN_API_SECRET": os.environ["FIVETRAN_API_SECRET"],
            "FIVETRAN_ALLOW_WRITES": "false",
        },
    )

    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()

                result = await session.call_tool(
                    "get_connection_details",
                    {
                        "schema_file": SCHEMA_FILE,
                        "connection_id": CONNECTION_ID,
                    },
                )

                parsed_payload = None
                raw_text = ""

                for content in result.content:
                    text = getattr(content, "text", None)
                    if not text:
                        continue

                    raw_text = text

                    try:
                        parsed_payload = json.loads(text)
                    except Exception:
                        parsed_payload = None

                    break

                if not parsed_payload:
                    emit(
                        {
                            **base_payload,
                            "ok": False,
                            "mode": "mcp_tool_error",
                            "reason": raw_text[:500]
                            if raw_text
                            else "MCP tool returned no text content.",
                        }
                    )
                    return

                data = parsed_payload.get("data", {})
                emit(
                    {
                        **base_payload,
                        "ok": True,
                        "mode": "mcp_live",
                        "data": {
                            "id": data.get("id", CONNECTION_ID),
                            "service": data.get("service", "google_sheets"),
                            "schema": data.get(
                                "schema", "pipeline_rescue.sales_orders"
                            ),
                            "paused": data.get("paused", False),
                            "status": data.get("status", {}),
                        },
                    }
                )
    except Exception as exc:
        emit(
            {
                **base_payload,
                "ok": False,
                "mode": "mcp_runtime_error",
                "reason": str(exc)[:500],
            }
        )


if __name__ == "__main__":
    asyncio.run(main())
