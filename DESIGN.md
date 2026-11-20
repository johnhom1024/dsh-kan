# dsh-kan — design (first version)

Status: first version skeleton. No install, no push, no profile change in this round.

## Goal

Show Kan content inside DeepSeek Harness as a native page, and optionally give the agent Kan tools.

Scope of this version:

- Entry in the left sidebar → workspace picker → boards → board page with one column per list → read-only card detail (title, description, labels, assignees, due date when present).
- Manual refresh, loading / error / empty states. No auto-picked workspace, no full polling, no drag, no create/edit/delete, no notifications.
- The page is read-only. Tools are optional (see "Tools" below).

Out of scope for v1: writes from the UI, realtime sync, connectors/phone/computer/browser, card activities, search.

## Architecture

```
Browser (client.js)                 Host (index.js)                     Kan server
  React page in `main` slot  --HTTP-->  GET /plugins/dsh-kan/api?op=...  --HTTPS-->  /api/v1/...
  sidebar.panellist entry               checks browser auth via           Bearer token
                                        ctx.connection.admit(request)     (host only)
                                        reads token from env/credentials
```

- The browser never sees the API token. The Host is the only place that calls the Kan API and adds `Authorization: Bearer ...`.
- One credential source: `DSH_KAN_API_TOKEN` (environment / `$DSH_HOME/.env`) is read by both the Host route and, when tools are enabled, the stdio MCP child. No token in client config, RPC payloads, or `localStorage`.
- URL comes from `DSH_KAN_BASE_URL` (or the bundle's `baseUrl` config); nothing hardcodes a personal domain.
- Data path is a same-origin `GET` route on `ctx.webServer`, gated by `ctx.connection.admit(request)` (browser/API authentication). No iframe, no separate server, no root replacement.

## Files

| File | Role |
|---|---|
| `package.json` | package `dsh-kan`, `dsh.bundle.patch`, `dsh.client` |
| `cordis.patch.yml` | inserts the Host row (+ optional MCP row, see below) |
| `index.js` | Host plugin: config, token, route registration |
| `client.js` | Client module: `sidebar.panellist` entry + `main` page |
| `lib/config.js` | pure config normalization/validation |
| `lib/kan-api.js` | fetch wrapper, byte cap, token redaction |
| `lib/http.js` | request handler for the route |
| `lib/map.js` | tolerant field mapping (only present fields) |
| `lib/tool-policy.js` | Kan tool names, read-only allowlist, write deny mask |
| `locale/en.json`, `locale/zh.json` | metadata + UI strings |
| `docs/DETAIL.md`, `docs/preview.svg` | bundle detail page (one image) |
| `icon.svg` | original icon |
| `README.md`, `LICENSE`, `NOTICE` | install/config/security + MIT + third-party notice |
| `test/*.test.js` | fake-fetch API tests, config, redaction, tool policy |

## Tools (optional)

The official `@kan.bn/mcp@0.1.0` (stdio, `KAN_BASE_URL` / `KAN_API_TOKEN`) exposes ~46 tools, many of them writes (`create_*`, `update_*`, `delete_*`, `invite_member`, …). `@deepseek-ai/dsh-mcp-client` has **no tool allowlist**. DSH does offer `ctx.tools.restrict()` as a per-agent mask, but its filter shape is not documented in the installed README.

Therefore, in this version:

- The bundle's default patch enables the **page only**. The MCP row is supplied as an opt-in snippet in `README.md`; enabling it is a user decision.
- When enabled, the Host plugin applies a **deny mask** for the known write tools through `ctx.tools.restrict` if that API is available; otherwise it logs a clear warning. The deny list is data in `lib/tool-policy.js` and is unit-tested. The README states plainly that without the mask the agent sees every upstream tool.

## Compatibility evidence (from the installed DSH)

- Page surface: `main` is the root-scoped keyed panel slot; `ctx.layout.selectPanel(id)` selects a registered panel (`@deepseek-ai/dsh-client-ui-layout` README §"Use this package"). Sidebar entry goes in `sidebar.panellist`; entry `id` must equal the `main` key.
- Client module shape and slot API: `templates/decoration/client.js` (`ctx.slots.inject` + `ctx.slots.register`), `references/ui-plugin.md`.
- Route registration: `ctx.webServer.register({ path, exact, resource })` returns a disposer (`@deepseek-ai/dsh-host-webserver` README §"Registering routes").
- Browser auth: `ctx.connection.admit(request)` returns a live Peer or a rejection (`@deepseek-ai/dsh-client-connection` README §"Browser authentication and request trust").
- Credentials: `ctx.credentials` (ref/record API); never returns the value through `describe` (`@deepseek-ai/dsh-credentials-local` README).
- MCP config: `serverName`, `transport: stdio`, `command`, `args`, `env`, `failOnStartupError` (`@deepseek-ai/dsh-mcp-client` README §"Minimal configuration"); ambient env names matching `KEY|PASSWORD|SECRET|TOKEN` are scrubbed, so `KAN_API_TOKEN` must be passed explicitly in `env`.

## To verify before wiring live data

1. Exact `ctx.slots.register` options for `main` (key name) — read from a working panel plugin or `Slots.listSubTree` at implementation time.
2. `ctx.connection.admit` return shape (Peer vs rejection) for the exact 401/403 mapping.
3. `ctx.tools.restrict` filter shape (allow/deny object) before relying on the deny mask.
4. Exact Kan response field names for workspace/board/card, confirmed against a live API response; the mapper only reads present fields and never fabricates.

## Verification in this round

- `node --test` on pure modules with a fake fetch; no network, no real token.
- `npm pack --dry-run` file list check; no install, no push.

## Contract evidence (installed DSH 0.2.2-rc.3 source)

| Decision | Evidence |
|---|---|
| `main` is a root-scoped **keyed** slot; a sidebar entry id addresses its key | `@deepseek-ai/dsh-client-ui-layout/src/client/index.ts:71-75` (`'main': { kind: 'keyed'; scope: 'root' }`) |
| `sidebar.panellist` accepts `id`, optional `order`, and a string or locale-aware `label`; the same id selects the `main` entry | `@deepseek-ai/dsh-client-ui-sidebar/README.md:42` |
| Client locale is a service: register a namespace dictionary, bind a translator | `@deepseek-ai/dsh-client-ui-layout/src/client/index.ts:163-164`; `@deepseek-ai/dsh-client-locale/README.md:40` |
| `ctx.locale.register(ns, { zh, en })` and `ctx.locale.bind(ns)` are the real API (not invented) | same layout source lines: `ctx.locale.register('shortcuts.layout', {…})`, `ctx.locale.bind('shortcuts.layout')` |
| Theme tokens are real `--dsw-alias-*` names in the shipped sheet | `@deepseek-ai/dsh-client-ui-theme/src/styles/design-platform.css` — `--dsw-alias-bg-base` (:325), `--dsw-alias-bg-layer-1/2/3` (:333-335), `--dsw-alias-border-l1/l2/l3` (:346-350), `--dsw-alias-card-fill` (:372), `--dsw-alias-label-primary/secondary/tertiary` (:411-414), `--dsw-alias-label-caption` (:402) |
| `ctx.tools.restrict({allow?,deny?})` is **scoped only** (agent.ctx), rejects empty filters and unknown names | `@deepseek-ai/dsh-tools/src/index.ts:162-189` — throws when unscoped, when both empty, and when a name is unknown |
| Tool registration uses `defineTool` + `ctx.tools.register` under the plugin's effect | `@deepseek-ai/dsh-tools/src/index.ts:150-153`; README §Register a tool |
| Credentials resolve per operation from refs, never exposing the value to config UIs | `@deepseek-ai/dsh-credentials/src/index.ts:184` (`resolve(ref): Promise<ResolvedCredential|undefined>`) |
| Web routes may give a Fetch `Request -> Response` resource; only GET/HEAD reach it | `@deepseek-ai/dsh-host-webserver/src/index.ts:675-703` |
| Config schema is `schemastery` (`import z from '@deepseek-ai/schemastery'`) | `@deepseek-ai/dsh-host-webserver/src/index.ts:20`; `@deepseek-ai/dsh-tools/package.json:57` pins `~3.19.0` |
| Browser request trust is a Host/Origin fence, not identity | `@deepseek-ai/dsh-client-connection/src/api-request-trust.ts:1-13` |
| `ctx.connection.admit(request)` returns `PeerAdmission` = `{ peer }` or `{ rejection: 401\|403 }`; the service key is `connection` | `@deepseek-ai/dsh-client-connection/src/rpc-host.ts:122-137`, `:62-66`, `:92` |

### Decisions that follow

1. **No MCP server, no tool filtering.** `restrict` is scoped-only and throws on empty or unknown names (`dsh-tools/src/index.ts:162-189`), so a deny list computed from a different upstream version would either throw (fail-open if swallowed) or miss a write tool. Instead this plugin registers **four of its own GET-only tools** via `defineTool`; there is no write tool to filter and no fail-open path.
2. **`ctx.connection` is not injected.** The route calls `ctx.get('connection')` at request time and answers `503` when absent; it never assumes success. This avoids requiring the service to load the page plugin.
3. **`main`/locale options** are taken from the sources above, not guessed.
4. **Shapes**: `GET /workspaces` is a membership array (`@kan.bn/mcp@0.1.0 dist/tools/workspace.js:5-6` maps `memberships.map(m => m.workspace)`); board requires `lists[].cards[]`; card requires `publicId`+`title`. Anything else raises `unexpected-shape`.
5. **Config GUI**: the row declares `Config`, so Plugin Manager renders the fields; the token is a reference resolved through `ctx.credentials.resolve`, so no secret is stored in the patch.

### Still requires install-time verification (no permission yet)

- Rendered `Config` form and `main` panel visually (desktop + narrow), and the exact `sidebar.panellist` label rendering.
- The live Kan `/workspaces/:id/boards`, `/boards/:id`, `/cards/:id` field sets against the user's server.

## Search review (first pass) — applied in the next tree

1. `webServer.register` now passes the required `kind: 'exact'` (contract `dsh-host-webserver/src/index.ts:68-74`); previously `exact: true` was ignored and the route registered as a prefix.
2. `routePath` removed from `Config`, `normalizeConfig`, and the patch. The page route is the fixed constant `/plugins/dsh-kan/api` in both `index.js` and `client.js`; the SPA fallback can no longer turn a route typo into a silent empty list.
3. `locale/en.json`, `locale/zh.json` and `NOTICE` now describe four built-in read-only tools and state that no MCP server is used, fetched, or bundled.
4. One ID grammar (`lib/ids.js`) is shared by the HTTP route and the tool `execute` bodies; invalid IDs fail the tool instead of reaching the API.
5. `package.json` declares peer dependencies on `@deepseek-ai/dsh-tools` and `@deepseek-ai/dsh-credentials`.
6. `enableTools` (and `allowInsecureHttp`) are normalized in `lib/config.js`, including string `"false"`.
7. Route errors return a stable code plus a fixed message; the detailed reason is logged on the Host only.

## Second review pass (seven-findings-consolidate-latest)

- Client response contract: `client.js` now parses the body strictly (`parseResponse`). A 200 HTML/broken-JSON reply raises `invalid-json`; a non-object raises `invalid-body`; a missing op key raises `missing-<key>`; only a real empty array is an empty state. The same function is exposed on the module as `__test.parseResponse` so the test exercises production code.
- Browser and log error surfaces: `lib/http.js` keeps a fixed code allowlist (`KNOWN_CODES`); any other `error.code` (including a credentials exception code that embeds a value) is reduced to `kan-error`. The log line is `dsh-kan: request failed (<code>)` only — no message, no stack.
- Route registration moved into `lib/register.js` (`registerKanRoute` / `registerKanTools`) so `index.js` and `test/register.test.js` use one implementation; the test asserts `kind:'exact'`, the fixed path, and the four tool names.
- `handleKanResource` no longer takes the unused `cfg` argument.
- New tests: strict client parsing, registration contract, metadata/NOTICE truthfulness, unknown-code reduction, log/wire leak checks.
