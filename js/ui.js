/* ============================================================
   PromptReel — ui.js
   Escaping, icons, toasts, clipboard, modal, formatters.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};

  var I = {
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L6.5 9.5M12 4l5.5 5.5M4 20h16"/></svg>',
    film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7.5 5v14M16.5 5v14M3 10h4.5M3 14h4.5M16.5 10H21M16.5 14H21"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.3 7.2 7.2 2.3-7.2 2.3L12 21.5l-2.3-7.2-7.2-2.3 7.2-2.3L12 2.5z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L20 6.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.1 8.1 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h9M17.5 7H20M4 12h3M11.5 12H20M4 17h12M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17.5" cy="17" r="2"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5L21.5 20h-19L12 3.5z"/><path d="M12 10v4.5M12 17.6v.1"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5c1.7 0 3.2.5 4.5 1.2M21.5 12S18 18.5 12 18.5c-1.7 0-3.2-.5-4.5-1.2"/><path d="M4 4l16 16"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4l2 2.5h7A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10z"/></svg>'
  };

  function icon(name) { return I[name] || ''; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, type) {
    var root = document.getElementById('toasts');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 3400);
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    if (ta.parentNode) ta.parentNode.removeChild(ta);
    return ok;
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () {
        toast(PR.i18n.t('msg.copied'), 'ok');
        return true;
      }, function () {
        return Promise.resolve(legacyFeedback(legacyCopy(text)));
      });
    }
    return Promise.resolve(legacyFeedback(legacyCopy(text)));
  }

  function legacyFeedback(ok) {
    if (ok) toast(PR.i18n.t('msg.copied'), 'ok');
    else toast(PR.i18n.t('msg.copy_fail'), 'err');
    return ok;
  }

  function confirmModal(message) {
    return new Promise(function (resolve) {
      var t = PR.i18n.t;
      var root = document.getElementById('modal-root');
      var wrap = document.createElement('div');
      wrap.className = 'modal-overlay';
      wrap.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
          '<p class="modal-msg">' + esc(message) + '</p>' +
          '<div class="modal-actions">' +
            '<button class="btn btn-ghost" data-act="no">' + esc(t('dlg.cancel')) + '</button>' +
            '<button class="btn btn-danger" data-act="yes">' + esc(t('dlg.delete')) + '</button>' +
          '</div>' +
        '</div>';
      function close(yes) {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        document.removeEventListener('keydown', onKey);
        resolve(yes);
      }
      function onKey(e) { if (e.key === 'Escape') close(false); }
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap) { close(false); return; }
        var b = e.target.closest ? e.target.closest('[data-act]') : null;
        if (b) close(b.getAttribute('data-act') === 'yes');
      });
      document.addEventListener('keydown', onKey);
      root.appendChild(wrap);
      var yesBtn = wrap.querySelector('[data-act="yes"]');
      if (yesBtn) yesBtn.focus();
    });
  }

  function fmtBytes(n) {
    if (n == null || isNaN(n)) return '';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0, v = Number(n);
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return (i === 0 ? v : v.toFixed(1)) + ' ' + units[i];
  }

  function fmtDate(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return ''; }
  }

  PR.ui = {
    icon: icon,
    esc: esc,
    toast: toast,
    copy: copy,
    confirmModal: confirmModal,
    fmtBytes: fmtBytes,
    fmtDate: fmtDate
  };
})();
