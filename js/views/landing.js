/* ============================================================
   PromptReel — views/landing.js
   ============================================================ */
(function () {
  'use strict';
  window.PR = window.PR || {};
  PR.views = PR.views || {};

  function featuresHtml(t, ui) {
    var items = [
      { i: 'film', t: 'feat.f1t', d: 'feat.f1d' },
      { i: 'spark', t: 'feat.f2t', d: 'feat.f2d' },
      { i: 'check', t: 'feat.f3t', d: 'feat.f3d' },
      { i: 'folder', t: 'feat.f4t', d: 'feat.f4d' }
    ];
    return '<div class="features">' + items.map(function (f) {
      return '<article class="feature-card">' +
        '<div class="feature-icon">' + ui.icon(f.i) + '</div>' +
        '<h3>' + ui.esc(t(f.t)) + '</h3>' +
        '<p>' + ui.esc(t(f.d)) + '</p>' +
        '</article>';
    }).join('') + '</div>';
  }

  function stepsHtml(t, ui) {
    var items = [
      { t: 'steps.s1t', d: 'steps.s1d' },
      { t: 'steps.s2t', d: 'steps.s2d' },
      { t: 'steps.s3t', d: 'steps.s3d' }
    ];
    return '<div class="steps-grid">' + items.map(function (s, i) {
      return '<article class="step-card">' +
        '<div class="step-num">' + (i + 1) + '</div>' +
        '<h3>' + ui.esc(t(s.t)) + '</h3>' +
        '<p>' + ui.esc(t(s.d)) + '</p>' +
        '</article>';
    }).join('') + '</div>';
  }

  function html() {
    var t = PR.i18n.t;
    var ui = PR.ui;
    return '' +
      '<section class="hero">' +
        '<span class="badge-pill">' + ui.esc(t('hero.badge')) + '</span>' +
        '<h1 class="hero-title">' + ui.esc(t('hero.t1')) + ' <span class="grad">' + ui.esc(t('hero.hl')) + '</span></h1>' +
        '<p class="hero-sub">' + ui.esc(t('hero.sub')) + '</p>' +
        '<div class="cta-row">' +
          '<a class="btn btn-primary btn-lg" href="#/studio">' + ui.icon('film') + '<span>' + ui.esc(t('cta.start')) + '</span></a>' +
          '<button class="btn btn-ghost btn-lg" data-scroll="features">' + ui.esc(t('cta.how')) + '</button>' +
        '</div>' +
      '</section>' +
      '<section id="features">' +
        '<h2 class="section-title">' + ui.esc(t('feat.t')) + '</h2>' +
        '<p class="section-sub">' + ui.esc(t('steps.t')) + '</p>' +
        featuresHtml(t, ui) +
      '</section>' +
      '<section style="margin-top:46px;">' +
        stepsHtml(t, ui) +
      '</section>' +
      '<section class="band">' +
        '<h2>' + ui.esc(t('band.t')) + '</h2>' +
        '<p>' + ui.esc(t('band.sub')) + '</p>' +
        '<a class="btn btn-primary btn-lg" href="#/studio">' + ui.icon('spark') + '<span>' + ui.esc(t('band.btn')) + '</span></a>' +
      '</section>';
  }

  PR.views.landing = {
    mount: function (root) {
      root.innerHTML = html();
      var scrollBtn = root.querySelector('[data-scroll="features"]');
      if (scrollBtn) {
        scrollBtn.addEventListener('click', function () {
          var target = root.querySelector('#features');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  };
})();
