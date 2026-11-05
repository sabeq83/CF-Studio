# MAKNA Flow MCP

MCP adapter for the existing tenant-scoped Operator API. Uses the official MCP SDK,
Streamable HTTP or stdio. No database migration or UI change. The existing worker
must be running to process jobs. Strategic generation remains in the existing
single-pass engine; this service does not call Gemini directly.

## Install and run

From the repository root:

```sh
npm ci --prefix apps/mcp
npm run mcp
# Local process-based clients:
npm run mcp:stdio
```

Supply environment variables through your process manager or secret store:

| Variable | Purpose |
| --- | --- |
| `MAKNA_OPERATOR_BASE_URL` | Operator API origin; default `http://127.0.0.1:5010`. Remote URLs require HTTPS. |
| `MAKNA_OPERATOR_API_TOKEN` | Existing operator credential bound to ONE tenant. Required. |
| `MAKNA_MCP_BEARER_TOKEN` | Separate MCP access secret, at least 32 characters. Required for HTTP. |
| `MAKNA_MCP_HOST` | Bind address, default `127.0.0.1`. |
| `MAKNA_MCP_PORT` | Default `7030`. |
| `MAKNA_MCP_ALLOWED_HOSTS` | Comma-separated accepted hostnames. Default `127.0.0.1,localhost`. Include the external hostname behind a proxy. |
| `MAKNA_MCP_ALLOWED_ORIGINS` | Optional comma-separated browser origins. All supplied Origin headers are rejected unless listed. |

HTTP endpoint: `/mcp`, authenticated using `Authorization: Bearer` with the MCP
secret. `/health` checks the adapter process only, not the database or worker.
Health and tool responses are not cached. GET/SSE and DELETE sessions are not used
by this stateless JSON transport. Do not place secrets in URLs, config committed to
Git, or tool arguments. stdio writes diagnostics only to stderr.

## Tools and permissions

| Tool | Operator scope |
| --- | --- |
| `makna_whoami` | Valid operator credential |
| `makna_list_presets` | `content:read` |
| `makna_search_catalog` | `automation:read` |
| `makna_create_campaign` | `content:create` |
| `makna_get_campaign_status` | `content:read` |

Creation accepts product name, factual description, audience, goal, platform,
planner count (6/12/18/24/30), and a caller-provided `idempotency_key`. Defaults to
six planner ideas, selects `best_one`, and pauses at the creative approval stage.
The existing workflow may prepare work before that checkpoint. AI credits are
consumed. It does not expose approval, rendering, or publishing tools.

Retry a timeout with the SAME key and identical brief; never invent a new key for
an uncertain outcome. The backend rejects reuse of a key with a different body.
Status uses the returned `job_id`. Validation and scope checks remain authoritative
in the Operator API. Catalog results currently include names/IDs, so obtain product
descriptions from the user rather than inventing claims.

## Local client

Configure a process-based MCP client to run `node` with the absolute path to
`apps/mcp/server.mjs` and argument `--stdio`. Pass Operator environment variables
via the client's secret configuration. Do not use `npm` as the stdio command,
because its banner can interfere with the protocol.

## Connecting ChatGPT

This implementation is a single-tenant operator adapter, with a separate static
MCP bearer credential. It is immediately testable with bearer-capable MCP clients
and stdio clients. It does NOT implement OAuth login, OAuth discovery, per-user
account linking, or public hosting; it is not yet a turnkey ChatGPT connection.

Before enabling ChatGPT access, configure a supported private connection or HTTPS
endpoint and an OAuth gateway appropriate to the account/workspace. The gateway
must validate token issuer, signature, expiry, audience, and scopes, strip incoming
credentials, and inject the adapter's MCP credential only after authorization.
Use a dedicated adapter and operator credential per tenant. Never allow arbitrary
users through a gateway sharing a privileged operator credential. Do not pass
ChatGPT access tokens through to the Operator API. Multi-tenant self-service login
requires a separate identity integration before deployment.

Official references:
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/plugins/build/auth
- https://ts.sdk.modelcontextprotocol.io/server

No production deployment is performed by this package.

## Verification

```sh
npm run test:mcp
```

Tests use mock Operator responses and real SDK clients over in-memory and HTTP
transports. They do not create real campaigns, consume AI credits, or verify a
live ChatGPT account connection.
