/* ============================================================
   PromptReel — i18n.js
   Tiny dictionary-based i18n with RTL handling.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};

  var dicts = {};
  var current = 'en';
  var CODES = ['ar', 'en', 'fr'];

  function add(code, dict) {
    dicts[code] = deepMerge(dicts[code] || {}, dict);
  }

  function deepMerge(base, extra) {
    var out = Object.assign({}, base);
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  function lookup(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : null;
  }

  function t(path) {
    var v = lookup(dicts[current], path);
    if (v == null) v = lookup(dicts.en, path);
    return v == null ? path : v;
  }

  function setLang(code) {
    current = CODES.indexOf(code) !== -1 ? code : 'en';
    var html = document.documentElement;
    html.setAttribute('lang', current);
    html.setAttribute('dir', current === 'ar' ? 'rtl' : 'ltr');
  }

  function getLang() { return current; }

  function applyStatic(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var s = t(nodes[i].getAttribute('data-i18n'));
      if (s && s !== nodes[i].getAttribute('data-i18n')) nodes[i].textContent = s;
    }
    var ph = scope.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < ph.length; j++) {
      var p = t(ph[j].getAttribute('data-i18n-ph'));
      if (p && p !== ph[j].getAttribute('data-i18n-ph')) ph[j].setAttribute('placeholder', p);
    }
    var title = lookup(dicts[current], 'meta.title');
    if (title) document.title = title;
  }

  PR.i18n = {
    add: add,
    t: t,
    setLang: setLang,
    getLang: getLang,
    applyStatic: applyStatic,
    codes: CODES,
    LANG_NAMES: { ar: 'العربية', en: 'English', fr: 'Français' }
  };
})();
