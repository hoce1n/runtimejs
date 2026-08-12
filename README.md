# RuntimeJs

Interactive JavaScript timeline with a sandboxed REPL and real event-loop visualizer.

## What it does

`js-timeline-explore` is a browser-based JavaScript playground that shows how code actually executes over time.

- The sandboxed REPL lets visitors write and run JavaScript inside a secure iframe, not by using `eval` in the main page.
- The event-loop visualizer shows real call stack, microtask, and task queue behavior produced by instrumented execution.
- This is a working developer tool demo, not a decorative or fake "devtools" skin.

## Features

- **Eras timeline** — an expandable walk through JavaScript's eras, from `var` hoisting to top-level await, each with a runnable snippet and a runtime comparison (V8 / Node / Deno / Bun).
- **Sandboxed REPL** — CodeMirror editor wired to an instrumented iframe. Run with the button or `Ctrl/Cmd+Enter`. Console output streams back over `postMessage`.
- **Event-loop visualizer** — step or scrub through a real trace: call stack, microtask queue, macrotask queue, per-step timing, and total elapsed time.
- **Shareable links** — every snippet lives in the URL hash, so a share link reopens the editor preloaded with that code.
- **Copy & clear** — one-click copy on every code snippet, plus a clear-console button in the REPL.

## Quick start

```sh
npm i
npm run dev
```

Then open the local URL shown by Vite. (The lockfile is generated with [Bun](https://bun.sh) — `bun install` works too.)

## How it's built

The app is built with TanStack Start and Vite. User code runs in a sandboxed iframe, and the event-loop trace is generated from Acorn-based AST instrumentation plus controlled queue tracking.

## Embed this

The REPL and event-loop visualizer are also available as a standalone, iframe-friendly page — no app chrome, no search, just the tool — so you can drop a runnable example straight into a blog post or docs page.

The embed lives at `/embed`. Add `?example=<id>` to preload a specific snippet (either a REPL example id or an interview-pattern id from the main site); unknown ids fall back to the default example. `?view=loop` opens the event-loop view instead of the console.

```html
<iframe
  src="https://runtimejs.vercel.app/embed?example=event-loop-order"
  width="100%"
  height="480"
  style="border:0;border-radius:8px;"
></iframe>
```

The small "via runtime.js" badge in the corner links back to the main site, which is the whole point of embedding it.

## Analytics

Cookie-less, privacy-friendly analytics are built in but **disabled by default** — no script is loaded until you configure a provider:

- **Plausible** (recommended): set `VITE_PLAUSIBLE_DOMAIN` to your site domain.
- **Umami** (self-hosted alternative): set `VITE_UMAMI_HOST` and `VITE_UMAMI_WEBSITE_ID`.

See `.env.example`. No visitor cookies, no accounts. Custom events (`run`, `share`, `load_example`) are forwarded automatically when a provider is enabled.

## License

MIT — see LICENSE.

## About

A small interactive showcase of JavaScript execution and async behavior.

### Credits

Built by [hocein](https://github.com/hoce1n):

- GitHub: https://github.com/hoce1n
- LinkedIn: https://www.linkedin.com/in/hocein/
- Instagram: https://www.instagram.com/hoce1n/
- Telegram: https://t.me/hoce1n
