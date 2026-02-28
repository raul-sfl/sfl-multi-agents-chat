# sfl-multi-agents-chat

GTM-injectable chat widget for Stayforlong customer support. Zero-dependency, Shadow DOM isolated, connects to `sfl-multi-agents-adk` via WebSocket.

## Files

```
sfl-multi-agents-chat/
├── sfl-chat-widget.js   # The widget — load this from GTM or a CDN
└── demo.html            # Local dev demo page
```

## GTM injection

Add a **Custom HTML tag** with trigger **All Pages**:

```html
<script>
  window.StayforlongChat = {
    wsUrl:       'wss://your-backend.com/ws',
    accentColor: '#f60e5f',
    lang:        'es',   // optional — omit to auto-detect from browser language

    // Optional: forward GTM / dataLayer variables as WebSocket query params.
    // GTM evaluates the {{Variable}} syntax before the tag fires.
    // Unresolved GTM placeholders (e.g. still "{{User ID}}") are ignored automatically.
    contextVars: {
      user_id:    '{{User ID}}',
      booking_id: '{{Booking ID}}',
    },
  };
</script>
<script src="https://your-cdn.com/sfl-chat-widget.js"></script>
```

### `contextVars` — passing data from the page to the agent

Any key/value in `contextVars` is appended as a query param to the WebSocket URL when the widget connects, e.g.:

```
wss://backend.com/ws?lang=es&user_id=u_123&booking_id=SFL-2024-001
```

The backend (`sfl-multi-agents-adk`) receives these via `websocket.query_params` and can inject them into the agent session state.

## Local dev

Open `demo.html` in a browser. It auto-detects the backend host from the current URL. To point to a different backend:

```html
<script>window.SFL_BACKEND_URL = 'ws://localhost:8000';</script>
```

Or with a remote backend:

```html
<script>window.SFL_BACKEND_URL = 'wss://your-backend.com';</script>
```

## Build / CDN distribution

```bash
npm install
npm run build   # outputs dist/sfl-chat-widget.min.js
```

Or deploy the raw `sfl-chat-widget.js` directly to any static hosting (S3, Cloudflare R2, Netlify, etc.) — it has zero dependencies.

## Configuration options

| Option | Default | Description |
|---|---|---|
| `wsUrl` | `ws://localhost:8000/ws` | WebSocket endpoint of sfl-multi-agents-adk |
| `accentColor` | `#f60e5f` | Primary brand color |
| `secondaryColor` | `#c40a4c` | Hover / gradient color |
| `lang` | auto-detect | Force language (`es`, `en`, `pt`, `fr`, `de`, `it`, `ca`) |
| `position` | `bottom-right` | Widget position |
| `welcomeMessage` | null | Override the welcome message text |
| `contextVars` | `{}` | Key→value map forwarded as WS query params |

## Related repos

- **sfl-multi-agents-adk** — FastAPI + Vertex AI multi-agent backend
- **sfl-multi-agents-admin** — Conversations & agent management dashboard
