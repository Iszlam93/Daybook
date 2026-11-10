# Daybook

A free, private home screen for your day. Your Notion tasks and calendar in one calm place, laid out the way you want, with a little companion who notices when you get things done.

- **Free and private.** No account, no tracking, no server holding your data. Everything is stored in your browser.
- **Bring what you use.** Notion (beta), calendar files and links, and Obsidian (optional), each as a small plug-in.
- **Make it yours.** Reorder, rename or hide any tile. Add your own counters and habits. Pick an accent colour, light or dark.
- **Page.** A pixel companion who changes colour and outfit with your day and cheers when you finish things. Hide it any time.
- **Works offline.** Install it like an app on desktop and phone.
- **No build step.** Plain HTML, CSS and JavaScript. Open it, read it, change it.

## How to use Daybook

You do not need to install anything or create an account.

**1. Open it.** Go to <https://iszlam93.github.io/Daybook/> and choose **Open Daybook**. It opens with a sample day so you can look around. Tick a task and watch Page.

**2. Pick a starting layout.** Choose Notion planner, Calendar and focus, Second brain or Just today. You can change everything later. Your own data replaces the sample.

**3. Add your first tasks.** Type in the **Add a task** box on Home or Today. End a task with the word `daily` to make it repeat, for example `Stretch daily`.

**4. Connect what you use** (optional), in **Settings, Plug-ins**:

| To see | Do this |
|---|---|
| Calendar events | Choose **Upload .ics file**, or paste a calendar link. Export the file from Google Calendar (Settings, Import and export), Outlook (Publish calendar) or Apple Calendar (File, Export). |
| Notion tasks | Choose **Connect with Notion** and sign in, pick your tasks database and match its columns. |
| Obsidian notes | Choose **Choose vault folder** in Chrome or Edge. Daybook reads your checkbox tasks and ticks them off in the note. |

**5. Make it yours.** On Home choose **Customize Home** to reorder, rename or hide tiles and add your own counters. In **Settings** you can add habits, switch on Job search or Learning, and pick an accent colour, light or dark, and Page's behaviour.

**6. Install it like an app.** On a computer, use the install icon in the address bar of Chrome or Edge. On an iPhone, tap Share, then Add to Home Screen. It then opens in its own window and works offline.

**7. Back up your data.** Your data lives in this browser only. In **Settings, Your data** choose **Export backup** now and then. You can import it on another device.

If you would rather run it on your own computer, see [Run it locally](#run-it-locally).

## How people get it

The code lives on GitHub, but you do not need GitHub to use Daybook. Once the site is published (see below), people open a link, try the sample day, and install it from the browser. There is nothing to download and no command to run.

| Address | What it is |
|---|---|
| `/` | The landing page |
| `/app/` | The app itself |

## What is in the app

| Area | What it does |
|---|---|
| Home | A dashboard: your day, next event, focus timer and what needs you. Fully customisable. |
| Today, Upcoming, Anytime | Tasks and events by day, repeating tasks (end a task with "daily"), prep reminders for meetings. |
| Focus | Pomodoro timer with sound and notifications. |
| Habits | Your own: daily or a few times a week, an optional time window with reminders, a reason and a link. |
| Starter layouts | Notion planner, Calendar and focus, Second brain, Just today. Chosen on first run. |
| Job search, Learning | Optional modules, off by default. Turn them on in Settings. |

## Plug-ins

| Plug-in | Status | Provides |
|---|---|---|
| Notion | Beta | Tasks from a database you choose, with columns you match. Tick off and add from Daybook. Works on the public site through a small helper; see below. |
| Calendar files and links (ICS) | Included | Events from any `.ics` file or link: Google, Outlook, Apple. Recurring events and time zones work. |
| Obsidian | Included, optional | Tasks from your notes, tick-offs written back. Chrome and Edge for read and write, read-only elsewhere. |
| Google Calendar, Outlook Calendar, Todoist | Planned | |

A plug-in is one JavaScript file. See [docs/PLUGINS.md](docs/PLUGINS.md).

### About the Notion helper

Notion does not allow web pages to call its API, and its sign-in needs a secret that cannot sit in a web page. So Notion tasks pass through a small helper (a free Cloudflare Worker). The public site runs one for you; it stores nothing and logs nothing. If you host your own copy of Daybook, set up your own helper with [worker/README.md](worker/README.md). Daybook works fully without it; only the Notion plug-in needs it.

## Run it locally

```bash
python -m http.server 8000
```

Open <http://localhost:8000> for the landing page, or <http://localhost:8000/app/> for the app.

## Publish it

1. Push this repository to GitHub.
2. In the repository, go to Settings, Pages. Under Build and deployment, set Source to **Deploy from a branch**, choose the branch `main` and the folder `/ (root)`, and save.
3. The site updates automatically on every push to `main`. This repository is published at <https://iszlam93.github.io/Daybook/>. A copy of your own would be at `https://yourname.github.io/repository-name/`.
4. In `js/landing.js`, set `REPO_URL` to your repository so the footer link appears.
5. For Notion, follow [worker/README.md](worker/README.md) and fill in `js/config.js`.

## Your data

Data lives in your browser's local storage and IndexedDB for this site. Use **Settings, Your data** to export a backup or import one on another device. There is no sync between devices yet. Clearing site data erases your Daybook, so export a backup now and then.

Daybook makes no network requests of its own and uses system fonts. A plug-in only talks to a service when you connect it.

## Project layout

```
index.html            landing page
app/index.html        the app
css/landing.css       landing page styles
css/app.css           app styles
js/store.js           the local document store
js/mascot.js          Page, drawn as SVG (shared by the app and the landing page)
js/config.js          site configuration (Notion helper address)
js/app.js             the app: views, data layer, settings, starters
js/landing.js         landing page demo
js/plugins/           one file per plug-in
worker/               the optional Notion helper (Cloudflare Worker)
sw.js, manifest.webmanifest, icons/   installable app files
docs/PLUGINS.md       plug-in guide
```

## Roadmap

- Google Calendar and Outlook sign-in plug-ins
- Optional sync through a file or folder you already sync (iCloud, Dropbox, Drive)
- More plug-ins from the community

## Contributing

Ideas, bug reports and plug-ins are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE)
