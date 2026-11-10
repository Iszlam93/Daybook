/*
 * Daybook plug-in: Calendar files and links (ICS)
 * Works with any calendar that can export or share an .ics file: Google, Outlook, Apple, Fastmail.
 *
 * - Upload a .ics file (always works, stored in this browser).
 * - Or paste a calendar link. Many calendars block direct loading from a web page, so
 *   if the link fails, download the file and upload it instead.
 *
 * Supports recurring events (DAILY, WEEKLY, MONTHLY, YEARLY with INTERVAL, COUNT, UNTIL,
 * BYDAY, BYMONTHDAY), EXDATE, time zones and all-day events.
 */
(function () {
  "use strict";
  var API = null;
  var ST = { status: "off", msg: "", count: 0, busy: false };
  var WINDOW_BACK = 30, WINDOW_FWD = 93;
  var DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  var cfg = function () {
    var c = API.config("ics");
    if (!Array.isArray(c.sources)) c.sources = [];
    return c;
  };

  /* ---------- parsing ---------- */
  function unfold(t) { return t.replace(/\r?\n[ \t]/g, ""); }
  function unesc(v) { return String(v || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"); }

  function zoned(y, mo, d, h, mi, s, tz) {
    var target = Date.UTC(y, mo - 1, d, h, mi, s), utc = target;
    try {
      var f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      for (var i = 0; i < 2; i++) {
        var p = {}; f.formatToParts(new Date(utc)).forEach(function (x) { p[x.type] = x.value; });
        var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
        utc -= asUTC - target;
      }
      return new Date(utc);
    } catch (_) { return new Date(y, mo - 1, d, h, mi, s); }
  }

  function dt(val, P) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(val.trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (P.VALUE === "DATE" || m[4] === undefined) return { d: new Date(y, mo - 1, d), allDay: true };
    var h = +m[4], mi = +m[5], s = +(m[6] || 0);
    if (m[7]) return { d: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false };
    if (P.TZID) return { d: zoned(y, mo, d, h, mi, s, P.TZID), allDay: false };
    return { d: new Date(y, mo - 1, d, h, mi, s), allDay: false };
  }

  function parseICS(text) {
    var lines = unfold(text).split(/\r?\n/), evs = [], cur = null;
    lines.forEach(function (ln) {
      if (ln === "BEGIN:VEVENT") { cur = { ex: [] }; return; }
      if (ln === "END:VEVENT") { if (cur && cur.start) evs.push(cur); cur = null; return; }
      if (!cur) return;
      var i = ln.indexOf(":"); if (i < 0) return;
      var head = ln.slice(0, i), val = ln.slice(i + 1), parts = head.split(";"), name = parts[0].toUpperCase(), P = {};
      parts.slice(1).forEach(function (p) { var kv = p.split("="); P[kv[0].toUpperCase()] = (kv[1] || "").replace(/"/g, ""); });
      switch (name) {
        case "SUMMARY": cur.title = unesc(val); break;
        case "DESCRIPTION": cur.desc = unesc(val); break;
        case "LOCATION": cur.loc = unesc(val); break;
        case "URL": cur.url = val; break;
        case "UID": cur.uid = val; break;
        case "DTSTART": cur.start = dt(val, P); break;
        case "DTEND": cur.end = dt(val, P); break;
        case "RRULE": cur.rrule = val; break;
        case "STATUS": cur.status = val; break;
        case "RECURRENCE-ID": cur.recId = dt(val, P); break;
        case "EXDATE": val.split(",").forEach(function (v) { var x = dt(v, P); if (x) cur.ex.push(x.d.getTime()); }); break;
      }
    });
    // an edited single occurrence replaces the original one
    evs.forEach(function (o) {
      if (!o.recId) return;
      evs.forEach(function (b) { if (b !== o && b.uid && b.uid === o.uid && b.rrule) b.ex.push(o.recId.d.getTime()); });
    });
    return evs;
  }

  function parseRule(s) {
    var r = {};
    s.split(";").forEach(function (kv) { var p = kv.split("="); r[p[0].toUpperCase()] = p[1]; });
    r.interval = Math.max(1, Number(r.INTERVAL) || 1);
    r.count = r.COUNT ? Number(r.COUNT) : 0;
    if (r.UNTIL) { var u = dt(r.UNTIL, {}); r.until = u ? u.d.getTime() + (u.allDay ? 86399000 : 0) : 0; }
    r.byday = r.BYDAY ? r.BYDAY.split(",").map(function (x) { var m = /^([+-]?\d)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? Number(m[1]) : 0, d: DAYS.indexOf(m[2]) } : null; }).filter(Boolean) : [];
    r.bymonthday = r.BYMONTHDAY ? r.BYMONTHDAY.split(",").map(Number) : [];
    return r;
  }

  function sameTimeOn(base, y, m, d) {
    return new Date(y, m, d, base.getHours(), base.getMinutes(), base.getSeconds());
  }

  function nthWeekday(y, m, wd, n) {
    if (n > 0) { var first = new Date(y, m, 1), off = (wd - first.getDay() + 7) % 7; return new Date(y, m, 1 + off + (n - 1) * 7); }
    var last = new Date(y, m + 1, 0), back = (last.getDay() - wd + 7) % 7; return new Date(y, m + 1, 0 - back + (n + 1) * 7);
  }

  function occurrences(ev, from, to) {
    var s = ev.start.d, out = [];
    if (!ev.rrule) return [s];
    var r = parseRule(ev.rrule), count = 0, guard = 0, cap = 4000;
    var push = function (d) {
      if (d < s) return true;
      count++;
      if (r.count && count > r.count) return false;
      if (r.until && d.getTime() > r.until) return false;
      if (d > to) return false;
      if (d >= from || (ev.end && ev.end.d && (d.getTime() + (ev.end.d - s)) >= from.getTime())) out.push(d);
      return true;
    };
    var freq = r.FREQ;
    if (freq === "DAILY") {
      for (var d = new Date(s); guard++ < cap; d = sameTimeOn(s, d.getFullYear(), d.getMonth(), d.getDate() + r.interval)) if (!push(new Date(d))) break;
    } else if (freq === "WEEKLY") {
      var days = r.byday.length ? r.byday.map(function (x) { return x.d; }) : [s.getDay()];
      var wkStart = new Date(s.getFullYear(), s.getMonth(), s.getDate() - s.getDay());
      for (var w = 0; guard++ < cap; w++) {
        var ok = true;
        for (var k = 0; k < 7; k++) {
          var dd = sameTimeOn(s, wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate() + w * 7 * r.interval + k);
          if (days.indexOf(dd.getDay()) < 0) continue;
          if (!push(dd)) { ok = false; break; }
        }
        if (!ok) break;
      }
    } else if (freq === "MONTHLY") {
      for (var mo = 0; guard++ < cap; mo += r.interval) {
        var y = s.getFullYear(), m0 = s.getMonth() + mo, cands = [];
        if (r.byday.length) r.byday.forEach(function (b) { if (b.n) cands.push(sameTimeOn(s, nthWeekday(y, m0, b.d, b.n).getFullYear(), nthWeekday(y, m0, b.d, b.n).getMonth(), nthWeekday(y, m0, b.d, b.n).getDate())); });
        else (r.bymonthday.length ? r.bymonthday : [s.getDate()]).forEach(function (md) {
          var c = sameTimeOn(s, y, m0, md); if (c.getDate() === md) cands.push(c);
        });
        cands.sort(function (a, b) { return a - b; });
        var stop = false;
        for (var c = 0; c < cands.length; c++) if (!push(cands[c])) { stop = true; break; }
        if (stop) break;
      }
    } else if (freq === "YEARLY") {
      for (var yy = 0; guard++ < cap; yy += r.interval) if (!push(sameTimeOn(s, s.getFullYear() + yy, s.getMonth(), s.getDate()))) break;
    } else out.push(s);
    return out;
  }

  var MEETING_URL = /(https?:\/\/[^\s<>"]*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com)[^\s<>"]*)/i;
  var ANY_URL = /(https?:\/\/[^\s<>"]+)/i;
  var iso = function (d) { return d.getFullYear() + "-" + API.pad(d.getMonth() + 1) + "-" + API.pad(d.getDate()); };
  var hm = function (d) { return API.pad(d.getHours()) + ":" + API.pad(d.getMinutes()); };

  function toEvents(evs, srcName) {
    var from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - WINDOW_BACK);
    var to = new Date(); to.setHours(23, 59, 59, 0); to.setDate(to.getDate() + WINDOW_FWD);
    var out = [];
    evs.forEach(function (ev) {
      if (ev.status === "CANCELLED" || !ev.start) return;
      var dur = ev.end && ev.end.d ? ev.end.d - ev.start.d : (ev.start.allDay ? 86400000 : 0);
      var text = (ev.desc || "") + " " + (ev.loc || "");
      var join = (MEETING_URL.exec(text) || [])[1] || (MEETING_URL.exec(ev.url || "") || [])[1] || "";
      var link = ev.url || (ANY_URL.exec(text) || [])[1] || "";
      occurrences(ev, from, to).forEach(function (s) {
        if (ev.ex.indexOf(s.getTime()) >= 0) return;
        var base = { title: ev.title || "(busy)", src: srcName, url: link, join: join, meeting: API.looksLikeMeeting((ev.title || "") + " " + (ev.desc || "").slice(0, 300)) || !!join };
        if (ev.start.allDay) {
          var days = Math.max(1, Math.round(dur / 86400000));
          for (var k = 0; k < Math.min(days, 14); k++) {
            var d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + k);
            if (d < from || d > to) continue;
            out.push(Object.assign({ id: (ev.uid || ev.title) + "_" + iso(d), date: iso(d), allDay: true, time: "", endTime: "", startMs: +d, endMs: +d + 86400000 }, base));
          }
        } else {
          var e = new Date(s.getTime() + dur);
          out.push(Object.assign({ id: (ev.uid || ev.title) + "_" + s.getTime(), date: iso(s), time: hm(s), endTime: dur ? hm(e) : "", allDay: false, startMs: s.getTime(), endMs: dur ? e.getTime() : 0 }, base));
        }
      });
    });
    return out;
  }

  /* ---------- sources ---------- */
  var newId = function () { return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); };

  async function load(src) {
    if (src.url) {
      try {
        var res = await fetch(src.url.replace(/^webcal:/i, "https:"), { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var txt = await res.text();
        if (txt.indexOf("BEGIN:VCALENDAR") < 0) throw new Error("not a calendar");
        try { await API.idb.set("ics:" + src.id, txt); } catch (_) {}
        return txt;
      } catch (e) {
        var cached = null; try { cached = await API.idb.get("ics:" + src.id); } catch (_) {}
        if (cached) return cached;
        throw new Error("Couldn't load " + src.name + " directly. Many calendars block this. Download the .ics file and upload it instead.");
      }
    }
    var t = await API.idb.get("ics:" + src.id);
    if (!t) throw new Error("The file for " + src.name + " is missing. Upload it again.");
    return t;
  }

  async function sync() {
    if (ST.busy) return;
    var c = cfg();
    if (!c.sources.length) { ST.status = "off"; API.setEvents("ics", []); return; }
    ST.busy = true; ST.status = "syncing"; API.render();
    var all = [], errs = [];
    for (var i = 0; i < c.sources.length; i++) {
      try { all = all.concat(toEvents(parseICS(await load(c.sources[i])), c.sources[i].name)); }
      catch (e) { errs.push((e && e.message) || "Problem with " + c.sources[i].name); }
    }
    ST.count = all.length; ST.msg = errs.join(" "); ST.status = errs.length && !all.length ? "error" : "ok";
    ST.busy = false;
    API.setEvents("ics", all);
  }

  async function addFile(file) {
    var text = await file.text();
    if (text.indexOf("BEGIN:VCALENDAR") < 0) { API.toast("That doesn't look like a calendar file."); return; }
    var c = cfg(), id = newId();
    try { await API.idb.set("ics:" + id, text); } catch (e) { API.toast("Couldn't store that file in this browser."); return; }
    c.sources.push({ id: id, name: file.name.replace(/\.ics$/i, ""), url: "" });
    API.save(); API.toast("Calendar added"); sync();
  }

  function addUrl(url) {
    url = String(url || "").trim();
    if (!/^(https?|webcal):\/\//i.test(url)) { API.toast("Paste a link that starts with https://"); return; }
    var c = cfg(), id = newId(), host = "";
    try { host = new URL(url.replace(/^webcal:/i, "https:")).hostname; } catch (_) {}
    c.sources.push({ id: id, name: host || "Calendar link", url: url });
    API.save(); API.toast("Calendar added"); sync();
  }

  async function remove(id) {
    var c = cfg(); c.sources = c.sources.filter(function (s) { return s.id !== id; });
    try { await API.idb.del("ics:" + id); } catch (_) {}
    API.save(); sync();
  }

  /* ---------- plug-in surface ---------- */
  function status() {
    if (ST.status === "ok") return { state: "ok", text: "Connected, " + ST.count + " event" + (ST.count === 1 ? "" : "s") };
    if (ST.status === "syncing") return { state: "busy", text: "Loading calendars" };
    if (ST.status === "error") return { state: "error", text: "Problem" };
    return { state: "off", text: "No calendars yet" };
  }

  function settings(api) {
    var e = api.esc, c = cfg();
    var rows = c.sources.map(function (s) {
      return '<div class="tr" style="padding:6px 0"><span class="grow">' + e(s.name) + '<span class="num"> ' + (s.url ? "link" : "file") + '</span></span>' +
        '<button type="button" class="smallbtn" data-act="plug:ics:remove" data-id="' + e(s.id) + '">Remove</button></div>';
    }).join("");
    return (rows ? '<div class="tbl" style="margin-top:8px">' + rows + "</div>" : "") +
      '<div class="btns" style="margin-top:10px;flex-wrap:wrap;align-items:center"><label class="pill sm pri" style="position:relative;display:inline-flex;align-items:center;cursor:pointer">Upload .ics file<input class="sr" type="file" accept=".ics,text/calendar" data-plug="ics" data-field="file"></label>' +
      (c.sources.length ? '<button type="button" class="smallbtn" data-act="plug:ics:sync">Reload</button>' : "") + "</div>" +
      '<div class="frow" style="margin-top:10px"><label class="fld" style="flex:2 1 240px">Or a calendar link<input id="icsUrl" type="url" data-plug="ics" data-field="url" data-pd="1" placeholder="https://… or webcal://…"></label>' +
      '<button type="button" class="smallbtn" style="align-self:flex-end;min-height:42px" data-act="plug:ics:addurl">Add link</button></div>' +
      (ST.msg ? '<p class="warnnote" style="margin-top:8px">' + e(ST.msg) + "</p>" : "") +
      '<p class="note" style="margin-top:8px;font-size:13px">Export from Google Calendar (Settings, Import and export), Outlook (Publish calendar) or Apple Calendar (File, Export). Files are stored only in this browser.</p>';
  }

  Daybook.registerPlugin({
    id: "ics",
    name: "Calendar files and links",
    provides: ["Events"],
    desc: "Events from any .ics file or calendar link: Google, Outlook, Apple and more.",
    init: function (api) { API = api; return sync(); },
    status: status,
    settings: settings,
    sync: sync,
    onAction: function (a, el) {
      if (a === "remove") remove(el.dataset.id);
      else if (a === "sync") sync();
      else if (a === "addurl") { var i = document.getElementById("icsUrl"); if (i) { addUrl(i.value); } }
    },
    onChange: function (e) {
      var t = e.target;
      if (t.dataset.field === "file" && t.files && t.files[0]) { addFile(t.files[0]).catch(function () { API.toast("Couldn't read that file."); }); t.value = ""; }
      else if (t.dataset.field === "url" && t.value.trim()) addUrl(t.value);
    }
  });

  // exposed for tests
  Daybook.ics = { parseICS: parseICS, toEvents: toEvents };
})();
