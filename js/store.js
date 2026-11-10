/*
 * Daybook local store.
 * A tiny document database kept in localStorage. It exposes the same small API the
 * app uses everywhere: collection(name).where(...).onSnapshot(cb), doc("col/id").set/update/delete.
 * Nothing here talks to a server.
 */
(function () {
  "use strict";

  function Query(db, col, filters) {
    this.db = db;
    this.col = col;
    this.filters = filters || [];
  }
  Query.prototype.where = function (field, op, value) {
    return new Query(this.db, this.col, this.filters.concat([[field, op, value]]));
  };
  Query.prototype.get = function () {
    return Promise.resolve(this.db._snap(this.col, this.filters));
  };
  Query.prototype.onSnapshot = function (cb) {
    var sub = { col: this.col, filters: this.filters, cb: cb };
    var db = this.db;
    db.subs.push(sub);
    setTimeout(function () { cb(db._snap(sub.col, sub.filters)); }, 0);
    return function () { db.subs = db.subs.filter(function (x) { return x !== sub; }); };
  };

  function LocalDB(key) {
    this.key = key || "daybook:data:v1";
    this.subs = [];
    this.data = {};
    this._t = null;
    this.onError = null;
    try { this.data = JSON.parse(localStorage.getItem(this.key) || "{}") || {}; } catch (_) { this.data = {}; }
  }

  LocalDB.prototype._snap = function (col, filters) {
    var m = this.data[col] || {};
    var docs = Object.keys(m)
      .filter(function (id) {
        return filters.every(function (f) {
          var x = m[id][f[0]], v = f[2];
          switch (f[1]) {
            case ">=": return x >= v;
            case "<=": return x <= v;
            case ">": return x > v;
            case "<": return x < v;
            default: return x === v;
          }
        });
      })
      .map(function (id) {
        return { id: id, data: function () { return JSON.parse(JSON.stringify(m[id])); } };
      });
    return { docs: docs };
  };

  LocalDB.prototype._persist = function () {
    var self = this;
    clearTimeout(this._t);
    this._t = setTimeout(function () {
      try { localStorage.setItem(self.key, JSON.stringify(self.data)); }
      catch (e) { if (self.onError) self.onError(e); }
    }, 50);
  };

  LocalDB.prototype._changed = function (col) {
    var self = this;
    this._persist();
    this.subs.filter(function (s) { return s.col === col; })
      .forEach(function (s) { s.cb(self._snap(s.col, s.filters)); });
  };

  LocalDB.prototype.collection = function (name) { return new Query(this, name, []); };

  LocalDB.prototype.doc = function (path) {
    var i = path.indexOf("/"), col = path.slice(0, i), id = path.slice(i + 1), db = this;
    return {
      get: function () {
        var d = (db.data[col] || {})[id];
        return Promise.resolve({ exists: !!d, id: id, data: function () { return d ? JSON.parse(JSON.stringify(d)) : undefined; } });
      },
      set: function (v) {
        (db.data[col] = db.data[col] || {})[id] = JSON.parse(JSON.stringify(v));
        db._changed(col);
        return Promise.resolve();
      },
      update: function (v) {
        var m = (db.data[col] = db.data[col] || {});
        m[id] = Object.assign({}, m[id] || {}, JSON.parse(JSON.stringify(v)));
        db._changed(col);
        return Promise.resolve();
      },
      delete: function () {
        if (db.data[col]) delete db.data[col][id];
        db._changed(col);
        return Promise.resolve();
      }
    };
  };

  LocalDB.prototype.importJSON = function (txt) {
    var o = JSON.parse(txt);
    if (!o || o.app !== "daybook" || typeof o.data !== "object") throw new Error("This file isn't a Daybook backup.");
    var old = Object.keys(this.data);
    this.data = o.data;
    localStorage.setItem(this.key, JSON.stringify(this.data));
    var self = this;
    old.concat(Object.keys(this.data)).filter(function (c, i, a) { return a.indexOf(c) === i; })
      .forEach(function (c) { self._changed(c); });
  };

  LocalDB.prototype.clearAll = function () {
    var cols = Object.keys(this.data);
    this.data = {};
    localStorage.setItem(this.key, "{}");
    var self = this;
    cols.forEach(function (c) { self._changed(c); });
  };

  window.LocalDB = LocalDB;
})();
