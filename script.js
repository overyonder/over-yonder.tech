document.addEventListener('DOMContentLoaded', function () {
  var logo = document.querySelector('.logo');
  var slider = document.querySelector('.tab-slider');
  var tabs = document.querySelectorAll('.tab-btn');
  var panel = document.getElementById('articles-panel');
  var initialLogoTop = window.innerHeight / 2;
  var finalLogoTop = 50;
  var indexLoaded = false;

  // ── Scroll animation (logo + section fade) ──
  function animate() {
    var scrollY = window.scrollY;
    logo.style.top = Math.max(finalLogoTop, initialLogoTop - scrollY) + 'px';

    // Only fade sections inside the projects panel
    var sections = document.querySelectorAll('#projects-panel section');
    sections.forEach(function (s) {
      var r = s.getBoundingClientRect();
      var p = r.top / window.innerHeight * 100;
      var o = 0;
      if (p >= 90) o = 0;
      else if (p >= 80) o = (90 - p) / 10;
      else if (p >= 30) o = 1;
      else if (p >= 20) o = (p - 20) / 10;
      else o = 0;
      s.style.opacity = Math.max(0, Math.min(1, o));
    });
  }

  window.addEventListener('scroll', function () {
    window.requestAnimationFrame(animate);
  });
  window.requestAnimationFrame(animate);

  // ── Tab switching ──
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      if (btn.dataset.tab === 'articles') {
        slider.classList.add('show-articles');
        if (!indexLoaded) loadIndex();
      } else {
        slider.classList.remove('show-articles');
      }
    });
  });

  // ── Load article index ──
  function loadIndex() {
    indexLoaded = true;
    fetch('articles/index.json')
      .then(function (r) { return r.json(); })
      .then(function (articles) { buildAccordion(articles); })
      .catch(function (e) {
        panel.innerHTML = '<p style="color:rgba(255,255,255,0.6)">Could not load articles.</p>';
      });
  }

  // ── Build accordion from manifest ──
  function buildAccordion(articles) {
    panel.innerHTML = '';
    articles.forEach(function (a) {
      var item = document.createElement('div');
      item.className = 'accordion-item';

      var tags = '';
      if (a.tags && a.tags.length) {
        tags = '<span class="article-tags">' +
          a.tags.map(function (t) { return '<span class="article-tag">' + t + '</span>'; }).join('') +
          '</span>';
      }

      item.innerHTML =
        '<button class="accordion-header">' +
          '<span class="article-title">' + esc(a.title) + '</span>' +
          tags +
          '<span class="article-date">' + esc(a.date) + '</span>' +
          '<span class="accordion-chevron">&#9662;</span>' +
        '</button>' +
        '<div class="accordion-body">' +
          '<div class="article-content" data-file="' + esc(a.file) + '" data-author="' + esc(a.author) + '" data-date="' + esc(a.date) + '"></div>' +
        '</div>';

      panel.appendChild(item);

      item.querySelector('.accordion-header').addEventListener('click', function () {
        toggleAccordion(item);
      });
    });
  }

  // ── Accordion toggle ──
  function toggleAccordion(item) {
    var body = item.querySelector('.accordion-body');
    var content = item.querySelector('.article-content');

    if (item.classList.contains('open')) {
      body.style.maxHeight = '0';
      item.classList.remove('open');
      return;
    }

    // Close others
    document.querySelectorAll('.accordion-item.open').forEach(function (o) {
      o.classList.remove('open');
      o.querySelector('.accordion-body').style.maxHeight = '0';
    });

    item.classList.add('open');

    if (!content.dataset.loaded) {
      content.dataset.loaded = '1';
      loadArticle(content, function () {
        body.style.maxHeight = body.scrollHeight + 'px';
      });
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
    }
  }

  // ── Lazy markdown fetch + render ──
  function loadArticle(el, cb) {
    var file = el.dataset.file;
    var author = el.dataset.author;
    var date = el.dataset.date;

    fetch('articles/' + file)
      .then(function (r) { return r.text(); })
      .then(function (md) {
        // Strip YAML front matter
        var stripped = md.replace(/^---[\s\S]*?---\s*/, '');
        var meta = '<div class="article-meta">' + esc(author) + ' &middot; ' + esc(date) + '</div>';
        el.innerHTML = meta + marked.parse(stripped);
        if (cb) cb();
      })
      .catch(function () {
        el.innerHTML = '<p style="color:rgba(255,255,255,0.6)">Failed to load article.</p>';
        if (cb) cb();
      });
  }

  // ── Minimal HTML escaper ──
  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
