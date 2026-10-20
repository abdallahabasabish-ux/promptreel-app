/* ============================================================
   PromptReel — views/projects.js
   Saved stories (localStorage) with viewer modal.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};
  PR.views = PR.views || {};

  function t() { return PR.i18n.t; }

  function projCard(p) {
    var ui = PR.ui;
    var tt = t();
    var thumb = p.thumb
      ? '<img class="proj-thumb" alt="" src="' + p.thumb + '">'
      : '<div class="proj-thumb-empty">' + ui.icon('film') + '</div>';
    return '<article class="proj-card" data-id="' + ui.esc(p.id) + '">' +
      thumb +
      '<div class="proj-body">' +
        '<h3 class="proj-title">' + ui.esc(p.project_title) + '</h3>' +
        '<div class="proj-meta">' +
          '<span class="badge badge-accent">' + ui.esc(tt('proj.count')) + '</span>' +
          '<span class="badge">~' + p.total_duration_seconds + ui.esc(tt('res.sec')) + '</span>' +
          '<span class="badge">' + ui.esc(PR.scenes.langName(p.dialogue_language)) + '</span>' +
        '</div>' +
        '<p class="muted" style="font-size:12px;margin:0">' + ui.esc(ui.fmtDate(p.createdAt)) + '</p>' +
        '<div class="proj-actions">' +
          '<button class="btn btn-ghost btn-sm" data-open>' + ui.icon('folder') + '<span>' + ui.esc(tt('proj.open')) + '</span></button>' +
          '<button class="icon-btn delete" data-del aria-label="' + ui.esc(tt('proj.del')) + '" title="' + ui.esc(tt('proj.del')) + '">' + ui.icon('trash') + '</button>' +
        '</div>' +
      '</div>' +
      '</article>';
  }

  function html(arr) {
    var tt = t();
    var ui = PR.ui;
    var head = '<h1 class="view-title">' + ui.esc(tt('proj.title')) + '</h1>' +
      '<p class="view-sub">' + ui.esc(tt('proj.sub')) + '</p>';
    if (!arr.length) {
      return head + '<div class="empty-state">' +
        ui.icon('folder') +
        '<h3>' + ui.esc(tt('proj.empty_t')) + '</h3>' +
        '<p>' + ui.esc(tt('proj.empty_sub')) + '</p>' +
        '<a class="btn btn-primary" href="#/studio">' + ui.icon('spark') + '<span>' + ui.esc(tt('cta.start')) + '</span></a>' +
        '</div>';
    }
    return head + '<div class="proj-grid">' + arr.map(projCard).join('') + '</div>';
  }

  function openViewer(p) {
    var tt = t();
    var ui = PR.ui;
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal modal-wide" role="dialog" aria-modal="true">' +
      '<div class="modal-head">' +
        '<h2>' + ui.esc(p.project_title) + '</h2>' +
        '<button class="icon-btn" data-close aria-label="' + ui.esc(tt('aria.close')) + '">' + ui.icon('x') + '</button>' +
      '</div>' +
      '<div data-viewer></div>' +
      '</div>';

    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
      if (e.target.closest && e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', onKey);
    document.getElementById('modal-root').appendChild(overlay);
    PR.views.result.render(overlay.querySelector('[data-viewer]'), p, { readonly: true });
  }

  PR.views.projects = {
    mount: function (root) {
      var arr = PR.store.listProjects();
      root.innerHTML = html(arr);

      root.addEventListener('click', function (e) {
        var card = e.target.closest ? e.target.closest('.proj-card') : null;
        if (!card) return;
        var id = card.getAttribute('data-id');
        var p = PR.store.listProjects().filter(function (x) { return x.id === id; })[0];
        if (!p) return;

        if (e.target.closest && e.target.closest('[data-open]')) {
          openViewer(p);
        } else if (e.target.closest && e.target.closest('[data-del]')) {
          PR.ui.confirmModal(t()('proj.confirm')).then(function (yes) {
            if (!yes) return;
            PR.store.removeProject(id);
            PR.ui.toast(t()('msg.deleted'), 'ok');
            PR.rerender();
          });
        }
      });
    }
  };
})();
