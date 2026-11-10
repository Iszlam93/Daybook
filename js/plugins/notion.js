/*
 * Daybook plug-in: Notion
 * Shows the tasks from one of your Notion databases next to everything else, ticks them off
 * in Notion, and saves new tasks there. You choose the database and match its columns, so it
 * works with the setup you already have.
 *
 * Notion does not allow requests from web pages, so calls go through a small helper you run
 * yourself (see worker/README.md). Your Notion data passes through that helper. The access
 * token is kept in this browser only.
 */
(function () {
  "use strict";
  var API = null;
  var ST = { token: "", status: "off", msg: "", count: 0, busy: false, dbs: null, schema: null, last: 0 };
  var CFG = function () { return window.DAYBOOK_CONFIG || {}; };
  var cfg = function () {
    var c = API.config("notion");
    if (!c.map) c.map = {};
    if (!c.days) c.days = 30;
    return c;
  };
  var helper = function () { return String(cfg().helperUrl || CFG().helperUrl || "").replace(/\/+$/, ""); };
  var oauthReady = function () { return !!(CFG().notionClientId && CFG().helperUrl); };
  var appUrl = function () { return location.origin + location.pathname; };

  /* ---------- talking to Notion through the helper ---------- */
  async function call(method, path, body) {
    var h = helper();
    if (!h) throw new Error("No Notion helper address is set. See worker/README.md.");
    if (!ST.token) throw new Error("Notion is not connected.");
    var res;
    try {
      res = await fetch(h + "/api" + path, {
        method: method,
        headers: { "Content-Type": "application/json", "X-Notion-Token": ST.token },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw new Error("Couldn't reach the Notion helper. Check its address and that it is running."); }
    var data = null;
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (!res.ok) {
      var m = (data && (data.message || data.error)) || ("Notion answered " + res.status);
      if (res.status === 401) m = "Notion rejected the token. Connect again.";
      throw new Error(m);
    }
    return data;
  }

  /* ---------- connecting ---------- */
  function connect() {
    if (!oauthReady()) { API.toast("Notion sign-in isn't set up on this site yet."); return; }
    var state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem("daybook_notion_state", state); } catch (_) {}
    var u = "https://api.notion.com/v1/oauth/authorize?client_id=" + encodeURIComponent(CFG().notionClientId) +
      "&response_type=code&owner=user&redirect_uri=" + encodeURIComponent(appUrl()) + "&state=" + encodeURIComponent(state);
    location.href = u;
  }

  async function finishOAuth() {
    var p = new URLSearchParams(location.search);
    var code = p.get("code"), state = p.get("state");
    if (!code || !state) return false;
    var want = ""; try { want = sessionStorage.getItem("daybook_notion_state") || ""; } catch (_) {}
    var clean = function () { history.replaceState(null, "", location.pathname + location.hash); };
    if (!want || want !== state) { clean(); return false; }
    try { sessionStorage.removeItem("daybook_notion_state"); } catch (_) {}
    try {
      var res = await fetch(helper() + "/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code, redirect_uri: appUrl() }) });
      var data = await res.json();
      if (!res.ok || !data.access_token) throw new Error(data.message || data.error || "Sign-in failed.");
      ST.token = data.access_token;
      await API.idb.set("notion:token", ST.token);
      cfg().workspace = data.workspace_name || "";
      API.save();
      API.toast("Connected to Notion");
    } catch (e) { ST.status = "error"; ST.msg = (e && e.message) || "Sign-in failed."; }
    clean();
    return true;
  }

  async function connectToken(token, helperUrl) {
    token = String(token || "").trim(); helperUrl = String(helperUrl || "").trim();
    if (helperUrl) cfg().helperUrl = helperUrl;
    if (!helper()) { API.toast("Add your helper address first."); return; }
    if (!token) { API.toast("Paste your integration token."); return; }
    ST.token = token;
    try {
      var me = await call("GET", "/users/me");
      cfg().workspace = (me && me.bot && me.bot.workspace_name) || (me && me.name) || "Notion";
      await API.idb.set("notion:token", token);
      API.save(); API.toast("Connected to Notion");
      ST.status = "ok"; ST.msg = "";
      await loadDatabases();
    } catch (e) { ST.token = ""; ST.status = "error"; ST.msg = (e && e.message) || "Couldn't connect."; API.render(); }
  }

  async function disconnect() {
    ST.token = ""; ST.status = "off"; ST.msg = ""; ST.dbs = null; ST.schema = null; ST.count = 0;
    var c = cfg(); c.dbId = ""; c.dbName = ""; c.map = {}; c.workspace = "";
    try { await API.idb.del("notion:token"); } catch (_) {}
    API.save(); API.setTasks("notion", []);
  }

  /* ---------- databases and columns ---------- */
  function plain(arr) { return (arr || []).map(function (t) { return t.plain_text || ""; }).join(""); }

  async function loadDatabases() {
    try {
      var r = await call("POST", "/search", { filter: { property: "object", value: "database" }, page_size: 50 });
      ST.dbs = (r.results || []).map(function (d) { return { id: d.id, name: plain(d.title) || "Untitled" }; });
      ST.msg = "";
      if (!cfg().dbId && ST.dbs.length === 1) await chooseDb(ST.dbs[0].id);
      else if (cfg().dbId) await loadSchema();
    } catch (e) { ST.status = "error"; ST.msg = (e && e.message) || "Couldn't list your databases."; }
    API.render();
  }

  async function loadSchema() {
    var c = cfg();
    if (!c.dbId) { ST.schema = null; return; }
    var d = await call("GET", "/databases/" + c.dbId);
    var props = d.properties || {};
    ST.schema = Object.keys(props).map(function (k) {
      var p = props[k];
      return { name: k, type: p.type, options: p.status ? (p.status.options || []).map(function (o) { return o.name; }) : [], groups: p.status ? (p.status.groups || []) : [], optionDefs: p.status ? (p.status.options || []) : [] };
    });
  }

  function autoMap() {
    var c = cfg(), s = ST.schema || [], m = {};
    var by = function (type) { return s.filter(function (p) { return p.type === type; }); };
    var t = by("title")[0]; m.title = t ? t.name : "";
    var dates = by("date");
    var d = dates.filter(function (p) { return /due|date|when|deadline|scheduled/i.test(p.name); })[0] || dates[0];
    m.date = d ? d.name : "";
    var boxes = by("checkbox");
    var cb = boxes.filter(function (p) { return /done|complete|finished|checked/i.test(p.name); })[0];
    var st = by("status")[0];
    if (cb) { m.done = cb.name; m.doneType = "checkbox"; }
    else if (st) {
      m.done = st.name; m.doneType = "status";
      var idsOf = function (gName) { var g = st.groups.filter(function (x) { return x.name.toLowerCase() === gName; })[0]; return g ? g.option_ids : []; };
      var nameOf = function (id) { var o = st.optionDefs.filter(function (x) { return x.id === id; })[0]; return o ? o.name : ""; };
      var doneIds = idsOf("complete"), todoIds = idsOf("to-do");
      m.doneValue = (doneIds.length && nameOf(doneIds[0])) || st.options.filter(function (n) { return /done|complete/i.test(n); })[0] || st.options[st.options.length - 1] || "";
      m.todoValue = (todoIds.length && nameOf(todoIds[0])) || st.options.filter(function (n) { return n !== m.doneValue; })[0] || "";
    } else if (boxes[0]) { m.done = boxes[0].name; m.doneType = "checkbox"; }
    c.map = m;
  }

  async function chooseDb(id) {
    var c = cfg();
    c.dbId = id;
    var d = (ST.dbs || []).filter(function (x) { return x.id === id; })[0];
    c.dbName = d ? d.name : "";
    try { await loadSchema(); autoMap(); API.save(); await sync(); }
    catch (e) { ST.status = "error"; ST.msg = (e && e.message) || "Couldn't read that database."; API.render(); }
  }

  /* ---------- reading tasks ---------- */
  function dateParts(start) {
    if (!start) return { date: "", time: "" };
    if (start.length <= 10) return { date: start, time: "" };
    var d = new Date(start);
    if (isNaN(d)) return { date: start.slice(0, 10), time: "" };
    return { date: d.getFullYear() + "-" + API.pad(d.getMonth() + 1) + "-" + API.pad(d.getDate()), time: API.pad(d.getHours()) + ":" + API.pad(d.getMinutes()) };
  }

  function toTask(page, m) {
    var P = page.properties || {};
    var title = m.title && P[m.title] ? plain(P[m.title].title) : "";
    if (!title.trim()) return null;
    var dp = m.date && P[m.date] && P[m.date].date ? dateParts(P[m.date].date.start) : { date: "", time: "" };
    var done = false;
    if (m.done && P[m.done]) {
      if (m.doneType === "checkbox") done = !!P[m.done].checkbox;
      else if (m.doneType === "status") done = !!(P[m.done].status && P[m.done].status.name === m.doneValue);
    }
    return { id: "notion:" + page.id, notionId: page.id, name: title.trim(), date: dp.date, time: dp.time, done: done, type: "Task", url: page.url || "", src: "Notion", notes: "" };
  }

  function buildFilter(m) {
    if (!m.done) return undefined;
    var since = new Date(Date.now() - 7 * 86400000).toISOString();
    var open = m.doneType === "checkbox"
      ? { property: m.done, checkbox: { equals: false } }
      : { property: m.done, status: { does_not_equal: m.doneValue } };
    return { or: [open, { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } }] };
  }

  async function sync() {
    var c = cfg();
    if (ST.busy || !ST.token || !c.dbId || !c.map.title) { if (!ST.token) API.setTasks("notion", []); return; }
    ST.busy = true; ST.status = "syncing"; API.render();
    try {
      var out = [], cursor = null, pages = 0, t0 = API.today(), minDate = API.addDays(t0, -(Number(c.days) || 30));
      do {
        var body = { page_size: 100 };
        var f = buildFilter(c.map); if (f) body.filter = f;
        if (cursor) body.start_cursor = cursor;
        var r = await call("POST", "/databases/" + c.dbId + "/query", body);
        (r.results || []).forEach(function (pg) {
          if (pg.archived || pg.in_trash) return;
          var t = toTask(pg, c.map); if (!t) return;
          if (t.done) { if (!t.date || t.date < API.addDays(t0, -7)) return; }
          else if (t.date && t.date < minDate) return;
          out.push(t);
        });
        cursor = r.has_more ? r.next_cursor : null; pages++;
      } while (cursor && pages < 5);
      ST.count = out.length; ST.status = "ok"; ST.msg = ""; ST.last = Date.now();
      API.setTasks("notion", out);
    } catch (e) { ST.status = "error"; ST.msg = (e && e.message) || "Couldn't read Notion."; }
    ST.busy = false; API.render();
  }

  /* ---------- writing back ---------- */
  function donePatch(m, done) {
    if (m.doneType === "checkbox") { var o = {}; o[m.done] = { checkbox: done }; return o; }
    var s = {}; s[m.done] = { status: { name: done ? m.doneValue : (m.todoValue || m.doneValue) } }; return s;
  }

  async function toggleTask(t) {
    var m = cfg().map;
    if (!m.done) { API.toast("Pick a Done column for Notion in Settings first."); return; }
    var before = t.done; t.done = !t.done; API.render();
    try { await call("PATCH", "/pages/" + t.notionId, { properties: donePatch(m, t.done) }); }
    catch (e) { t.done = before; API.render(); API.toast((e && e.message) || "Couldn't update Notion."); }
  }

  async function addTask(task) {
    var c = cfg(), m = c.map;
    if (!ST.token || !c.dbId || !m.title) throw new Error("Connect Notion and choose a database in Settings first.");
    var props = {}; props[m.title] = { title: [{ text: { content: task.name } }] };
    if (m.date && task.date) props[m.date] = { date: { start: task.date } };
    await call("POST", "/pages", { parent: { database_id: c.dbId }, properties: props });
    setTimeout(sync, 300);
  }

  /* ---------- plug-in surface ---------- */
  function status() {
    var c = cfg();
    if (!ST.token) return { state: ST.status === "error" ? "error" : "off", text: ST.status === "error" ? "Problem" : "Not connected" };
    if (ST.status === "syncing") return { state: "busy", text: "Reading Notion" };
    if (ST.status === "error") return { state: "error", text: "Problem" };
    if (!c.dbId) return { state: "off", text: "Choose a database" };
    return { state: "ok", text: "Connected, " + ST.count + " task" + (ST.count === 1 ? "" : "s") };
  }

  function sel(e, field, value, options, blank) {
    return '<select class="mini-sel" style="max-width:100%" data-plug="notion" data-field="' + field + '" aria-label="' + e(field) + '">' +
      (blank ? '<option value="">' + e(blank) + "</option>" : "") +
      options.map(function (o) { return '<option value="' + e(o.v) + '"' + (o.v === value ? " selected" : "") + ">" + e(o.l) + "</option>"; }).join("") + "</select>";
  }

  function settings(api) {
    var e = api.esc, c = cfg(), m = c.map || {}, html = "";
    var note = '<p class="note" style="margin-top:8px;font-size:13px">Notion does not allow requests from web pages, so your Notion data passes through a small helper that you run yourself. It stores nothing. See <code>worker/README.md</code>.</p>';
    if (!ST.token) {
      if (oauthReady()) {
        html += '<div class="btns" style="margin-top:10px"><button type="button" class="pill sm pri" data-act="plug:notion:connect">Connect with Notion</button></div>';
      } else {
        html += '<p class="warnnote" style="margin-top:8px">Notion sign-in is not set up on this site yet. You can still connect with your own helper and an integration token below.</p>';
      }
      html += '<details style="margin-top:10px"' + (oauthReady() ? "" : " open") + '><summary class="note" style="cursor:pointer">Advanced: helper address and integration token</summary>' +
        '<div class="frow" style="margin-top:8px"><label class="fld">Helper address<input id="notionHelper" data-pd="1" type="url" placeholder="https://daybook-helper.you.workers.dev" value="' + e(c.helperUrl || "") + '"></label>' +
        '<label class="fld">Integration token<input id="notionToken" type="password" autocomplete="off" placeholder="secret_… or ntn_…"></label></div>' +
        '<div class="btns" style="margin-top:8px"><button type="button" class="smallbtn" data-act="plug:notion:connect-token">Connect</button></div></details>';
      if (ST.msg) html += '<p class="warnnote" style="margin-top:8px">' + e(ST.msg) + "</p>";
      return html + note;
    }
    html += '<p class="note" style="margin-top:6px;font-size:13px">' + (c.workspace ? "Workspace: " + e(c.workspace) + ". " : "") + "</p>" +
      '<div class="btns" style="margin-top:6px;flex-wrap:wrap">' +
      (c.dbId ? '<button type="button" class="smallbtn" data-act="plug:notion:sync">Sync now</button>' : "") +
      '<button type="button" class="smallbtn" data-act="plug:notion:reload">Reload databases</button><button type="button" class="smallbtn" data-act="plug:notion:disconnect">Disconnect</button></div>';
    if (ST.msg) html += '<p class="warnnote" style="margin-top:8px">' + e(ST.msg) + "</p>";
    if (!ST.dbs) { html += '<p class="note" style="margin-top:8px;font-size:13px">Loading your databases…</p>'; if (ST.token && !ST.loading) { ST.loading = true; loadDatabases().then(function () { ST.loading = false; }); } return html + note; }
    if (!ST.dbs.length) return html + '<p class="warnnote" style="margin-top:8px">No databases are shared with Daybook. In Notion, open your tasks database, choose Connections, and add this integration. Then reload.</p>' + note;
    html += '<div class="frow" style="margin-top:12px"><label class="fld">Tasks database' +
      sel(e, "db", c.dbId || "", ST.dbs.map(function (d) { return { v: d.id, l: d.name }; }), "Choose a database…") + "</label></div>";
    if (c.dbId && ST.schema) {
      var dates = ST.schema.filter(function (p) { return p.type === "date"; }).map(function (p) { return { v: p.name, l: p.name }; });
      var dones = ST.schema.filter(function (p) { return p.type === "checkbox" || p.type === "status"; }).map(function (p) { return { v: p.name, l: p.name + " (" + p.type + ")" }; });
      var st = m.doneType === "status" ? ST.schema.filter(function (p) { return p.name === m.done; })[0] : null;
      html += '<div class="frow"><label class="fld">Date column' + sel(e, "date", m.date || "", dates, "None") + "</label>" +
        '<label class="fld">Done column' + sel(e, "done", m.done || "", dones, "None") + "</label></div>";
      if (st) {
        var opts = st.options.map(function (o) { return { v: o, l: o }; });
        html += '<div class="frow"><label class="fld">Done means' + sel(e, "doneValue", m.doneValue || "", opts) + "</label>" +
          '<label class="fld">Not done means' + sel(e, "todoValue", m.todoValue || "", opts) + "</label></div>";
      }
      html += '<div class="frow"><label class="fld">Show overdue for (days)<input data-plug="notion" data-field="days" data-pd="1" id="notionDays" type="number" min="1" max="365" value="' + Number(c.days || 30) + '"></label></div>';
    }
    return html + note;
  }

  function onAction(a, el) {
    if (a === "connect") connect();
    else if (a === "connect-token") {
      var t = document.getElementById("notionToken"), h = document.getElementById("notionHelper");
      connectToken(t && t.value, h && h.value);
    }
    else if (a === "disconnect") disconnect();
    else if (a === "sync") sync();
    else if (a === "reload") { ST.dbs = null; ST.loading = false; API.render(); }
  }

  function onChange(e) {
    var t = e.target, f = t.dataset.field, c = cfg();
    if (f === "db") { if (t.value) chooseDb(t.value); return; }
    if (f === "date") c.map.date = t.value;
    else if (f === "done") {
      c.map.done = t.value;
      var p = (ST.schema || []).filter(function (x) { return x.name === t.value; })[0];
      if (p && p.type === "checkbox") { c.map.doneType = "checkbox"; }
      else if (p && p.type === "status") {
        c.map.doneType = "status";
        var done = p.options.filter(function (n) { return /done|complete/i.test(n); })[0] || p.options[p.options.length - 1] || "";
        c.map.doneValue = done; c.map.todoValue = p.options.filter(function (n) { return n !== done; })[0] || "";
      }
    }
    else if (f === "doneValue") c.map.doneValue = t.value;
    else if (f === "todoValue") c.map.todoValue = t.value;
    else if (f === "days") c.days = Number(t.value) || 30;
    API.save(); sync();
  }

  async function init(api) {
    API = api;
    try { ST.token = (await API.idb.get("notion:token")) || ""; } catch (_) { ST.token = ""; }
    var returned = await finishOAuth();
    if (ST.token) {
      ST.status = "ok";
      if (cfg().dbId) { try { await loadSchema(); } catch (_) {} await sync(); }
      else if (returned) { await loadDatabases(); }
    }
    API.render();
  }

  Daybook.registerPlugin({
    id: "notion",
    name: "Notion",
    provides: ["Tasks"],
    desc: "Tasks from your own Notion database. Tick them off and add new ones from Daybook.",
    init: init,
    status: status,
    settings: settings,
    onAction: onAction,
    onChange: onChange,
    sync: sync,
    toggleTask: toggleTask,
    addTask: addTask,
    canAdd: function () { return !!(ST.token && cfg().dbId && cfg().map.title); }
  });

  // exposed for tests
  Daybook.notion = { toTask: toTask, autoMap: autoMap };
})();
