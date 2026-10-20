/* ============================================================
   PromptReel — main.js
   Boot, hash router, header chrome (lang/theme), i18n apply.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};

  var ROUTES = {
    '#/': 'landing',
    '#/studio': 'studio',
    '#/projects': 'projects',
    '#/settings': 'settings'
  };

  function currentRoute() {
    var h = window.location.hash || '#/';
    return ROUTES[h] ? h : '#/';
  }

  function markNav(hash) {
    var links = document.querySelectorAll('.main-nav a[data-route]');
    Array.prototype.forEach.call(links, function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === hash);
    });
  }

  function render() {
    var hash = currentRoute();
    var view = PR.views[ROUTES[hash]];
    var old = document.getElementById('app');
    if (!view || !old) return;
    // Swap in a pristine clone so per-view listeners never accumulate
    // across route changes (cloneNode(false) keeps id/class/attrs).
    var fresh = old.cloneNode(false);
    fresh.innerHTML = '';
    old.parentNode.replaceChild(fresh, old);
    view.mount(fresh);
    PR.i18n.applyStatic(fresh);
    markNav(hash);
    window.scrollTo(0, 0);
  }

  function detectLang() {
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      var l = String(langs[i] || '').toLowerCase();
      if (l.indexOf('ar') === 0) return 'ar';
      if (l.indexOf('fr') === 0) return 'fr';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'ar';
  }

  function buildLangSelect(value) {
    var sel = document.getElementById('lang-select');
    if (!sel) return;
    sel.innerHTML = PR.i18n.codes.map(function (c) {
      return '<option value="' + c + '"' + (c === value ? ' selected' : '') + '>' + PR.i18n.LANG_NAMES[c] + '</option>';
    }).join('');
  }

  function themeIcon(theme) {
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = PR.ui.icon(theme === 'dark' ? 'sun' : 'moon');
  }

  function syncHeader() {
    var s = PR.store.getSettings();
    buildLangSelect(PR.i18n.getLang());
    themeIcon(s.theme || 'dark');
  }

  function boot() {
    var s = PR.store.getSettings();
    var lang = s.lang || detectLang();

    PR.i18n.setLang(lang);
    document.documentElement.setAttribute('data-theme', s.theme === 'light' ? 'light' : 'dark');

    buildLangSelect(PR.i18n.getLang());
    themeIcon(s.theme || 'dark');

    var sel = document.getElementById('lang-select');
    if (sel) {
      sel.addEventListener('change', function () {
        PR.store.saveSettings({ lang: sel.value });
        PR.i18n.setLang(sel.value);
        PR.i18n.applyStatic(document);
        render();
      });
    }

    var tt = document.getElementById('theme-toggle');
    if (tt) {
      tt.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        PR.store.saveSettings({ theme: next });
        themeIcon(next);
      });
    }

    var year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());

    window.addEventListener('hashchange', render);
    PR.rerender = render;
    PR.syncHeader = syncHeader;

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
