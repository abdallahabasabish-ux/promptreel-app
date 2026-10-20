/* ============================================================
   PromptReel — views/settings.js
   API key (BYOK), model, appearance, privacy note, danger zone.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};
  PR.views = PR.views || {};

  function el(id) { return document.getElementById(id); }

  function modelOptions(s) {
    return PR.gemini.MODELS.map(function (m) {
      var label = m.id + ' — ' + PR.i18n.t('set.' + m.quality);
      return '<option value="' + m.id + '"' + (s.model === m.id ? ' selected' : '') + '>' + PR.ui.esc(label) + '</option>';
    }).join('');
  }

  function langOptions(current) {
    return PR.i18n.codes.map(function (c) {
      return '<option value="' + c + '"' + (current === c ? ' selected' : '') + '>' + PR.i18n.LANG_NAMES[c] + '</option>';
    }).join('');
  }

  function html() {
    var t = PR.i18n.t;
    var ui = PR.ui;
    var s = PR.store.getSettings();

    return '<div class="set-wrap">' +
      '<h1 class="view-title">' + ui.esc(t('set.title')) + '</h1>' +
      '<p class="view-sub">' + ui.esc(t('set.sub')) + '</p>' +

      '<section class="panel">' +
        '<h2 class="set-section-title">' + ui.esc(t('set.key_t')) + '</h2>' +
        '<div class="field">' +
          '<label class="label" for="key-input">' + ui.esc(t('set.key_label')) + '</label>' +
          '<div class="input-wrap">' +
            '<input id="key-input" class="input ltr" type="password" autocomplete="off" spellcheck="false" value="' + ui.esc(s.apiKey) + '" placeholder="AIza…">' +
            '<button type="button" class="input-eye" id="key-eye" aria-label="' + ui.esc(t('aria.copy')) + '">' + ui.icon('eye') + '</button>' +
          '</div>' +
          '<p class="help">' + ui.esc(t('set.key_help')) + '</p>' +
          '<p class="help"><a class="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">' + ui.esc(t('set.key_link')) + '</a></p>' +
        '</div>' +
        '<div class="gen-row">' +
          '<button class="btn btn-ghost btn-sm" id="btn-test">' + ui.esc(t('set.test')) + '</button>' +
          '<span class="key-status" id="key-status" hidden></span>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<h2 class="set-section-title">' + ui.esc(t('set.model_t')) + '</h2>' +
        '<div class="field">' +
          '<label class="label" for="model-select">' + ui.esc(t('set.model_t')) + '</label>' +
          '<select id="model-select" class="select">' + modelOptions(s) + '</select>' +
          '<p class="help">' + ui.esc(t('set.model_help')) + '</p>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<h2 class="set-section-title">' + ui.esc(t('set.app_t')) + '</h2>' +
        '<div class="field">' +
          '<label class="label" for="ui-lang">' + ui.esc(t('set.ui_lang')) + '</label>' +
          '<select id="ui-lang" class="select">' + langOptions(PR.i18n.getLang()) + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="theme-select">' + ui.esc(t('set.theme')) + '</label>' +
          '<select id="theme-select" class="select">' +
            '<option value="dark"' + (s.theme !== 'light' ? ' selected' : '') + '>' + ui.esc(t('set.dark')) + '</option>' +
            '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>' + ui.esc(t('set.light')) + '</option>' +
          '</select>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<h2 class="set-section-title">' + ui.esc(t('set.byok_t')) + '</h2>' +
        '<p class="muted" style="margin:0;font-size:13.5px;line-height:1.7">' + ui.esc(t('set.byok_body')) + '</p>' +
      '</section>' +

      '<section class="panel danger-zone">' +
        '<h2 class="set-section-title">' + ui.esc(t('set.danger_t')) + '</h2>' +
        '<p class="muted" style="margin:0 0 14px;font-size:13.5px">' + ui.esc(t('set.danger_body')) + '</p>' +
        '<button class="btn btn-danger btn-sm" id="btn-clear">' + ui.icon('trash') + '<span>' + ui.esc(t('set.danger_btn')) + '</span></button>' +
      '</section>' +

      '<div class="gen-row" style="margin-top:4px">' +
        '<button class="btn btn-primary" id="btn-save">' + ui.icon('check') + '<span>' + ui.esc(t('set.save')) + '</span></button>' +
      '</div>' +
      '</div>';
  }

  function applyAndSave() {
    var t = PR.i18n.t;
    var lang = el('ui-lang').value;
    var theme = el('theme-select').value;
    PR.store.saveSettings({
      apiKey: el('key-input').value.trim(),
      model: el('model-select').value,
      lang: lang,
      theme: theme
    });
    document.documentElement.setAttribute('data-theme', theme);
    PR.i18n.setLang(lang);
    PR.i18n.applyStatic(document);
    if (PR.syncHeader) PR.syncHeader();
    PR.ui.toast(t('msg.saved'), 'ok');
    PR.rerender();
  }

  function testKey() {
    var t = PR.i18n.t;
    var btn = el('btn-test');
    var status = el('key-status');
    var key = el('key-input').value.trim();
    if (!key) { status.hidden = false; status.className = 'key-status bad'; status.textContent = t('set.bad'); return; }
    btn.disabled = true;
    btn.textContent = t('set.testing');
    status.hidden = true;
    PR.gemini.checkKey(key).then(function () {
      status.hidden = false;
      status.className = 'key-status ok';
      status.textContent = t('set.ok');
    }, function () {
      status.hidden = false;
      status.className = 'key-status bad';
      status.textContent = t('set.bad');
    }).then(function () {
      btn.disabled = false;
      btn.textContent = t('set.test');
    });
  }

  PR.views.settings = {
    mount: function (root) {
      root.innerHTML = html();

      var eye = el('key-eye');
      eye.addEventListener('click', function () {
        var input = el('key-input');
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eye.innerHTML = PR.ui.icon(show ? 'eyeOff' : 'eye');
      });

      el('btn-test').addEventListener('click', testKey);
      el('btn-save').addEventListener('click', applyAndSave);

      el('btn-clear').addEventListener('click', function () {
        var t = PR.i18n.t;
        PR.ui.confirmModal(t('set.danger_body')).then(function (yes) {
          if (!yes) return;
          PR.store.clearAll();
          PR.ui.toast(t('msg.cleared'), 'ok');
          document.documentElement.setAttribute('data-theme', 'dark');
          PR.i18n.setLang('ar');
          PR.i18n.applyStatic(document);
          if (PR.syncHeader) PR.syncHeader();
          PR.rerender();
        });
      });
    }
  };
})();
