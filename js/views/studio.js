/* ============================================================
   PromptReel — views/studio.js
   Upload -> details -> generate pipeline with progress,
   contract validation, one repair round, autosave.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};
  PR.views = PR.views || {};

  var GENRES = ['cinematic', 'comedy', 'horror', 'scifi', 'romance', 'action', 'documentary', 'kids'];
  var FORMATS = ['9:16', '16:9', '1:1'];

  var state = {
    file: null,
    info: null,        // {mime,label,container,duration,thumb}
    running: false,
    fakeTimer: null
  };

  function el(id) { return document.getElementById(id); }

  function segBtn(code, label) {
    return '<button type="button" data-lang="' + code + '">' + PR.ui.esc(label) + '</button>';
  }

  function html() {
    var t = PR.i18n.t;
    var ui = PR.ui;
    var s = PR.store.getSettings();
    var dlg = s.dlgLang || 'ar';

    var stepsMini = '<div class="steps-mini">' +
      '<span>' + ui.esc(t('studio.step1')) + '</span>' +
      '<span>' + ui.esc(t('studio.step2')) + '</span>' +
      '<span>' + ui.esc(t('studio.step3')) + '</span>' +
      '</div>';

    var genreOptions = GENRES.map(function (g) {
      return '<option value="' + g + '">' + ui.esc(t('det.g_' + g)) + '</option>';
    }).join('');

    var formatOptions = FORMATS.map(function (f) {
      return '<option value="' + f + '"' + (f === '9:16' ? ' selected' : '') + '>' + f + '</option>';
    }).join('');

    return '' +
      '<h1 class="view-title">' + ui.esc(t('studio.title')) + '</h1>' +
      '<p class="view-sub">' + ui.esc(t('studio.sub')) + '</p>' +
      stepsMini +

      '<section class="panel">' +
        '<h2 class="panel-title">' + ui.esc(t('studio.step1')) + '</h2>' +
        '<div class="dropzone" id="dropzone" tabindex="0" role="button">' +
          '<div class="dz-inner">' +
            ui.icon('upload') +
            '<p class="dz-hint">' + ui.esc(t('up.hint')) + ' <span class="link" style="text-decoration:underline">' + ui.esc(t('up.browse')) + '</span></p>' +
            '<p class="dz-formats">' + ui.esc(t('up.formats')) + '</p>' +
          '</div>' +
          '<input type="file" id="file-input" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" hidden>' +
        '</div>' +
        '<div id="file-card" hidden></div>' +
      '</section>' +

      '<section class="panel">' +
        '<h2 class="panel-title">' + ui.esc(t('studio.step2')) + '</h2>' +
        '<div class="field">' +
          '<span class="label">' + ui.esc(t('det.lang')) + '</span>' +
          '<div class="segmented" id="lang-seg" role="group" aria-label="' + ui.esc(t('det.lang')) + '">' +
            segBtn('ar', 'العربية') + segBtn('en', 'English') + segBtn('fr', 'Français') +
          '</div>' +
          '<p class="help">' + ui.esc(t('det.lang_help')) + '</p>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="format-select">' + ui.esc(t('det.format')) + '</label>' +
          '<select id="format-select" class="select">' + formatOptions + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="genre-select">' + ui.esc(t('det.genre')) + '</label>' +
          '<select id="genre-select" class="select"><option value="">' + ui.esc(t('det.genre_none')) + '</option>' + genreOptions + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="channel-input">' + ui.esc(t('det.channel')) + '</label>' +
          '<input id="channel-input" class="input" type="text" maxlength="80" placeholder="' + ui.esc(t('det.channel_ph')) + '">' +
        '</div>' +
        '<div class="field">' +
          '<label class="label" for="notes-input">' + ui.esc(t('det.notes')) + '</label>' +
          '<textarea id="notes-input" class="textarea" rows="3" maxlength="500" placeholder="' + ui.esc(t('det.notes_ph')) + '"></textarea>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<h2 class="panel-title">' + ui.esc(t('studio.step3')) + '</h2>' +
        '<div class="notice" id="no-key-notice" hidden>' +
          ui.icon('alert') +
          '<span>' + ui.esc(t('gen.no_key')) + '</span>' +
          '<a class="link" href="#/settings">' + ui.esc(t('gen.no_key_link')) + '</a>' +
        '</div>' +
        '<div class="gen-row">' +
          '<button class="btn btn-primary btn-lg" id="btn-generate">' + ui.icon('spark') + '<span>' + ui.esc(t('gen.btn')) + '</span></button>' +
        '</div>' +
        '<div class="progress-wrap" id="progress-wrap" hidden>' +
          '<div class="progress" id="progress"><div class="progress-bar" id="progress-bar"></div></div>' +
          '<p class="progress-label" id="progress-label"></p>' +
        '</div>' +
        '<div class="error-box" id="error-box" hidden></div>' +
      '</section>' +

      '<section id="result-root" hidden></section>';
  }

  /* ---------- file handling ---------- */

  function updateKeyNotice() {
    var n = el('no-key-notice');
    if (!n) return;
    var s = PR.store.getSettings();
    n.hidden = !!s.apiKey;
  }

  function renderFileCard() {
    var t = PR.i18n.t;
    var ui = PR.ui;
    var card = el('file-card');
    if (!state.file) { card.hidden = true; card.innerHTML = ''; return; }
    var info = state.info || {};
    var badges = [];
    if (info.label) badges.push('<span class="badge badge-accent">' + ui.esc(info.label) + '</span>');
    badges.push('<span class="badge">' + ui.esc(t('file.size')) + ': ' + ui.fmtBytes(state.file.size) + '</span>');
    badges.push('<span class="badge" id="dur-badge">' + ui.esc(t('file.duration')) + ': ' + (info.duration ? (Math.round(info.duration) + ui.esc(t('res.sec'))) : ui.esc(t('file.probing'))) + '</span>');
    card.hidden = false;
    card.innerHTML =
      '<div class="file-card">' +
        (info.thumb
          ? '<img class="file-thumb" alt="" src="' + info.thumb + '">'
          : '<span class="file-thumb placeholder">' + ui.icon('film') + '</span>') +
        '<div class="file-meta">' +
          '<p class="file-name">' + ui.esc(state.file.name) + '</p>' +
          '<div class="file-badges">' + badges.join('') + '</div>' +
        '</div>' +
        '<button class="icon-btn" id="btn-remove" aria-label="' + ui.esc(t('up.remove')) + '" title="' + ui.esc(t('up.remove')) + '">' + ui.icon('x') + '</button>' +
      '</div>';
    var rm = el('btn-remove');
    if (rm) {
      rm.addEventListener('click', function (e) {
        e.stopPropagation();
        clearFile();
      });
    }
  }

  function clearFile() {
    state.file = null;
    state.info = null;
    renderFileCard();
  }

  function handleFile(file) {
    var t = PR.i18n.t;
    clearFile();
    PR.video.validate(file).then(function (v) {
      if (!v.ok) {
        var msg = v.reason === 'size' ? t('up.err_size') : (v.reason === 'empty' ? t('up.err_empty') : t('up.err_type'));
        PR.ui.toast(msg, 'err');
        return;
      }
      state.file = file;
      state.info = { mime: v.mime, label: v.label, container: v.container, duration: null, thumb: null };
      renderFileCard();
      PR.video.probeDuration(file).then(function (d) {
        if (state.file === file && d) {
          state.info.duration = d;
          renderFileCard();
        }
      });
      PR.video.thumbnail(file).then(function (dataUrl) {
        if (state.file === file && dataUrl) {
          state.info.thumb = dataUrl;
          renderFileCard();
        }
      });
    });
  }

  /* ---------- progress ---------- */

  function setPhase(key, indeterminate, fraction) {
    var t = PR.i18n.t;
    var wrap = el('progress-wrap');
    var bar = el('progress');
    var fill = el('progress-bar');
    var label = el('progress-label');
    if (!wrap) return;
    if (!key) { wrap.hidden = true; stopFake(); return; }
    wrap.hidden = false;
    label.innerHTML = '<span class="spinner"></span><span></span>';
    label.lastChild.textContent = t('gen.' + key);
    if (indeterminate) {
      bar.classList.add('indeterminate');
      fill.style.width = '';
    } else {
      bar.classList.remove('indeterminate');
      fill.style.width = Math.round((fraction || 0) * 100) + '%';
    }
  }

  function startFake() {
    var frac = 0.04;
    stopFake();
    state.fakeTimer = setInterval(function () {
      frac = Math.min(0.92, frac + 0.015);
      setPhase('ph_generate', false, frac);
    }, 900);
  }

  function stopFake() {
    if (state.fakeTimer) { clearInterval(state.fakeTimer); state.fakeTimer = null; }
  }

  function showError(message, detail) {
    var t = PR.i18n.t;
    var box = el('error-box');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<strong>' + PR.ui.esc(message) + '</strong>' +
      (detail ? '<details><summary>' + PR.ui.esc(t('gen.details')) + '</summary><pre></pre></details>' : '');
    if (detail) box.querySelector('pre').textContent = String(detail).slice(0, 1200);
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function errMessage(err) {
    var t = PR.i18n.t;
    if (err && err.blocked) return t('gen.err_blocked');
    if (err && err.code === 'max_tokens') return t('gen.err_max');
    if (err && err.parseFailure) return t('gen.err_parse');
    var st = err && err.status;
    if (st === 401 || st === 403) return t('gen.err_key');
    if (st === 429) return t('gen.err_quota');
    if (st === 400) return t('gen.err_400');
    if (st >= 500) return t('gen.err_5xx');
    var m = (err && err.message) || '';
    if (/network|failed to fetch|load failed/i.test(m)) return t('gen.err_network');
    return t('gen.err_generic') + (m ? ' (' + m.slice(0, 160) + ')' : '');
  }

  /* ---------- run pipeline ---------- */

  function collectOpts() {
    var s = PR.store.getSettings();
    return {
      key: s.apiKey,
      model: s.model || 'gemini-2.5-flash',
      videoFile: state.file,
      mime: state.info.mime,
      dialogueLanguage: selectedLang(),
      aspectRatio: el('format-select').value,
      genre: el('genre-select').value,
      channelName: el('channel-input').value.trim(),
      notes: el('notes-input').value.trim()
    };
  }

  function selectedLang() {
    var on = el('lang-seg').querySelector('button.on');
    return on ? on.getAttribute('data-lang') : 'ar';
  }

  function run() {
    var t = PR.i18n.t;
    if (state.running) return;
    if (!state.file) { PR.ui.toast(t('gen.need_video'), 'err'); return; }
    var s = PR.store.getSettings();
    if (!s.apiKey) {
      el('no-key-notice').hidden = false;
      PR.ui.toast(t('msg.need_key'), 'err');
      return;
    }

    state.running = true;
    el('btn-generate').disabled = true;
    el('error-box').hidden = true;
    el('result-root').hidden = true;
    el('result-root').innerHTML = '';

    // Snapshot file metadata NOW: the user may remove the file or navigate
    // away while the request is in flight — never read mutable state later.
    var fileSnap = state.file
      ? { name: state.file.name, size: state.file.size, container: (state.info && state.info.label) || '', duration: (state.info && state.info.duration) || null }
      : null;
    var thumbSnap = (state.info && state.info.thumb) || null;

    var inline = state.file.size <= PR.gemini.INLINE_MAX;
    var opts = collectOpts();

    if (inline) { setPhase('ph_generate', false, 0.05); startFake(); }
    else { setPhase('ph_upload', false, 0.02); }

    PR.gemini.generate({
      key: opts.key,
      model: opts.model,
      videoFile: opts.videoFile,
      mime: opts.mime,
      dialogueLanguage: opts.dialogueLanguage,
      aspectRatio: opts.aspectRatio,
      genre: opts.genre,
      channelName: opts.channelName,
      notes: opts.notes,
      onPhase: function (phaseKey) {
        if (phaseKey === 'ph_generate') {
          setPhase(phaseKey, false, 0.15);
          startFake();
        } else {
          stopFake();
          setPhase(phaseKey, phaseKey !== 'ph_upload', phaseKey === 'ph_upload' ? 0.05 : null);
        }
      },
      onProgress: function (frac) {
        setPhase('ph_upload', false, frac);
      }
    }).then(function (pkg) {
      setPhase('ph_validate', true);
      var v = PR.scenes.validate(pkg);
      if (!v.ok) {
        setPhase('ph_repair', true);
        return PR.gemini.repair(
          { key: opts.key, model: opts.model, dialogueLanguage: opts.dialogueLanguage },
          pkg, v.errors.join('; ')
        ).then(function (fixed) {
          var v2 = PR.scenes.validate(fixed);
          if (!v2.ok) {
            var e = new Error(v2.errors.join(' | '));
            e.sceneErrors = true;
            throw e;
          }
          return fixed;
        }, function () {
          var e = new Error(v.errors.join(' | '));
          e.sceneErrors = true;
          throw e;
        });
      }
      return pkg;
    }).then(function (pkg) {
      stopFake();
      setPhase(null);
      var project = PR.scenes.normalize(pkg, opts.dialogueLanguage, {
        aspect_ratio: opts.aspectRatio,
        channel_name: opts.channelName,
        model: opts.model,
        thumb: thumbSnap,
        source: fileSnap
      });
      PR.store.saveProject(project);
      var rootEl = el('result-root');
      if (rootEl) {
        PR.views.result.render(rootEl, project, {
          onRegenerate: function () { run(); },
          onNew: function () { PR.rerender(); }
        });
        PR.ui.toast(t('res.saved'), 'ok');
        rootEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }).catch(function (err) {
      stopFake();
      setPhase(null);
      if (el('error-box')) {
        if (err && err.sceneErrors) showError(t('gen.err_scene'), err.message);
        else showError(errMessage(err), err && err.message);
      }
    }).then(function () {
      state.running = false;
      var btn = el('btn-generate');
      if (btn) btn.disabled = false; // view may already be unmounted
    });
  }

  /* ---------- mount ---------- */

  PR.views.studio = {
    mount: function (root) {
      state.file = null;
      state.info = null;
      state.running = false;
      stopFake();
      root.innerHTML = html();

      var dz = el('dropzone');
      var input = el('file-input');

      dz.addEventListener('click', function () { input.click(); });
      dz.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('dragover'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('dragover'); });
      });
      dz.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleFile(f);
      });
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) handleFile(input.files[0]);
        input.value = '';
      });

      var s = PR.store.getSettings();
      var seg = el('lang-seg');
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
        if (b.getAttribute('data-lang') === (s.dlgLang || 'ar')) b.classList.add('on');
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          PR.store.saveSettings({ dlgLang: b.getAttribute('data-lang') });
        });
      });

      el('btn-generate').addEventListener('click', run);
      updateKeyNotice();
    }
  };
})();
