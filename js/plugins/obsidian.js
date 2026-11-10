/*
 * Daybook plug-in: Obsidian
 * Reads checkbox tasks from the Markdown notes in your vault and writes tick-offs back.
 * Works in Chrome and Edge through the folder picker (read and write). In other browsers
 * it falls back to a read-only snapshot you pick with a normal folder input.
 *
 * Supported task syntax (also the Obsidian Tasks plugin format):
 *   - [ ] 14:30 Call Sam [[Sam Lee|Sam]] 📅 2026-11-12 ⏫ #daybook
 *   - [x] Book venue ✅ 2026-11-10
 */
(function () {
  "use strict";
  var API = null;
  var ST = { handle: null, mode: "off", status: "off", msg: "", count: 0, busy: false, needs: false, vault: "", snap: [], last: 0 };
  var hasPicker = function () { return typeof window.showDirectoryPicker === "function"; };
  var escRe = function (x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); };
  var cfg = function () {
    var c = API.config("obsidian");
    if (c.folder == null) c.folder = "";
    if (c.tag == null) c.tag = "";
    if (!c.days) c.days = 14;
    return c;
  };

  async function init(api) {
    API = api;
    try {
      var h = await API.idb.get("obsHandle");
      if (!h) return;
      ST.handle = h; ST.vault = h.name;
      var p = await h.queryPermission({ mode: "readwrite" });
      if (p === "granted") { ST.mode = "folder"; sync(); }
      else { ST.needs = true; ST.status = "needs"; API.render(); }
    } catch (_) { /* no stored vault */ }
  }

  async function connect() {
    try {
      if (ST.handle) {
        var p = await ST.handle.requestPermission({ mode: "readwrite" });
        if (p !== "granted") throw { name: "NotAllowedError", message: "Permission wasn't granted." };
      } else {
        ST.handle = await window.showDirectoryPicker({ id: "daybook-vault", mode: "readwrite" });
        try { await API.idb.set("obsHandle", ST.handle); } catch (_) {}
      }
      ST.vault = ST.handle.name; ST.mode = "folder"; ST.needs = false; sync();
    } catch (e) {
      if (e && e.name === "AbortError") return;
      ST.status = "error";
      ST.msg = e && e.name === "SecurityError"
        ? "This page isn't allowed to open folders. Use the read-only option below."
        : ((e && e.message) || "Couldn't open that folder.");
      API.render();
    }
  }

  async function disconnect() {
    ST.handle = null; ST.mode = "off"; ST.status = "off"; ST.msg = ""; ST.needs = false; ST.snap = []; ST.count = 0;
    try { await API.idb.del("obsHandle"); } catch (_) {}
    API.setTasks("obsidian", []);
  }

  function clean(body, tag) {
    var b = body;
    b = b.replace(/(?:📅|⏳|🛫|✅|❌|➕)\s*\d{4}-\d{2}-\d{2}/gu, "");
    b = b.replace(/🔁[^📅⏳🛫✅❌➕⏫🔼🔽🔺⏬]*/gu, "");
    b = b.replace(/[⏫🔼🔽🔺⏬]/gu, "");
    b = b.replace(/\[\w+::[^\]]*\]/g, "");
    b = b.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, function (m, a, al) { return al || a; });
    b = b.replace(/\s\^[\w-]+\s*$/, "");
    if (tag) b = b.replace(new RegExp("(^|\\s)#" + escRe(tag) + "(?![\\w/-])", "gi"), "$1");
    return b.replace(/\s{2,}/g, " ").trim();
  }

  function dateOf(body, emoji, name) {
    var m = new RegExp(emoji + "\\s*(\\d{4}-\\d{2}-\\d{2})", "u").exec(body);
    if (m) return m[1];
    m = new RegExp("\\[" + name + "::\\s*(\\d{4}-\\d{2}-\\d{2})\\s*\\]").exec(body);
    return m ? m[1] : "";
  }

  var TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;

  function parse(path, text, out, mtime) {
    var o = cfg();
    var folder = String(o.folder || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (folder) {
      var lp = path.toLowerCase();
      if (!(lp === folder || lp.indexOf(folder + "/") === 0)) return;
    }
    var tag = String(o.tag || "").trim().replace(/^#/, "");
    var tagRe = tag ? new RegExp("(^|\\s)#" + escRe(tag) + "(?![\\w/-])", "i") : null;
    var base = path.split("/").pop().replace(/\.md$/i, "");
    var noteDate = /^\d{4}-\d{2}-\d{2}$/.test(base) ? base : "";
    var t0 = API.today(), minDate = API.addDays(t0, -(Number(o.days) || 14)), hasFilter = !!(folder || tag);
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = TASK.exec(lines[i]);
      if (!m) continue;
      var done = m[1] !== " ", body = m[2];
      if (tagRe && !tagRe.test(body)) continue;
      var due = dateOf(body, "📅", "due") || dateOf(body, "⏳", "scheduled") || dateOf(body, "🛫", "start");
      var doneDate = dateOf(body, "✅", "completion");
      var date = due || (done ? doneDate : "") || noteDate;
      if (done) { if (!date || date < API.addDays(t0, -7)) continue; }
      else if (date) { if (date < minDate) continue; }
      else if (!hasFilter && mtime && (Date.now() - mtime) > 60 * 86400000) continue;
      var title = clean(body, tag), time = "";
      var tm = /^(\d{1,2}):(\d{2})\s+/.exec(title);
      if (tm && Number(tm[1]) < 24 && Number(tm[2]) < 60) { time = API.pad(Number(tm[1])) + ":" + tm[2]; title = title.slice(tm[0].length); }
      if (!title) continue;
      out.push({
        id: "obs:" + path + "#" + i, obsPath: path, obsLine: i, obsRaw: lines[i], src: "Obsidian",
        url: "obsidian://open?vault=" + encodeURIComponent(ST.vault) + "&file=" + encodeURIComponent(path.replace(/\.md$/i, "")),
        name: title, type: /(^|\s)#personal(?![\w/-])/i.test(body) ? "Personal" : "Task", notes: path,
        date: date, time: time, done: done, priority: /⏫|🔺/u.test(body)
      });
    }
  }

  async function walk(dir, prefix, out, cnt) {
    for await (var entry of dir.entries()) {
      var name = entry[0], h = entry[1];
      if (cnt.n > 4000) return;
      if (name.charAt(0) === ".") continue;
      if (h.kind === "directory") { if (/^node_modules$/i.test(name)) continue; await walk(h, prefix + name + "/", out, cnt); }
      else if (/\.md$/i.test(name)) {
        var f = await h.getFile();
        if (f.size > 1500000) continue;
        cnt.n++;
        parse(prefix + name, await f.text(), out, f.lastModified);
      }
    }
  }

  async function sync() {
    if (ST.busy || ST.mode === "off") return;
    ST.busy = true; ST.status = "syncing"; API.render();
    try {
      var out = [];
      if (ST.mode === "folder") { ST.vault = ST.handle.name; await walk(ST.handle, "", out, { n: 0 }); }
      else ST.snap.forEach(function (f) { parse(f.path, f.text, out, f.mtime); });
      ST.count = out.length; ST.status = "ok"; ST.msg = ""; ST.last = Date.now();
      API.setTasks("obsidian", out);
    } catch (e) { ST.status = "error"; ST.msg = (e && e.message) || "Couldn't read the vault."; }
    ST.busy = false; API.render();
  }

  function toggleLine(line, done) {
    if (done) {
      line = line.replace(/\[ \]/, "[x]");
      if (!/✅\s*\d{4}/u.test(line)) line = line.replace(/\s+$/, "") + " ✅ " + API.today();
    } else {
      line = line.replace(/\[[xX]\]/, "[ ]").replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/u, "");
    }
    return line;
  }

  async function toggleTask(t) {
    if (ST.mode !== "folder") { API.toast("Read-only. Connect your vault folder in Settings to tick tasks off."); return; }
    var before = t.done; t.done = !t.done; API.render();
    try {
      var parts = t.obsPath.split("/"), dir = ST.handle;
      for (var i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
      var fh = await dir.getFileHandle(parts[parts.length - 1]);
      var text = await (await fh.getFile()).text();
      var eol = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n", lines = text.split(/\r?\n/);
      var idx = lines[t.obsLine] === t.obsRaw ? t.obsLine : lines.indexOf(t.obsRaw);
      if (idx < 0) throw new Error("That line changed in Obsidian. Refresh and try again.");
      lines[idx] = toggleLine(lines[idx], t.done);
      var w = await fh.createWritable(); await w.write(lines.join(eol)); await w.close();
      t.obsRaw = lines[idx]; t.obsLine = idx;
      setTimeout(sync, 500);
    } catch (e) { t.done = before; API.render(); API.toast((e && e.message) || "Couldn't write to Obsidian."); }
  }

  async function addTask(task) {
    if (ST.mode !== "folder") throw new Error("Connect your vault folder in Settings first.");
    var fh = await ST.handle.getFileHandle("Daybook inbox.md", { create: true });
    var text = await (await fh.getFile()).text();
    text = (text && text.slice(-1) !== "\n" ? text + "\n" : text) + "- [ ] " + task.name + (task.date ? " 📅 " + task.date : "") + "\n";
    var w = await fh.createWritable(); await w.write(text); await w.close();
    setTimeout(sync, 300);
  }

  async function snapshot(files) {
    var arr = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], rel = String(f.webkitRelativePath || f.name).split("/");
      if (!/\.md$/i.test(f.name) || rel.slice(1, -1).some(function (x) { return x.charAt(0) === "." || /^node_modules$/i.test(x); }) || f.size > 1500000) continue;
      arr.push({ path: rel.length > 1 ? rel.slice(1).join("/") : f.name, text: await f.text(), mtime: f.lastModified });
    }
    ST.vault = String((files[0] && files[0].webkitRelativePath || "").split("/")[0]) || "vault";
    ST.snap = arr; ST.mode = "snapshot"; ST.needs = false; ST.handle = null; sync();
  }

  function status() {
    if (ST.status === "ok") return { state: "ok", text: "Connected, " + ST.count + " task" + (ST.count === 1 ? "" : "s") };
    if (ST.status === "syncing") return { state: "busy", text: "Reading your vault" };
    if (ST.status === "needs") return { state: "error", text: "Needs permission" };
    if (ST.status === "error") return { state: "error", text: "Problem" };
    return { state: "off", text: "Not connected" };
  }

  function settings(api) {
    var e = api.esc, o = cfg(), connected = ST.mode !== "off";
    var btn = function (act, label, cls) { return '<button type="button" class="' + cls + '" data-act="plug:obsidian:' + act + '">' + label + "</button>"; };
    var html = "";
    if (hasPicker()) {
      html += '<div class="btns" style="margin-top:10px;flex-wrap:wrap">' +
        (ST.mode === "folder" ? btn("sync", "Sync now", "smallbtn") + btn("disconnect", "Disconnect", "smallbtn")
          : ST.needs ? btn("connect", "Reconnect vault", "pill sm pri") + btn("disconnect", "Forget", "smallbtn")
          : btn("connect", "Choose vault folder", "pill sm pri")) + "</div>";
    } else {
      html += '<p class="warnnote" style="margin-top:8px">This browser can\'t open folders for editing. Use the read-only option below.</p>';
    }
    html += '<div class="btns" style="margin-top:8px;flex-wrap:wrap;align-items:center"><label class="smallbtn" style="position:relative;display:inline-flex;align-items:center;cursor:pointer">' +
      (ST.mode === "snapshot" ? "Pick folder again" : "Read-only: pick a folder") +
      '<input class="sr" type="file" webkitdirectory multiple data-plug="obsidian" data-field="dir"></label>' +
      (ST.mode === "snapshot" ? btn("disconnect", "Disconnect", "smallbtn") : "") + "</div>";
    if (ST.status === "error" && ST.msg) html += '<p class="warnnote" style="margin-top:8px">' + e(ST.msg) + "</p>";
    if (connected) {
      html += '<div class="frow" style="margin-top:12px">' +
        '<label class="fld">Only this folder<input data-plug="obsidian" data-field="folder" data-pd="1" id="obsFolder" type="text" placeholder="e.g. Projects" value="' + e(o.folder) + '"></label>' +
        '<label class="fld">Only this tag<input data-plug="obsidian" data-field="tag" data-pd="1" id="obsTag" type="text" placeholder="e.g. daybook" value="' + e(o.tag) + '"></label>' +
        '<label class="fld">Show overdue for (days)<input data-plug="obsidian" data-field="days" data-pd="1" id="obsDays" type="number" min="1" max="365" value="' + Number(o.days || 14) + '"></label></div>' +
        '<p class="note" style="margin-top:8px;font-size:13px">Reads checkbox tasks such as <code>- [ ] Call Sam 📅 2026-11-12</code>, including the Tasks plugin format. Tasks without a date are included when their note changed in the last 60 days, or when a folder or tag filter is set. ' +
        (ST.mode === "snapshot" ? "Read-only mode can't tick tasks off or save new ones." : "Ticking a task off writes the change to your note.") + "</p>";
    }
    return html;
  }

  function onAction(a) {
    if (a === "connect") connect();
    else if (a === "disconnect") disconnect();
    else if (a === "sync") sync();
  }

  function onChange(e) {
    var t = e.target, f = t.dataset.field;
    if (f === "dir") { var fl = Array.prototype.slice.call(t.files || []); if (fl.length) snapshot(fl).catch(function () { API.toast("Couldn't read that folder."); }); return; }
    var c = cfg();
    if (f === "folder") c.folder = t.value.trim();
    else if (f === "tag") c.tag = t.value.trim();
    else if (f === "days") c.days = Number(t.value) || 14;
    API.save(); sync();
  }

  Daybook.registerPlugin({
    id: "obsidian",
    name: "Obsidian",
    provides: ["Tasks"],
    desc: "Tasks from your notes, shown next to everything else. Your vault stays on your computer.",
    init: init,
    status: status,
    settings: settings,
    onAction: onAction,
    onChange: onChange,
    sync: sync,
    toggleTask: toggleTask,
    addTask: addTask,
    canAdd: function () { return ST.mode === "folder"; }
  });
})();
