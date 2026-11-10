# Contributing to Daybook

Thanks for helping. Daybook is a small, dependency-free web app, so getting started is quick.

## Run it

```bash
python -m http.server 8000
```

Open <http://localhost:8000> for the landing page and <http://localhost:8000/app/> for the app. There is no build step: edit a file and refresh.

## Where things live

- `js/store.js` is the local document store. It mimics a tiny database (`collection`, `doc`, `onSnapshot`).
- `js/mascot.js` draws Page. It is shared by the app and the landing page.
- `js/app.js` holds the views, data layer and settings. It is one file on purpose for now; sections are marked with `/* ---------- name ---------- */` comments.
- `js/plugins/` has one file per plug-in. See [docs/PLUGINS.md](docs/PLUGINS.md).
- `css/app.css` has all styles, driven by CSS variables so light and dark mode both work.

## Principles

1. **Private by default.** No analytics, no third-party requests, no data leaves the browser without the user connecting something.
2. **Calm design.** One accent colour, generous space, no clutter. When in doubt, take something away.
3. **No dependencies.** Plain HTML, CSS and JavaScript. If you need a library, open an issue first.
4. **Accessible.** Real buttons and labels, visible focus, colour is never the only signal, and respect `prefers-reduced-motion`.
5. **Both themes.** Use the CSS variables. Check light and dark.

## Pull requests

- Keep them focused. One plug-in, one fix or one feature per PR.
- Describe what changed and how you tested it. A screenshot helps for visual changes.
- For a new plug-in, include a short section in the README table and test with real data.

## Reporting bugs

Open an issue with your browser, what you did, what you expected and what happened. Please do not paste personal data from your backup.
