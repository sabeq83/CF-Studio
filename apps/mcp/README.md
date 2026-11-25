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

HTTP endpoint: `/mcp`, authenticated using either `Authorization: Bearer <CF_STUDIO_MCP_BEARER_TOKEN>` (server-default token) or per-operator `Authorization: Bearer <cfop_...>` (scoped & tenant-allowlisted via `operator_credentials` and managed in `/settings/mcp-access`). `/health` checks adapter status (`{"status":"ok","service":"cf-studio-mcp"}`).

> **Remote Security Isolation:** When served over HTTP (`isRemoteHttp: true`), host filesystem inputs (`file_path` on `cf_upload_reference_asset` and `photo_file_path` on `cf_add_product` / `cf_upload_product_photo`) are rejected with `VALIDATION_ERROR`; remote clients must pass `image_base64` / `photo_base64` or `photo_url`.

---

## 3. Registered Tools Catalog (62 Tools across 7 Studio Pillars)

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
- `cf_create_recipe_labs_post`: 🖼️ Recipe Labs Social Post: Facebook recipe article + 3-6 AI composite grid images (1:1, 3:4, or 9:16 layout) across 4 commercial photography environments.
- `cf_submit_custom_storyboard`: 🎬 Submit a pre-crafted custom storyboard from Claude, ChatGPT, or external AI directly into the physical rendering queue (TTS, Veo video, FFmpeg assembly).
- `cf_run_auto_pipeline`: ⚡ Universal master runner supporting all 6 pipeline types dynamically.
- `cf_create_campaign` / `makna_create_campaign`: Strategic product campaign creation via Operator API v1.

### C. Authoritative Recipe Importer & Curated Library
- `cf_import_recipe_batch`: 🍲 Import and curate up to 50 recipe URLs sequentially with Schema.org JSON-LD extraction, 100% frozen ingredients guardrail, randomized 10-20s human-behavior delay, and AI Magic Polish.
- `cf_list_curated_recipes`: 📚 List curated authoritative recipes stored in the database with ingredients and polish status.

### D. Schedule Management
- `cf_list_schedules`: List recurring or `specific_date` Auto Pipeline schedules (with optional `target_date` and `publish_date` filters) and execution metrics.
- `cf_create_schedule`: Create single or batch Auto Pipeline schedules with separate production (`target_date`/`generation_date` + `generation_time`) and publishing (`publish_date` / `publish_day_offset` + `publish_time`) cadence, target Repliz publishing accounts, recipe toggle, Shopee affiliate link, and blueprint UUID.
- `cf_update_schedule`: Update an existing Auto Pipeline schedule (modify production/publish dates, `publish_day_offset`, times, preset, accounts, toggles, or status).
- `cf_toggle_schedule_pause`: Pause or resume an active Auto Pipeline schedule.
- `cf_delete_schedule`: Permanently delete an Auto Pipeline schedule.
- `cf_trigger_schedule_now`: Immediately trigger an execution run for an existing schedule.

### D. Pillar 1: Product Database & Knowledge Catalog (Data Engine)
- `cf_add_product`: Register a new product into the tenant catalog (manual/spec). If `source_url` matches a not-yet-promoted Radar Produk candidate it is blocked with `RADAR_CANDIDATE_EXISTS` (use `cf_submit_radar_candidates`); pass `bypass_radar_check=true` to add manually anyway. Manual input without `source_url` is unchanged.
- `cf_list_radar_candidates` / `cf_get_radar_candidate` / `cf_get_radar_status`: read Radar Produk research candidates (scope `product_research:read`).
- `cf_submit_radar_candidates`: promote candidates through the same atomic service as the web UI (default `preview`; `execute` needs scope `product_research:mcp_promote`).
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
- `cf_start_deconstruct`: Start AI deconstruction (download, Gemini video analysis, blueprint extraction) for ingested assets with status `saved` or `failed` (max 50 per call; **uses Gemini quota** — avoid mass runs).
- `cf_list_deconstructed_assets`: Search finished deconstructed viral video blueprints.
- `cf_search_blueprints`: Search viral blueprints by Facebook Reel URL, TikTok URL, UUID, or keyword to bind to schedules.
- `cf_get_deconstructed_blueprint`: Get detailed viral pattern breakdown and storyboard of a deconstructed asset.

### H. Pillar 5: Creative Review & Human-in-the-Loop Co-Pilot
- `cf_get_job_review`: Get human-in-the-loop review artifact (script and storyboard) for a pending job.
- `cf_approve_job`: Approve pending campaign review items (`ocj_*`, `cst_*`, `opc_*`, and Multiplier `mul_*`) to proceed to production rendering.

