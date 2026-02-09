document.addEventListener('DOMContentLoaded', function () {
  var logo = document.querySelector('.logo');
  var slider = document.querySelector('.tab-slider');
  var tabs = document.querySelectorAll('.tab-btn');
  var panel = document.getElementById('articles-panel');
  var initialLogoTop = window.innerHeight / 2;
  var finalLogoTop = 50;

  // ── Scroll animation (logo + section fade) ──
  function animate() {
    var scrollY = window.scrollY;
    logo.style.top = Math.max(finalLogoTop, initialLogoTop - scrollY) + 'px';

    // Fade individual visual blocks, not whole sections
    var els = document.querySelectorAll(
      '#projects-panel h2, #projects-panel .about > p, ' +
      '#projects-panel .project-card, #projects-panel .repo-badges'
    );
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight;
      // Use element's vertical centre for smoother per-element fade
      var mid = (r.top + r.bottom) / 2 / vh * 100;
      var o = 0;
      if (mid >= 90) o = 0;
      else if (mid >= 80) o = (90 - mid) / 10;
      else if (mid >= 15) o = 1;
      else if (mid >= 5) o = (mid - 5) / 10;
      else o = 0;
      el.style.opacity = Math.max(0, Math.min(1, o));
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
      } else {
        slider.classList.remove('show-articles');
      }
    });
  });

  // ── Load articles eagerly on page load ──
  fetch('articles/index.json')
    .then(function (r) { return r.json(); })
    .then(function (articles) { buildAccordion(articles); })
    .catch(function () {
      panel.innerHTML = '<p style="color:rgba(255,255,255,0.6)">Could not load articles.</p>';
    });

  // ── Build accordion and pre-render all articles ──
  function buildAccordion(articles) {
    panel.innerHTML = '';
    articles.forEach(function (a) {
      var item = document.createElement('div');
      item.className = 'accordion-item';

      var tags = '';
      if (a.tags && a.tags.length) {
        tags = '<span class="article-tags">' +
          a.tags.map(function (t) { return '<span class="article-tag">' + esc(t) + '</span>'; }).join('') +
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
          '<div class="article-content" data-file="' + esc(a.file) + '">' +
            '<div class="article-meta">' + esc(a.author) + ' &middot; ' + esc(a.date) + '</div>' +
            '<p style="color:rgba(255,255,255,0.5)">Loading...</p>' +
          '</div>' +
        '</div>';

      panel.appendChild(item);

      item.querySelector('.accordion-header').addEventListener('click', function () {
        toggleAccordion(item);
      });

      // Eagerly fetch and render markdown
      loadArticle(item.querySelector('.article-content'), a.author, a.date);
    });
  }

  // ── Accordion toggle ──
  function toggleAccordion(item) {
    var body = item.querySelector('.accordion-body');

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
    body.style.maxHeight = body.scrollHeight + 'px';
  }

  // ── Fetch and render markdown ──
  function loadArticle(el, author, date) {
    var file = el.dataset.file;

    fetch('articles/' + file)
      .then(function (r) { return r.text(); })
      .then(function (md) {
        var stripped = md.replace(/^---[\s\S]*?---\s*/, '');
        var meta = '<div class="article-meta">' + esc(author) + ' &middot; ' + esc(date) + '</div>';
        el.innerHTML = meta + marked.parse(stripped);
      })
      .catch(function () {
        el.innerHTML = '<p style="color:rgba(255,255,255,0.6)">Failed to load article.</p>';
      });
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
