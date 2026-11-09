# CF Studio MCP Server

Model Context Protocol (MCP) adapter for the CF Studio Headless Operator and Auto Pipeline. Built with the official MCP SDK, supporting both local `stdio` (Antigravity IDE, Claude Desktop) and Streamable HTTP (remote agents, ChatGPT Custom GPTs / Open WebUI).

---

## 1. Quick Start

From the repository root:

```sh
npm ci --prefix apps/mcp
npm run mcp
# Or run with local stdio for Claude Desktop / Antigravity:
npm run mcp:stdio
```

---

## 2. Environment Configuration

Supply environment variables through your process manager, `.env.local`, or secret store:

| Variable | Fallback Variable | Purpose & Default |
| :--- | :--- | :--- |
| `CF_STUDIO_OPERATOR_BASE_URL` | `MAKNA_OPERATOR_BASE_URL` | CF Studio API origin; default `http://127.0.0.1:5010`. Remote URLs require HTTPS. |
| `CF_STUDIO_OPERATOR_API_TOKEN` | `MAKNA_OPERATOR_API_TOKEN` | Operator credential bound to ONE tenant. Required. |
| `CF_STUDIO_MCP_BEARER_TOKEN` | `MAKNA_MCP_BEARER_TOKEN` | Separate MCP access secret, at least 32 characters. Required for HTTP mode. |
| `CF_STUDIO_MCP_HOST` | `MAKNA_MCP_HOST` | Bind address, default `127.0.0.1`. |
| `CF_STUDIO_MCP_PORT` | `MAKNA_MCP_PORT` | Port, default `7030`. |
| `CF_STUDIO_MCP_ALLOWED_HOSTS` | `MAKNA_MCP_ALLOWED_HOSTS` | Comma-separated accepted hostnames. Default `127.0.0.1,localhost`. |
| `CF_STUDIO_MCP_ALLOWED_ORIGINS` | `MAKNA_MCP_ALLOWED_ORIGINS` | Optional comma-separated browser origins for CORS protection. |

HTTP endpoint: `/mcp`, authenticated using `Authorization: Bearer <CF_STUDIO_MCP_BEARER_TOKEN>`. `/health` checks adapter status (`{"status":"ok","service":"cf-studio-mcp"}`).

---

## 3. Registered Tools Catalog

### A. Discovery & Status
- `cf_whoami`: Read configured CF Studio operator identity, tenant, and scopes. (Legacy alias: `makna_whoami`)
- `cf_list_presets`: List available video archetypes and campaign production presets. (Legacy alias: `makna_list_presets`)
- `cf_search_catalog`: Search brands, catalog products, and compatible presets. (Legacy alias: `makna_search_catalog`)
- `cf_get_job_status`: Read campaign status, progress, video download URL, and social media captions. (Legacy alias: `makna_get_campaign_status`)

### B. Auto Pipeline (5 Dedicated Engines + Master Runner)
- `cf_create_product_video`: 🛍️ 1-Click Product Video from catalog products with CEP triggers and unboxing.
- `cf_create_editorial_video`: 📖 1-Click Editorial Video from brand narrative pillars and educational storytelling.
- `cf_create_recipe_video`: 🍳 1-Click Recipe Food Reels (4-part structure, appetizing hook, voiceover, and structured recipe caption).
- `cf_create_multiplier_video`: 🔀 1-Click Multiplier Video remixed from a viral deconstruction blueprint.
- `cf_create_recipe_labs_post`: 🖼️ Recipe Labs Social Post: Facebook recipe article + 4 AI composite grid images (no video rendering).
- `cf_run_auto_pipeline`: ⚡ Universal master runner supporting all 5 pipeline types dynamically.
- `cf_create_campaign` / `makna_create_campaign`: Strategic product campaign creation via Operator API v1.

### C. Schedule Management
- `cf_list_schedules`: List recurring Auto Pipeline schedules and execution metrics.
- `cf_create_schedule`: Create a new automated recurring schedule (e.g. daily/weekly cron).
- `cf_trigger_schedule_now`: Immediately trigger an execution run for an existing schedule.

---

## 4. Local Client Configuration

### Antigravity IDE & Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "cf-studio": {
      "command": "node",
      "args": ["/Users/sabeqmmursyid/_cfstudio/apps/mcp/server.mjs", "--stdio"],
      "env": {
        "CF_STUDIO_OPERATOR_BASE_URL": "http://100.95.245.55:7010",
        "CF_STUDIO_OPERATOR_API_TOKEN": "CF_STUDIO_SAMPLE_OPERATOR_TOKEN_123456"
      }
    }
  }
}
```

---

## 5. Verification

Run the test suite:

```sh
npm run test:mcp
```
