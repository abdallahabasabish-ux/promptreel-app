/* ============================================================
   PromptReel — video.js
   Client-side video authority: container signature sniffing
   (no trust in file.type), duration probe, poster thumbnail.
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};

  var MAX_BYTES = 200 * 1024 * 1024; // 200 MB

  var CONTAINERS = {
    mp4: { mime: 'video/mp4', label: 'MP4' },
    mov: { mime: 'video/quicktime', label: 'MOV' },
    webm: { mime: 'video/webm', label: 'WebM' }
  };

  function u8(b, i) { return b[i]; }

  function sniffContainer(file) {
    return file.slice(0, 32).arrayBuffer().then(function (buf) {
      var b = new Uint8Array(buf);
      // EBML magic -> WebM / MKV family
      if (u8(b,0) === 0x1A && u8(b,1) === 0x45 && u8(b,2) === 0xDF && u8(b,3) === 0xA3) return 'webm';
      // RIFF....AVI -> rejected later (not accepted by Gemini)
      if (u8(b,0) === 0x52 && u8(b,1) === 0x49 && u8(b,2) === 0x46 && u8(b,3) === 0x46 &&
          u8(b,8) === 0x41 && u8(b,9) === 0x56 && u8(b,10) === 0x49 && u8(b,11) === 0x20) return 'avi';
      // ISO-BMFF: 'ftyp' brand box at offset 4 -> MP4 / MOV / M4V
      if (u8(b,4) === 0x66 && u8(b,5) === 0x74 && u8(b,6) === 0x79 && u8(b,7) === 0x70) {
        var brand = String.fromCharCode(u8(b,8), u8(b,9), u8(b,10), u8(b,11));
        if (brand === 'qt  ') return 'mov';
        return 'mp4';
      }
      return 'unknown';
    });
  }

  function probeDuration(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      var done = false;
      var timer = setTimeout(function () { finish(null); }, 8000);
      function finish(sec) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(sec);
      }
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = function () {
        var d = v.duration;
        if (isFinite(d) && d > 0) finish(d); else finish(null);
      };
      v.onerror = function () { finish(null); };
      v.src = url;
    });
  }

  function thumbnail(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var v = document.createElement('video');
      var done = false;
      var timer = setTimeout(function () { fin(null); }, 9000);
      function fin(data) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(data);
      }
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = function () {
        try {
          var t = Math.min(1.2, Math.max(0.1, (v.duration || 2) / 3));
          v.currentTime = t;
        } catch (e) { fin(null); }
      };
      v.onseeked = function () {
        try {
          var w = 320;
          var h = Math.round(w * (v.videoHeight && v.videoWidth ? v.videoHeight / v.videoWidth : 9 / 16));
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(v, 0, 0, w, h);
          fin(c.toDataURL('image/jpeg', 0.72));
        } catch (e) { fin(null); }
      };
      v.onerror = function () { fin(null); };
      v.src = url;
    });
  }

  function validate(file) {
    if (!file || !file.size) return Promise.resolve({ ok: false, reason: 'empty' });
    if (file.size > MAX_BYTES) return Promise.resolve({ ok: false, reason: 'size' });
    return sniffContainer(file).then(function (container) {
      if (container !== 'mp4' && container !== 'mov' && container !== 'webm') {
        return { ok: false, reason: 'type', container: container };
      }
      var info = CONTAINERS[container];
      return {
        ok: true,
        container: container,
        mime: info.mime,
        label: info.label
      };
    });
  }

  PR.video = {
    MAX_BYTES: MAX_BYTES,
    validate: validate,
    sniffContainer: sniffContainer,
    probeDuration: probeDuration,
    thumbnail: thumbnail
  };
})();
