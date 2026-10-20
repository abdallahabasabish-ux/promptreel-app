/* ============================================================
   PromptReel — store.js
   localStorage wrapper with in-memory fallback.
   Stores: settings (key/model/lang/theme) + projects.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};

  var SKEY = 'pr.settings.v1';
  var PKEY = 'pr.projects.v1';
  var MAX_PROJECTS = 30;
  var memory = {};

  function lsGet(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null; }
  }
  function lsSet(k, v) {
    try { window.localStorage.setItem(k, v); return true; } catch (e) { memory[k] = v; return false; }
  }
  function lsDel(k) {
    try { window.localStorage.removeItem(k); } catch (e) { /* noop */ }
    delete memory[k];
  }

  var DEFAULTS = {
    apiKey: '',
    model: 'gemini-2.5-flash',
    lang: '',            // '' = auto-detect
    dlgLang: 'ar',       // dialogue language default
    theme: 'dark'
  };

  function getSettings() {
    var raw = lsGet(SKEY);
    var obj = {};
    if (raw) { try { obj = JSON.parse(raw) || {}; } catch (e) { obj = {}; } }
    return Object.assign({}, DEFAULTS, obj);
  }

  function saveSettings(patch) {
    var next = Object.assign(getSettings(), patch || {});
    lsSet(SKEY, JSON.stringify(next));
    return next;
  }

  function listProjects() {
    var raw = lsGet(PKEY);
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveProject(p) {
    var arr = listProjects();
    arr.unshift(p);
    if (arr.length > MAX_PROJECTS) arr = arr.slice(0, MAX_PROJECTS);
    var ok = lsSet(PKEY, JSON.stringify(arr));
    if (!ok) {
      // quota trouble: drop thumbnails first, then keep newest 10
      var slim = arr.map(function (x) {
        var c = Object.assign({}, x);
        c.thumb = null;
        return c;
      });
      if (!lsSet(PKEY, JSON.stringify(slim))) {
        lsSet(PKEY, JSON.stringify(slim.slice(0, 10)));
      }
    }
    return p;
  }

  function removeProject(id) {
    var arr = listProjects().filter(function (p) { return p.id !== id; });
    lsSet(PKEY, JSON.stringify(arr));
  }

  function clearAll() {
    lsDel(PKEY);
    lsDel(SKEY);
  }

  PR.store = {
    DEFAULTS: DEFAULTS,
    getSettings: getSettings,
    saveSettings: saveSettings,
    listProjects: listProjects,
    saveProject: saveProject,
    removeProject: removeProject,
    clearAll: clearAll
  };
})();
