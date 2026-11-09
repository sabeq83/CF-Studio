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

## 3. Registered Tools Catalog (46 Tools across 7 Studio Pillars)

### A. Discovery, Identity & Status
- `cf_whoami`: Read configured CF Studio operator identity, tenant, and scopes. (Legacy alias: `makna_whoami`)
- `cf_list_presets`: List available video archetypes and campaign production presets. (Legacy alias: `makna_list_presets`)
- `cf_search_catalog`: Search brands, catalog products, and compatible presets. (Legacy alias: `makna_search_catalog`)
- `cf_get_job_status`: Read campaign status, progress, video download URL, and social media captions. (Legacy alias: `makna_get_campaign_status`)

### B. Auto Pipeline (6 Dedicated Engines + Master Runner)
- `cf_create_product_video`: 🛍️ 1-Click Product Video from catalog products with CEP triggers and unboxing.
- `cf_create_editorial_video`: 📖 1-Click Editorial Video from brand narrative pillars and educational storytelling.
- `cf_create_recipe_video`: 🍳 1-Click Recipe Food Reels (4-part structure, appetizing hook, voiceover, and structured recipe caption).
- `cf_create_multiplier_video`: 🔀 1-Click Multiplier Video remixed from a viral deconstruction blueprint.
- `cf_create_recipe_labs_post`: 🖼️ Recipe Labs Social Post: Facebook recipe article + 4 AI composite grid images (no video rendering).
- `cf_submit_custom_storyboard`: 🎬 Submit a pre-crafted custom storyboard from Claude, ChatGPT, or external AI directly into the physical rendering queue (TTS, Veo video, FFmpeg assembly).
- `cf_run_auto_pipeline`: ⚡ Universal master runner supporting all 6 pipeline types dynamically.
- `cf_create_campaign` / `makna_create_campaign`: Strategic product campaign creation via Operator API v1.

### C. Authoritative Recipe Importer & Curated Library
- `cf_import_recipe_batch`: 🍲 Import and curate up to 50 recipe URLs sequentially with Schema.org JSON-LD extraction, 100% frozen ingredients guardrail, randomized 10-20s human-behavior delay, and AI Magic Polish.
- `cf_list_curated_recipes`: 📚 List curated authoritative recipes stored in the database with ingredients and polish status.

### D. Schedule Management
- `cf_list_schedules`: List recurring Auto Pipeline schedules and execution metrics.
- `cf_create_schedule`: Create a new automated recurring schedule with target Repliz publishing accounts, recipe toggle, Shopee affiliate link, and blueprint UUID.
- `cf_update_schedule`: Update an existing recurring Auto Pipeline schedule (modify times, preset, accounts, toggles, or status).
- `cf_toggle_schedule_pause`: Pause or resume an active Auto Pipeline schedule.
- `cf_delete_schedule`: Permanently delete an Auto Pipeline schedule.
- `cf_trigger_schedule_now`: Immediately trigger an execution run for an existing schedule.

### D. Pillar 1: Product Database & Knowledge Catalog (Data Engine)
- `cf_add_product`: Register a new product into the tenant catalog (manual/spec).
- `cf_enrich_product`: Trigger AI enrichment for product USP, truths, and clean photo prompt.
- `cf_get_product_detail`: Retrieve full product details, status, truths, and extraction metadata.
- `cf_update_product`: Update existing product information in the catalog.
- `cf_scrape_product_url`: Scrape product specifications and images from an e-commerce or product URL.

### E. Pillar 2: Creative & Visual Identity Studio (Visual DNA Engine)
- `cf_generate_visual_identity`: Generate an AI Visual Identity draft from a creative brief.
- `cf_create_visual_identity`: Register a structured Visual Identity preset in the tenant.
- `cf_list_visual_identities`: List available active Visual Identity presets (system & tenant custom).
- `cf_get_visual_identity`: Get detailed configuration of a Visual Identity preset.
- `cf_update_visual_identity`: Update an existing custom Visual Identity preset.

### F. Pillar 3: Production Presets & Campaign Archetypes (Strategy Engine)
- `cf_get_preset_detail`: Get full strategy configuration of an operator preset.
- `cf_create_preset`: Create a new custom operator preset.
- `cf_clone_preset`: Clone an existing preset with strategic modifications.
- `cf_update_preset`: Update an existing custom operator preset.

### G. Pillar 4: Viral Research & Multiplier Lab (Deconstruction Engine)
- `cf_ingest_viral_video`: Ingest viral video URL into Deconstruct Lab for AI pattern extraction.
- `cf_list_deconstructed_assets`: Search finished deconstructed viral video blueprints.
- `cf_search_blueprints`: Search viral blueprints by Facebook Reel URL, TikTok URL, UUID, or keyword to bind to schedules.
- `cf_get_deconstructed_blueprint`: Get detailed viral pattern breakdown and storyboard of a deconstructed asset.

### H. Pillar 5: Creative Review & Human-in-the-Loop Co-Pilot
- `cf_get_job_review`: Get human-in-the-loop review artifact (script and storyboard) for a pending job.
- `cf_approve_job`: Approve pending campaign review items to proceed to production rendering.

### I. Pillar 6: Omnichannel Social Publishing
- `cf_list_publishing_accounts`: List connected social media publishing accounts (Meta, Repliz, etc.).
- `cf_create_publishing_job`: Schedule or publish completed content to a social account.
- `cf_list_publishing_jobs`: Monitor social media publishing job statuses and view live links.

### J. Pillar 7: Studio Observability & Cluster Health
- `cf_get_cluster_health`: Check real-time health of the 3-node cluster, services, API keys, and queue tasks.
- `cf_get_studio_stats`: Get overview metrics on content production, stock availability, and publishing counts.

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
