/* ============================================================
   PromptReel — gemini.js
   Google Gemini client (browser-side, BYOK).
   - Inline (<15MB) or resumable Files API upload with progress
   - Structured output (responseSchema) for the 8-scene package
   - One repair round-trip if the contract is violated
   - Human-readable error classification
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};

  var BASE = 'https://generativelanguage.googleapis.com/v1beta';
  var BASE_UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta';
  var INLINE_MAX = 15 * 1024 * 1024;
  var POLL_INTERVAL = 3000;
  var POLL_TIMEOUT = 300000;

  var MODELS = [
    { id: 'gemini-2.5-flash', quality: 'm_flash' },
    { id: 'gemini-2.5-pro', quality: 'm_pro' },
    { id: 'gemini-2.0-flash', quality: 'm_legacy' }
  ];

  /* ----- response schema (8-scene package) ----- */

  function sceneProperties() {
    return {
      scene_number: { type: 'INTEGER' },
      duration_seconds: { type: 'INTEGER' },
      scene_title: { type: 'STRING' },
      image_prompt: { type: 'STRING' },
      video_prompt: { type: 'STRING' },
      spoken_dialogue: { type: 'STRING' },
      transition: { type: 'STRING' }
    };
  }

  function schema(strict) {
    var scenes = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: sceneProperties(),
        required: ['scene_number', 'duration_seconds', 'image_prompt', 'video_prompt', 'spoken_dialogue']
      }
    };
    if (strict) { scenes.minItems = 8; scenes.maxItems = 8; }
    return {
      type: 'OBJECT',
      properties: {
        project_title: { type: 'STRING' },
        logline: { type: 'STRING' },
        total_duration_seconds: { type: 'INTEGER' },
        aspect_ratio: { type: 'STRING' },
        dialogue_language: { type: 'STRING' },
        character_bible: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              character_id: { type: 'STRING' },
              description: { type: 'STRING' }
            },
            required: ['character_id', 'description']
          }
        },
        scenes: scenes
      },
      required: ['project_title', 'scenes']
    };
  }

  var SCHEMA_STRICT = schema(true);
  var SCHEMA_LOOSE = schema(false);

  /* ----- master instruction (aligned with the original product template) ----- */

  function buildInstruction(opts) {
    var lang = { en: 'English', ar: 'Arabic', fr: 'French' }[opts.dialogueLanguage] || 'English';
    var format = opts.aspectRatio || '9:16';
    var lines = [];
    lines.push('You are PromptReel, an expert AI Video Director and short-form video reconstruction specialist.');
    lines.push('Analyze the provided reference video and reconstruct it into exactly 8 sequential scenes for a short video with a total target duration of 60 seconds.');
    lines.push('');
    lines.push('USER INPUTS: Dialogue Language: ' + lang + ' | Aspect Ratio: ' + format + (opts.channelName ? ' | Channel Name: ' + opts.channelName : '') + (opts.genre ? ' | Genre: ' + opts.genre : '') + '.');
    lines.push('');
    lines.push('CRITICAL RULES:');
    lines.push('1. Return exactly one valid JSON object and nothing else.');
    lines.push('2. Return exactly 8 scenes numbered sequentially from 1 to 8. Never 7, never 9.');
    lines.push('3. Scene durations must be integers between 4 and 12 seconds, and the 8 durations must sum to exactly 60 seconds.');
    lines.push('4. Write all image_prompt descriptions in English.');
    lines.push('5. Write all video_prompt descriptions in English.');
    lines.push('6. Write spoken_dialogue exclusively in ' + lang + ', natively (never transliterated, never a word-by-word translation). One short line per scene, maximum 12 words.');
    lines.push('7. Maintain consistent character identity, clothing, physical features, props and environmental details across all 8 scenes.');
    lines.push('8. Fill character_bible with a stable English description per character and reuse it across scene prompts.');
    lines.push('9. Respect the selected aspect ratio ' + format + ' in all visual instructions.');
    lines.push('10. In image_prompt describe composition, lighting, camera framing, action and visual details for an external image-generation model (40-80 words).');
    lines.push('11. In video_prompt describe camera movement, character action, environmental movement, pacing and sound or dialogue direction (40-80 words). Never include on-screen text, captions or subtitles.');
    lines.push('12. Preserve the narrative, chronology and visual style of the reference video. Scene N+1 must continue visually from scene N.');
    lines.push('13. If dialogue cannot be reliably inferred, generate coherent dialogue consistent with the visible narrative without claiming it is a verbatim transcript.');
    lines.push('14. Add a concise English transition description for each scene toward the next one.');
    lines.push('15. Do not mention meta words such as "AI", "prompt" or "scene" inside the prompts or the dialogue. No emojis, no speaker labels.');
    if (opts.notes) {
      lines.push('16. Extra direction from the creator (follow it unless it conflicts with the rules above): ' + opts.notes);
    }
    lines.push('');
    lines.push('REQUIRED JSON STRUCTURE: {"project_title": "A concise project title in ' + lang + '", "logline": "One sentence in ' + lang + '", "total_duration_seconds": 60, "aspect_ratio": "' + format + '", "dialogue_language": "' + opts.dialogueLanguage + '", "character_bible": [{"character_id": "character_1", "description": "Consistent English character description"}], "scenes": [{"scene_number": 1, "duration_seconds": 7, "scene_title": "Short scene title in ' + lang + '", "image_prompt": "Detailed cinematic image prompt in English", "video_prompt": "Detailed video-generation prompt in English", "spoken_dialogue": "Dialogue in ' + lang + '", "transition": "Concise transition in English"}]}');
    lines.push('');
    lines.push('Return only the JSON object matching the provided schema. No markdown fences, no commentary.');
    return lines.join('\n');
  }

  /* ----- low-level helpers ----- */

  function authHeaders(key) {
    return { 'x-goog-api-key': key };
  }

  function httpError(r) {
    return r.text().then(function (txt) {
      var msg = 'HTTP ' + r.status;
      try {
        var body = JSON.parse(txt);
        if (body && body.error && body.error.message) msg = body.error.message;
      } catch (e) { /* keep raw */ }
      var err = new Error(msg);
      err.status = r.status;
      throw err;
    });
  }

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = '';
    var CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }

  function sleep(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  /* ----- video ingestion ----- */

  function inlineVideoPart(file, mime) {
    return file.arrayBuffer().then(function (buf) {
      return { inlineData: { mimeType: mime, data: bufToB64(buf) } };
    });
  }

  function uploadFileWithProgress(key, file, mime, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', BASE_UPLOAD + '/files');
      xhr.setRequestHeader('x-goog-api-key', key);
      xhr.setRequestHeader('X-Goog-Upload-Protocol', 'resumable');
      xhr.setRequestHeader('X-Goog-Upload-Command', 'start');
      xhr.setRequestHeader('X-Goog-Upload-Header-Content-Length', String(file.size));
      xhr.setRequestHeader('X-Goog-Upload-Header-Content-Type', mime);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 120000;
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error('upload start failed: HTTP ' + xhr.status));
          return;
        }
        var uploadUrl = xhr.getResponseHeader('X-Goog-Upload-URL');
        if (!uploadUrl) { reject(new Error('missing upload url')); return; }
        sendBytes(uploadUrl);
      };
      xhr.onerror = function () { reject(new Error('network error during upload start')); };
      xhr.ontimeout = function () { reject(new Error('upload start timed out')); };
      xhr.send(JSON.stringify({ file: { display_name: String(file.name || 'reference').slice(0, 60) } }));

      function sendBytes(url) {
        var up = new XMLHttpRequest();
        up.open('POST', url);
        up.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize');
        up.setRequestHeader('X-Goog-Upload-Offset', '0');
        up.setRequestHeader('Content-Type', mime);
        up.timeout = 600000;
        up.upload.onprogress = function (e) {
          if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
        };
        up.onload = function () {
          if (up.status < 200 || up.status >= 300) {
            reject(new Error('upload failed: HTTP ' + up.status));
            return;
          }
          try {
            var body = JSON.parse(up.responseText);
            if (!body || !body.file) { reject(new Error('bad upload response')); return; }
            resolve(body.file);
          } catch (e) { reject(new Error('bad upload response')); }
        };
        up.onerror = function () { reject(new Error('network error during upload')); };
        up.ontimeout = function () { reject(new Error('upload timed out')); };
        up.send(file);
      }
    });
  }

  function waitForFileActive(key, fileObj, onState) {
    var deadline = Date.now() + POLL_TIMEOUT;
    var id = String(fileObj.name || '').replace(/^files\//, '');
    var uri = fileObj.uri;
    return poll();

    function poll() {
      if (Date.now() > deadline) {
        return Promise.reject(new Error('video processing timed out'));
      }
      return fetch(BASE + '/files/' + encodeURIComponent(id), { headers: authHeaders(key) })
        .then(function (r) {
          if (!r.ok) return httpError(r);
          return r.json();
        })
        .then(function (body) {
          var state = body.state || (body.metadata && body.metadata.state) || '';
          if (body.uri) uri = body.uri;
          if (onState) onState(state);
          if (state === 'ACTIVE') return { uri: uri, name: body.name };
          if (state === 'FAILED') throw new Error('google failed to process this video');
          return sleep(POLL_INTERVAL).then(poll);
        });
    }
  }

  /* ----- generation ----- */

  function requestGeneration(opts, videoPart, schemaObj) {
    var body = {
      contents: [{
        role: 'user',
        parts: [{ text: buildInstruction(opts) }, videoPart]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: schemaObj
      }
    };
    return fetch(BASE + '/models/' + encodeURIComponent(opts.model) + ':generateContent', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(opts.key)),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.ok) return r.json();
      if (r.status === 400 && schemaObj === SCHEMA_STRICT) {
        // schema feature not accepted by this model/endpoint: retry loosely
        return r.text().then(function (txt) {
          if (/minItems|maxItems|Unknown name|invalid JSON payload/i.test(txt)) {
            return requestGeneration(opts, videoPart, SCHEMA_LOOSE);
          }
          var err = new Error(txt.slice(0, 400));
          err.status = 400;
          throw err;
        });
      }
      return httpError(r);
    }).then(function (data) {
      return extractJson(data);
    });
  }

  function extractJson(data) {
    var pf = data && data.promptFeedback;
    if (pf && pf.blockReason) {
      var be = new Error('blocked: ' + pf.blockReason);
      be.blocked = true;
      throw be;
    }
    var cand = data && data.candidates && data.candidates[0];
    if (!cand) throw new Error('empty response from model');
    var fr = cand.finishReason || 'STOP';
    if (fr !== 'STOP') {
      var fe = new Error('generation stopped: ' + fr);
      if (fr === 'MAX_TOKENS') fe.code = 'max_tokens';
      if (fr === 'SAFETY' || fr === 'PROHIBITED_CONTENT' || fr === 'RECITATION') fe.blocked = true;
      throw fe;
    }
    var parts = (cand.content && cand.content.parts) || [];
    var text = parts.map(function (p) { return p.text || ''; }).join('');
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      return JSON.parse(text);
    } catch (e) {
      var pe = new Error('model returned invalid JSON');
      pe.parseFailure = true;
      throw pe;
    }
  }

  function generate(opts) {
    var videoPartPromise;
    if (opts.videoFile.size <= INLINE_MAX) {
      videoPartPromise = inlineVideoPart(opts.videoFile, opts.mime);
    } else {
      if (opts.onPhase) opts.onPhase('ph_upload');
      videoPartPromise = uploadFileWithProgress(opts.key, opts.videoFile, opts.mime, function (frac) {
        if (opts.onProgress) opts.onProgress(frac);
      }).then(function (fileObj) {
        if (opts.onPhase) opts.onPhase('ph_process');
        return waitForFileActive(opts.key, fileObj).then(function (active) {
          return { fileData: { mimeType: opts.mime, fileUri: active.uri } };
        });
      });
    }
    return videoPartPromise.then(function (videoPart) {
      if (opts.onPhase) opts.onPhase('ph_generate');
      return requestGeneration(opts, videoPart, SCHEMA_STRICT);
    });
  }

  function repair(opts, badPackage, reason) {
    var lang = { en: 'English', ar: 'Arabic', fr: 'French' }[opts.dialogueLanguage] || 'English';
    var prompt = [
      'The following JSON package is a PromptReel 8-scene story derived from a reference video.',
      'It is INVALID because: ' + reason,
      '',
      'Return the corrected FULL JSON package. Keep the same story, characters and style.',
      'HARD RULES: exactly 8 scenes numbered 1..8; every duration_seconds is an integer 4-12; the 8 durations sum to exactly 60; image_prompt and video_prompt in English (40-80 words); spoken_dialogue one short line natively in ' + lang + '; keep character_bible consistent.',
      'Return only valid JSON matching the schema. No markdown.',
      '',
      'INVALID PACKAGE:',
      JSON.stringify(badPackage).slice(0, 24000)
    ].join('\n');
    var body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA_LOOSE
      }
    };
    return fetch(BASE + '/models/' + encodeURIComponent(opts.model) + ':generateContent', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(opts.key)),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return httpError(r);
      return r.json();
    }).then(function (data) {
      return extractJson(data);
    });
  }

  function checkKey(key) {
    return fetch(BASE + '/models?pageSize=1', { headers: authHeaders(key) }).then(function (r) {
      if (r.ok) return { ok: true };
      return httpError(r);
    });
  }

  PR.gemini = {
    INLINE_MAX: INLINE_MAX,
    MODELS: MODELS,
    checkKey: checkKey,
    generate: generate,
    repair: repair,
    buildInstruction: buildInstruction,
    extractJson: extractJson
  };
})();