### I. Pillar 6: Omnichannel Social Publishing
- `cf_list_publishing_accounts`: List connected social media publishing accounts (Meta, Repliz, etc.).
- `cf_create_publishing_job`: Schedule or publish completed content to a social account.
- `cf_list_publishing_jobs`: Monitor social media publishing job statuses (including `scheduled` and `needs_review`) and view live links.
- `cf_retry_multiplier_task`: Retry a failed (or stuck in-progress with `force: true`) Multiplier task using `smart_resume`, `restart_all`, or explicit `stage`.

### J. Pillar 7: Studio Observability & Cluster Health
- `cf_get_cluster_health`: Check real-time health of the 3-node cluster, services, API keys, and queue tasks.
- `cf_get_studio_stats`: Get overview metrics on content production, stock availability, and publishing counts.

### J2. Brand Profiles & Per-Brand Telegram Topic Notifications
- `cf_list_brand_profiles` / `cf_get_brand_profile` / `cf_create_brand_profile` / `cf_update_brand_profile`: Manage Brand Profile identity, tone, storage, and finishing defaults.
- `cf_get_brand_notification_settings` *(readOnly)*: Get Telegram Forum Topic notification settings for a brand profile and tenant bot readiness.
- `cf_update_brand_notification_settings`: Update brand Telegram `enabled`, `message_thread_id`, optional `chat_id` override, `events`, quiet hours, and `timezone`.
- `cf_test_brand_notification`: Enqueue a test Telegram message to the configured Forum Topic of a brand profile.

### K. Universe Manager & Character Lock Reference Assets
- `cf_list_universes` *(readOnly, scope `content:read`)*: List active Universe profiles in the current tenant (compact summary).
- `cf_get_universe` *(readOnly, scope `content:read`)*: Get Universe details, characters, locations, and approved reference asset summary per character.
- `cf_create_universe_character` *(scope `content:create`)*: Create a character in a Universe (`character_key` `/^[a-z0-9_]{2,64}$/`, supports `expected_tenant_id`).
- `cf_update_universe_character` *(scope `content:create`)*: Update character attributes with optional `expected_updated_at` concurrency check (`expected_tenant_id` supported).
- `cf_list_reference_assets` *(readOnly, scope `content:read`)*: List managed reference assets with absolute `preview_url` (no base64 payload).
- `cf_upload_reference_asset` *(scope `content:create`)*: Upload a draft reference image via `image_base64` or local MCP-host `file_path` (`.png/.jpg/.jpeg/.webp`, ≤10 MB, SHA-256 deduplicated; `photo_url` unsupported in MVP).
- `cf_approve_reference_asset` *(scope `content:approve`)*: Approve a reviewed draft asset (requires `expected_sha256`, idempotent, transactional `FOR UPDATE`, auto-invalidates manifest cache).
- `cf_reject_reference_asset` *(scope `content:approve`)*: Reject a draft asset with required `reason` without disturbing the approved version.
- `cf_link_visual_identity_universe` *(scope `content:approve`)*: Merge only `subject.universe_profile_id/universe_slug/character_keys/character_lock_mode` on a Visual Identity (defaults to `dry_run: true`, returns before/after diff & active schedule warnings without editing schedules).
- `cf_preflight_character_lock` *(readOnly, scope `content:read`)*: Prove end-to-end Character Lock readiness (`approved_asset`, disk file & SHA-256 verification, strict resolver check against `sample_prompt`).

#### Example Character Lock Workflow (Arka replacing Maya)
1. `cf_switch_tenant` (`tnt_pt-gim-sosmed_62d0d9`) → `cf_list_universes` → `cf_get_universe` (Ruang Akustik ID).
2. `cf_create_universe_character` with `character_key: "arka_acoustic_consultant"` and `expected_tenant_id`.
3. `cf_upload_reference_asset` (`owner_type: "character"`, `role: "identity"`, clean single-character anchor via `file_path` or `image_base64`) → review `preview_url` and `sha256`.
4. After explicit human review, `cf_approve_reference_asset` with `expected_sha256`.
5. `cf_link_visual_identity_universe` (`dry_run: true`) → inspect diff → apply with `dry_run: false`, `character_lock_mode: "strict"`.
6. `cf_preflight_character_lock` (`mode: "required"`, `sample_prompt: "Maya explains acoustic panels"`) → confirm `status: "ready"`, `blocking: false`, and only Arka's `approved_asset` in `resolved_assets`.

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
