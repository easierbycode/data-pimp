# thirsty-samples MCP server

A thin [MCP](https://modelcontextprotocol.io) stdio server that exposes
data-pimp's sample-lifecycle HTTP API as tools. It holds no Graylog/Postgres
logic of its own — every tool calls data-pimp (default `https://thirsty.store`),
which writes inventory truth to Postgres **and** an analytics event to Graylog
(see [`core/lifecycle.ts`](../../core/lifecycle.ts)).

Paired with the [`sample-lifecycle`](../../.claude/skills/sample-lifecycle/SKILL.md)
skill, which documents how to drive these tools (status updates + sold-with-
creator-attribution) and how to read the revenue back via the `graylog-query`
skill.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_samples` | Find a sample by name/brand/productId → resolve its `id`. |
| `list_sample_statuses` | The synced status vocabulary (validate before writing). |
| `list_creators` | Creator handles seen live in Graylog (attribution list). |
| `update_sample_status` | Set a sample's status (rejects `sold`). |
| `mark_sample_sold` | Mark sold + attribute resale revenue to a creator. |

## Run

Registered for Claude Code via [`.mcp.json`](../../.mcp.json) at the repo root:

```json
{
  "mcpServers": {
    "thirsty-samples": {
      "command": "deno",
      "args": ["run", "-A", "mcp/thirsty-samples/server.ts"],
      "env": { "THIRSTY_API_URL": "https://thirsty.store" }
    }
  }
}
```

Runs on Deno (the repo runtime) — no `npm install` or build step; Deno fetches
the SDK from the pinned `npm:@modelcontextprotocol/sdk@1.29.0` specifier on first
run. Point `THIRSTY_API_URL` at a local data-pimp (`http://localhost:8000`) to
test against a dev DB/Graylog instead of production.

Smoke-test the handshake without a client:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | deno run -A mcp/thirsty-samples/server.ts
```
