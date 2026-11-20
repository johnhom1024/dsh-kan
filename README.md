# dsh-kan

Read-only Kan boards inside DeepSeek Harness, with a small read-only tool set for the agent.

The page adds a **Kan** entry to the left sidebar. It walks workspace → boards → board (one column per list) → read-only card detail. Manual refresh, loading, error and empty states; it never picks a workspace for you.

## What this version does

- Read-only page. No create, edit, move, delete, drag, comments, notifications or realtime sync.
- No polling. Data loads when you open the page, change level, or press Refresh.
- Four read-only agent tools: `kan_list_workspaces`, `kan_list_boards`, `kan_get_board`, `kan_get_card`. There is **no write tool and no MCP server**; nothing to filter and nothing that can fail open.
- The Kan API token stays on the Host. The browser never receives it.

## Requirements

- DeepSeek Harness 0.2.2-rc.3 Web client with `@deepseek-ai/dsh-client-ui-layout`, `@deepseek-ai/dsh-client-ui-sidebar`, `@deepseek-ai/dsh-client-locale`, `@deepseek-ai/dsh-host-webserver`, `@deepseek-ai/dsh-client-connection`.
- Node.js 18 or newer on the Host (global `fetch`, `AbortSignal`, streamed response bodies).
- A Kan server exposing `/api/v1` and an API token.

## Install

From a packed tarball:

```bash
npm pack                                  # dsh-kan-0.1.0.tgz
dsh plugin add /absolute/path/dsh-kan-0.1.0.tgz
```

From GitHub (after the repository is public):

```bash
dsh plugin add github:johnhom1024/dsh-kan
```

Or install the same package spec from the Plugin Manager page. Restart `dsh` after replacing an installed package.

## Configure

The bundle declares a `Config` schema, so the row is editable in the Plugin Manager and in the profile patch. Fields:

| Field | Default | Meaning |
|---|---|---|
| `baseUrl` | (empty) | Kan origin, e.g. `https://kan.example.com`. Query, fragment, and userinfo are refused; plain `http` is accepted only for a loopback host unless `allowInsecureHttp` is true. |
| `tokenRef` | `KAN_API_TOKEN` | Credential reference that holds the Kan API token. The Host resolves it per request through `ctx.credentials`, so a value stored in the credential file or exported by the launching environment both work. |
| `requestTimeoutMs` | `15000` | Per-request timeout (1000–120000 ms), covering the response body. |
| `maxResponseBytes` | `2000000` | Streaming byte cap; a larger body is cancelled, not truncated. |
| `allowInsecureHttp` | `false` | Permit a plain-http Kan origin on a non-loopback host. |
| `enableTools` | `true` | Register the four read-only agent tools. |

The page route is fixed at `/plugins/dsh-kan/api`; the client and the Host use the same constant so a route change cannot silently fall into the SPA fallback.

Store the token with `ctx.credentials` (the DSH credential store / `$DSH_HOME/.env`), never in the bundle patch or a client file.

## Security

- The Host adds `Authorization: Bearer <token>` and calls Kan itself. The token is not in the client bundle, a route response, client configuration, or `localStorage`.
- The page route is same-origin and calls `ctx.connection.admit(request)`; without that service it answers `503` instead of serving data. Only four fixed operations exist and every id is validated against `[A-Za-z0-9_-]{1,64}` — this is not a general API proxy.
- Responses are read as a byte-bounded stream and cancelled past `maxResponseBytes`; a per-request deadline also covers the body. Redirects are refused (`redirect: 'error'`) so the bearer token is never sent to another origin.
- Upstream error bodies are never echoed; a token appearing in a transport message is replaced with `[redacted]`.

## Permissions and limitations

- Default behaviour never modifies Kan data: the page and the tools only issue `GET`.
- A full-access API token stays full access. This plugin only exposes read endpoints.
- Only fields the API returns are shown; a response whose shape does not match the expected schema fails loudly (`unexpected-shape`) instead of rendering an empty board.
- An empty workspace or board list is an empty state, not an error, and may also mean the token lacks access.

## Development

```bash
node --test test/*.test.js
npm pack --dry-run
```

Tests use a fake `fetch`; they never contact a real Kan server and never read a real token.

## License

MIT for this plugin. Third-party notices in `NOTICE`.
