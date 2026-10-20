/* ============================================================
   PromptReel — views/result.js
   Shared renderer for a finished project (studio + projects
   viewer). Copy buttons read from the project object, so no
   text is embedded in HTML attributes.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};
  PR.views = PR.views || {};

  function badge(text, cls) {
    return '<span class="badge' + (cls ? ' ' + cls : '') + '">' + PR.ui.esc(text) + '</span>';
  }

  function headHtml(p) {
    var t = PR.i18n.t;
    var meta = [];
    meta.push(badge(PR.i18n.t('res.total') + ': ~' + p.total_duration_seconds + PR.i18n.t('res.sec'), 'badge-accent'));
    meta.push(badge(PR.i18n.t('res.format') + ': ' + (p.aspect_ratio || '9:16')));
    meta.push(badge(PR.i18n.t('res.language') + ': ' + PR.scenes.langName(p.dialogue_language)));
    if (p.model) meta.push(badge(PR.i18n.t('res.model') + ': ' + p.model));
    if (p.channel_name) meta.push(badge(p.channel_name));
    return '<div class="result-head">' +
      '<p class="result-kicker">' + PR.ui.esc(t('res.kicker')) + '</p>' +
      '<h2 class="result-title">' + PR.ui.esc(p.project_title) + '</h2>' +
      (p.logline ? '<p class="result-logline">' + PR.ui.esc(p.logline) + '</p>' : '') +
      '<div class="result-meta">' + meta.join('') + '</div>' +
      '</div>';
  }

  function castHtml(p) {
    if (!p.character_bible || !p.character_bible.length) return '';
    var t = PR.i18n.t;
    return '<details class="cast-block">' +
      '<summary>' + PR.ui.esc(t('res.cast')) + '</summary>' +
      '<ul>' + p.character_bible.map(function (c) {
        return '<li><b>' + PR.ui.esc(c.character_id || '') + '</b> — ' + PR.ui.esc(c.description) + '</li>';
      }).join('') + '</ul>' +
      '</details>';
  }

  function sceneCard(p, s) {
    var t = PR.i18n.t;
    var ui = PR.ui;
    var dlgDir = p.dialogue_language === 'ar' ? 'rtl' : 'ltr';
    return '<article class="scene-card" data-scene="' + s.scene_number + '">' +
      '<header class="scene-head">' +
        '<span class="scene-no"><span class="n">' + s.scene_number + '</span>' + ui.esc(t('res.scene')) + '</span>' +
        '<span class="badge">' + s.duration_seconds + ui.esc(t('res.sec')) + '</span>' +
      '</header>' +
      (s.scene_title ? '<p class="scene-title-text">' + ui.esc(s.scene_title) + '</p>' : '') +
      '<div class="prompt-block">' +
        '<div class="pb-head"><span class="pb-label">' + ui.esc(t('res.image_prompt')) + '</span>' +
          '<button class="copy-btn" data-copy-scene="' + s.scene_number + '" data-field="image_prompt" aria-label="' + ui.esc(t('aria.copy')) + '">' + ui.icon('copy') + '</button></div>' +
        '<p class="prompt-text">' + ui.esc(s.image_prompt) + '</p>' +
      '</div>' +
      '<div class="prompt-block">' +
        '<div class="pb-head"><span class="pb-label">' + ui.esc(t('res.video_prompt')) + '</span>' +
          '<button class="copy-btn" data-copy-scene="' + s.scene_number + '" data-field="video_prompt" aria-label="' + ui.esc(t('aria.copy')) + '">' + ui.icon('copy') + '</button></div>' +
        '<p class="prompt-text">' + ui.esc(s.video_prompt) + '</p>' +
      '</div>' +
      '<div class="dialogue-block">' +
        '<div class="pb-head"><span class="pb-label">' + ui.esc(t('res.dialogue')) + '</span>' +
          '<button class="copy-btn" data-copy-scene="' + s.scene_number + '" data-field="spoken_dialogue" aria-label="' + ui.esc(t('aria.copy')) + '">' + ui.icon('copy') + '</button></div>' +
        '<p class="dialogue-line" dir="' + dlgDir + '">' + ui.esc(s.spoken_dialogue) + '</p>' +
      '</div>' +
      (s.transition ? '<p class="transition-note"><b>' + ui.esc(t('res.transition')) + ':</b> ' + ui.esc(s.transition) + '</p>' : '') +
      '</article>';
  }

  function actionsHtml(p, actions) {
    var t = PR.i18n.t;
    var ui = PR.ui;
    var flow = [];
    if (actions && actions.onRegenerate) {
      flow.push('<button class="btn btn-primary" data-act="regen">' + ui.icon('spark') + '<span>' + ui.esc(t('gen.regen')) + '</span></button>');
    }
    if (actions && actions.onNew) {
      flow.push('<button class="btn btn-ghost" data-act="new">' + ui.esc(t('res.new')) + '</button>');
    }
    var tools =
      '<button class="btn btn-ghost btn-sm" data-act="copyall">' + ui.icon('copy') + '<span>' + ui.esc(t('res.copy_all')) + '</span></button>' +
      '<button class="btn btn-ghost btn-sm" data-act="json">' + ui.icon('download') + '<span>' + ui.esc(t('res.export_json')) + '</span></button>' +
      '<button class="btn btn-ghost btn-sm" data-act="txt">' + ui.icon('download') + '<span>' + ui.esc(t('res.export_txt')) + '</span></button>';
    return '<div class="result-actions">' + flow.join('') + tools + '</div>';
  }

  function html(p, actions) {
    return headHtml(p) + castHtml(p) +
      '<div class="scenes-grid">' +
        p.scenes.map(function (s) { return sceneCard(p, s); }).join('') +
      '</div>' +
      actionsHtml(p, actions);
  }

  function bind(root, p, actions) {
    var handler = function (e) {
      var copyBtn = e.target.closest ? e.target.closest('[data-copy-scene]') : null;
      if (copyBtn) {
        var idx = parseInt(copyBtn.getAttribute('data-copy-scene'), 10);
        var field = copyBtn.getAttribute('data-field');
        var scene = p.scenes.filter(function (s) { return s.scene_number === idx; })[0];
        if (scene && scene[field]) {
          PR.ui.copy(scene[field]);
          copyBtn.classList.add('done');
          setTimeout(function () { copyBtn.classList.remove('done'); }, 1400);
        }
        return;
      }
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'copyall') {
        PR.ui.copy(PR.scenes.toText(p));
      } else if (act === 'json') {
        var clone = Object.assign({}, p);
        delete clone.thumb;
        PR.scenes.download('promptreel-' + PR.scenes.slug(p.project_title) + '.json', JSON.stringify(clone, null, 2), 'application/json;charset=utf-8');
      } else if (act === 'txt') {
        PR.scenes.download('promptreel-' + PR.scenes.slug(p.project_title) + '.txt', PR.scenes.toText(p));
      } else if (act === 'regen' && actions.onRegenerate) {
        actions.onRegenerate();
      } else if (act === 'new' && actions.onNew) {
        actions.onNew();
      }
    };
    // Re-render into the same root (studio "regenerate") must replace the
    // previous listener, otherwise stale project data is copied/exported.
    if (root.__prResultClick) root.removeEventListener('click', root.__prResultClick);
    root.__prResultClick = handler;
    root.addEventListener('click', handler);
  }

  PR.views.result = {
    render: function (root, project, actions) {
      root.hidden = false;
      root.innerHTML = html(project, actions || {});
      bind(root, project, actions || {});
    }
  };
})();
