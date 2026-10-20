/* ============================================================
   PromptReel — scenes.js
   The 8-scene contract: validate, normalize, export.
   Field names match the original PromptReel product schema:
   project_title / character_bible / scenes[scene_number,
   duration_seconds, scene_title, image_prompt, video_prompt,
   spoken_dialogue, transition]
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};

  var SCENE_COUNT = 8;

  function str(v, max) {
    var s = String(v == null ? '' : v).trim();
    return max && s.length > max ? s.slice(0, max) : s;
  }

  function intDur(v) {
    var d = parseInt(v, 10);
    if (isNaN(d)) return 7;
    return Math.min(12, Math.max(4, d));
  }

  /* Validate a raw package returned by the model. */
  function validate(pkg) {
    var errors = [];
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
      return { ok: false, errors: ['response is not a JSON object'], total: 0 };
    }
    if (!str(pkg.project_title, 120)) errors.push('missing project_title');
    if (!Array.isArray(pkg.scenes)) errors.push('scenes is not an array');
    var scenes = Array.isArray(pkg.scenes) ? pkg.scenes : [];
    if (scenes.length !== SCENE_COUNT) {
      errors.push('expected exactly ' + SCENE_COUNT + ' scenes, got ' + scenes.length);
    }
    var total = 0;
    scenes.forEach(function (s, i) {
      var n = i + 1;
      var d = parseInt(s && s.duration_seconds, 10);
      if (!(d >= 4 && d <= 12)) errors.push('scene ' + n + ': duration_seconds must be 4-12');
      else total += d;
      if (!str(s && s.image_prompt, 0) || str(s.image_prompt).length < 25) errors.push('scene ' + n + ': image_prompt too short or missing');
      if (!str(s && s.video_prompt, 0) || str(s.video_prompt).length < 25) errors.push('scene ' + n + ': video_prompt too short or missing');
      if (!str(s && s.spoken_dialogue, 0)) errors.push('scene ' + n + ': spoken_dialogue missing');
    });
    if (scenes.length === SCENE_COUNT && (total < 50 || total > 70)) {
      errors.push('total duration should be close to 60s, got ' + total + 's');
    }
    return { ok: errors.length === 0, errors: errors, total: total };
  }

  /* Normalize into the canonical project object we store/display. */
  function normalize(pkg, dialogueLanguage, meta) {
    var scenes = (Array.isArray(pkg.scenes) ? pkg.scenes : [])
      .slice(0, SCENE_COUNT)
      .map(function (s, i) {
        return {
          scene_number: i + 1,
          duration_seconds: intDur(s && s.duration_seconds),
          scene_title: str(s && s.scene_title, 120),
          image_prompt: str(s && s.image_prompt, 1200),
          video_prompt: str(s && s.video_prompt, 1200),
          spoken_dialogue: str(s && s.spoken_dialogue, 300),
          transition: str(s && s.transition, 300)
        };
      });
    var cast = Array.isArray(pkg.character_bible)
      ? pkg.character_bible.slice(0, 8).map(function (c) {
          return {
            character_id: str(c && c.character_id, 60),
            description: str(c && c.description, 500)
          };
        }).filter(function (c) { return c.description; })
      : [];
    var total = scenes.reduce(function (a, s) { return a + s.duration_seconds; }, 0);
    return {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
      project_title: str(pkg.project_title, 120) || 'Untitled story',
      logline: str(pkg.logline, 300),
      total_duration_seconds: total,
      aspect_ratio: (meta && meta.aspect_ratio) || '9:16',
      dialogue_language: dialogueLanguage,
      channel_name: str(meta && meta.channel_name, 80),
      character_bible: cast,
      scenes: scenes,
      model: (meta && meta.model) || '',
      thumb: (meta && meta.thumb) || null,
      source: (meta && meta.source) || null
    };
  }

  function langName(code) {
    return { en: 'English', ar: 'Arabic', fr: 'French' }[code] || String(code || '');
  }

  /* Human-readable script text (used by copy-all and .txt export). */
  function toText(p) {
    var out = [];
    out.push('PromptReel — ' + p.project_title);
    if (p.logline) out.push('Logline: ' + p.logline);
    if (p.channel_name) out.push('Channel: ' + p.channel_name);
    out.push('Format: ' + p.aspect_ratio + ' | Total: ~' + p.total_duration_seconds + 's | Dialogue: ' + langName(p.dialogue_language));
    if (p.character_bible && p.character_bible.length) {
      out.push('');
      out.push('CHARACTERS');
      p.character_bible.forEach(function (c) {
        out.push('- ' + (c.character_id || 'character') + ': ' + c.description);
      });
    }
    p.scenes.forEach(function (s) {
      out.push('');
      out.push('=== SCENE ' + s.scene_number + ' | ' + s.duration_seconds + 's ===');
      if (s.scene_title) out.push('Title: ' + s.scene_title);
      out.push('IMAGE PROMPT:');
      out.push(s.image_prompt);
      out.push('VIDEO PROMPT:');
      out.push(s.video_prompt);
      out.push('DIALOGUE (' + langName(p.dialogue_language) + '):');
      out.push(s.spoken_dialogue);
      if (s.transition) out.push('TRANSITION: ' + s.transition);
    });
    return out.join('\n');
  }

  function slug(title) {
    var s;
    try {
      s = String(title || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
    } catch (e) {
      s = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    return (s || 'story').slice(0, 60);
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 400);
  }

  PR.scenes = {
    SCENE_COUNT: SCENE_COUNT,
    validate: validate,
    normalize: normalize,
    toText: toText,
    langName: langName,
    slug: slug,
    download: download
  };
})();
