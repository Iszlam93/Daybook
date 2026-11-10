# Daybook

A calm, private planner you can shape yourself. Tasks, a focus timer, habits, job search and learning in one place, with plug-ins for the tools you already use.

- **Private by default.** Everything is stored in your browser. No account, no tracking, no server. Nothing leaves your device unless you connect a plug-in.
- **Yours to shape.** Reorder, rename or hide any tile on Home. Add your own counters and habits. Pick an accent colour and density.
- **Plug-in based.** Each connection returns tasks or events in one standard shape, so every tab works with every source. Writing a new plug-in is one file.
- **Works offline.** Installable as an app on desktop and phone.
- **No build step.** Plain HTML, CSS and JavaScript. Open it, read it, change it.

## What is in it

| Area | What it does |
|---|---|
| Home | A dashboard: your day, next event, focus timer, job search, learning and habits. Customisable. |
| Today, Upcoming, Anytime | Tasks and events by day, repeating tasks (end a task with "daily"), prep reminders for meetings. |
| Focus | Pomodoro timer with sound and notifications, and a history of your sessions. |
| Habits | Your own habits: daily or a few times a week, an optional time window with reminders, a reason, and a link. |
| Job search | Applications, interviews, follow-up reminders and a funnel. Optional. |
| Learning | Courses with lesson days, study tasks and progress. Rename it to "Piano" or "Spanish". Optional. |
| Page | The mascot. It changes colour and outfit with your day. Can be hidden. |

## Plug-ins

| Plug-in | Status | Provides |
|---|---|---|
| Obsidian | Included | Tasks from your notes, tick-offs written back. Chrome and Edge for read and write, read-only elsewhere. |
| Calendar files and links (ICS) | Included | Events from any `.ics` file or link: Google, Outlook, Apple. Recurring events and time zones supported. |
| Notion | Planned | Tasks from your own Notion databases. |
| Google Calendar, Outlook Calendar | Planned | Events with sign-in. |
| Todoist | Planned | Tasks and projects. |

Want to add one? See [docs/PLUGINS.md](docs/PLUGINS.md).

## Run it

There is nothing to install. Serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly from disk also works for most features, but the service worker and some browser APIs need `http://` or `https://`.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In the repository, go to Settings, Pages, and set Source to **GitHub Actions**.
3. The included workflow in `.github/workflows/pages.yml` publishes the site on every push to `main`.

## Your data

Data lives in your browser's local storage and IndexedDB for this site. Use **Settings, Your data** to export a backup or import one on another device. Clearing site data erases your Daybook, so export a backup now and then.

Daybook makes no network requests of its own. It uses system fonts. A plug-in only talks to a service when you connect it, and a calendar link is fetched directly by your browser.

## Project layout

```
index.html            page shell
css/app.css           all styles
js/store.js           the local document store
js/app.js             the app: views, data layer, mascot, settings
js/plugins/           one file per plug-in
sw.js, manifest.webmanifest, icons/   installable app files
docs/PLUGINS.md       plug-in guide
```

## Roadmap

- Notion, Google Calendar, Outlook and Todoist plug-ins, with sign-in through a small optional helper
- Optional AI features using your own API key (interview debriefs, ask your day)
- Plug-in settings for custom task sources and webhooks
- Unlockable hats for Page

## Contributing

Ideas, bug reports and plug-ins are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE)
