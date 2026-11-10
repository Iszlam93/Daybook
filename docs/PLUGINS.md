# Writing a Daybook plug-in

A plug-in connects Daybook to another source of tasks or events. It is one JavaScript file that registers itself. Daybook merges what plug-ins return into its own lists, so every tab (Home, Today, Upcoming, Anytime, Job search reminders) shows them with no extra work.

## Quick start

1. Create `js/plugins/my-plugin.js`.
2. Add a script tag to `index.html`, after `js/app.js`:

   ```html
   <script src="js/plugins/my-plugin.js"></script>
   ```
3. Add the file to the `SHELL` list in `sw.js` if you want it available offline.

## The smallest plug-in

This one reads tasks from a JSON file you host yourself.

```js
(function () {
  "use strict";
  var API;

  async function sync() {
    var url = API.config("jsonfeed").url;
    if (!url) { API.setTasks("jsonfeed", []); return; }
    var res = await fetch(url);
    var items = await res.json(); // [{ "id": "1", "name": "Call Sam", "date": "2026-11-12" }]
    API.setTasks("jsonfeed", items.map(function (i) {
      return { id: "jsonfeed:" + i.id, name: i.name, date: i.date || "", src: "JSON feed" };
    }));
  }

  Daybook.registerPlugin({
    id: "jsonfeed",
    name: "JSON feed",
    provides: ["Tasks"],
    desc: "Tasks from a JSON file you host.",
    init: function (api) { API = api; return sync(); },
    sync: sync,
    status: function () { return { state: API.config("jsonfeed").url ? "ok" : "off", text: API.config("jsonfeed").url ? "Connected" : "Not connected" }; },
    settings: function (api) {
      return '<label class="fld" style="margin-top:8px">Feed URL<input type="url" data-plug="jsonfeed" data-field="url" value="' + api.esc(api.config("jsonfeed").url || "") + '"></label>';
    },
    onChange: function (e) { API.config("jsonfeed").url = e.target.value.trim(); API.save(); sync(); }
  });
})();
```

## The plug-in object

`Daybook.registerPlugin(plugin)` takes an object with these members. Only `id` and `name` are required.

| Member | Type | Purpose |
|---|---|---|
| `id` | string | Unique, lowercase. Used as the config key and in task ids. |
| `name` | string | Shown in Settings and on tasks ("Open in ..."). |
| `provides` | string[] | Labels such as `["Tasks"]` or `["Events"]`. |
| `desc` | string | One sentence for the Settings card. |
| `init(api)` | function | Called once at start. Keep a reference to `api`. May be async. |
| `status(api)` | function | Returns `{ state, text }`. `state` is `"ok"`, `"busy"`, `"error"` or `"off"`. |
| `settings(api)` | function | Returns an HTML string for the plug-in's Settings card. |
| `onAction(action, el, api)` | function | Called when an element with `data-act="plug:<id>:<action>"` is clicked. |
| `onChange(event, api)` | function | Called when an input with `data-plug="<id>"` changes. |
| `sync(api)` | function | Refresh from the source. Called on a timer and by the Refresh button. |
| `toggleTask(task, api)` | function | Called when the user ticks one of your tasks. Write the change back. |
| `addTask({ name, date, type }, api)` | function | Called when "New tasks" is set to your plug-in. Throw an `Error` with a friendly message to refuse. |
| `canAdd(api)` | function | Return `false` to show a warning that adding is not possible yet. |

## The api object

| Member | Purpose |
|---|---|
| `api.setTasks(pluginId, tasks)` | Replace all tasks from your plug-in. Pass `[]` to clear. |
| `api.setEvents(pluginId, events)` | Replace all events from your plug-in. |
| `api.config(pluginId)` | A persistent object for your settings. Change it, then call `api.save()`. |
| `api.save()` | Persist settings. |
| `api.render()` | Redraw the app. |
| `api.toast(message, label?, fn?)` | Show a toast, optionally with an action button. |
| `api.today()` | Today as `YYYY-MM-DD`. |
| `api.addDays(date, n)` | Add days to a `YYYY-MM-DD` string. |
| `api.pad(n)` | Two-digit number. |
| `api.esc(text)` | HTML-escape text. Always use it for user content. |
| `api.looksLikeMeeting(text)` | True for titles like "interview" or "screening call". |
| `api.idb.get(key)`, `.set(key, value)`, `.del(key)` | IndexedDB key-value storage for larger data or file handles. |

## Task shape

```js
{
  id: "myplugin:42",    // unique, prefix with your plug-in id
  name: "Call Sam",     // required
  date: "2026-11-12",   // YYYY-MM-DD, or "" for Anytime
  time: "14:30",        // optional HH:MM
  done: false,
  priority: false,
  type: "Task",         // "Task" or "Personal"
  notes: "",            // shown on the task card
  url: "",              // "Open in <name>" link
  src: "My plug-in"     // label shown on the row
}
```

`api.setTasks` adds `plugin: <id>` for you. Tasks you return cannot be edited or deleted inside Daybook (their source owns them), but they can be ticked off when you implement `toggleTask`.

## Event shape

```js
{
  id: "myplugin:evt-1",
  title: "Product review",
  date: "2026-11-12",
  time: "15:00",          // "" for all-day
  endTime: "16:00",
  allDay: false,
  startMs: 1794404400000, // epoch milliseconds, used for "next up" and countdowns
  endMs: 1794408000000,
  url: "",
  join: "https://meet.example.com/abc", // shows a "Join call" button
  meeting: true           // true adds a prep reminder the day before
}
```

## Settings markup

Settings HTML is a string. Use these conventions and Daybook wires the events for you:

- Buttons: `data-act="plug:<id>:<action>"` calls `onAction("<action>", element, api)`.
- Inputs and file pickers: add `data-plug="<id>"` and optionally `data-field="..."`. Their `change` event calls `onChange`.
- Add `data-pd="1"` and a stable `id` to text inputs so focus survives a redraw.
- Reuse the existing classes (`pill`, `smallbtn`, `fld`, `frow`, `note`, `warnnote`, `tag`) so it looks native.

## Guidelines

- **Privacy first.** Do not send user data anywhere without an explicit connect step in Settings, and say plainly where it goes.
- **Fail softly.** A broken source should show a message in `status` and never break the app.
- **Escape everything** you put into HTML with `api.esc`.
- **No dependencies, no build step.** Plain browser JavaScript.
- Test your parsing with real-world files. See `js/plugins/ics.js` for a thorough example and `js/plugins/obsidian.js` for read and write back.
