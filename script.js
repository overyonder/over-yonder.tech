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

    var els = document.querySelectorAll(
      '.tab-bar, #projects-panel h2, #projects-panel .about > p, ' +
      '#projects-panel .project-card, #projects-panel .repo-badges'
    );
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var mid = (r.top + r.bottom) / 2 / vh * 100;
      var o;
      if (mid > 95) o = 0;
      else if (mid > 85) o = (95 - mid) / 10;
      else if (mid > 8) o = 1;
      else if (mid > -2) o = (mid + 2) / 10;
      else o = 0;
      el.style.opacity = Math.max(0, Math.min(1, o));
    });
  }

  window.addEventListener('scroll', function () {
    window.requestAnimationFrame(animate);
  });
  window.requestAnimationFrame(animate);

  // ── Hash routing ──
  function parseHash() {
    var h = window.location.hash.replace(/^#\/?/, '');
    if (!h) return { tab: 'projects', slug: null };
    var parts = h.split('/');
    if (parts[0] === 'articles') return { tab: 'articles', slug: parts[1] || null };
    if (parts[0] === 'projects') return { tab: 'projects', slug: null };
    return { tab: 'projects', slug: null };
  }

  function selectTab(name) {
    tabs.forEach(function (b) { b.classList.remove('active'); });
    tabs.forEach(function (b) {
      if (b.dataset.tab === name) b.classList.add('active');
    });
    if (name === 'articles') {
      slider.classList.add('show-articles');
    } else {
      slider.classList.remove('show-articles');
    }
  }

  // ── Tab switching (updates hash) ──
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectTab(btn.dataset.tab);
      history.replaceState(null, '', '#' + btn.dataset.tab);
    });
  });

  // Listen for hash changes (back/forward)
  window.addEventListener('hashchange', function () {
    var route = parseHash();
    selectTab(route.tab);
    if (route.tab === 'articles') openArticleBySlug(route.slug);
  });

  // ── Load articles eagerly on page load ──
  fetch('articles/index.json')
    .then(function (r) { return r.json(); })
    .then(function (articles) {
      buildAccordion(articles);
      // Apply initial route after articles are built
      var route = parseHash();
      selectTab(route.tab);
      if (route.slug) {
        openArticleBySlug(route.slug);
      } else if (route.tab === 'articles') {
        // On articles tab with no specific slug, expand first (most recent)
        expandFirst();
      } else {
        // Default: expand most recent article so it's ready when user switches
        expandFirst();
      }
    })
    .catch(function () {
      panel.innerHTML = '<p style="color:rgba(255,255,255,0.6)">Could not load articles.</p>';
    });

  // ── Build accordion and pre-render all articles ──
  function buildAccordion(articles) {
    panel.innerHTML = '';
    articles.forEach(function (a) {
      var item = document.createElement('div');
      item.className = 'accordion-item';
      var slug = a.file.replace(/\.md$/, '');
      item.dataset.slug = slug;

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
        // Update hash when an article is toggled
        if (item.classList.contains('open')) {
          history.replaceState(null, '', '#articles/' + slug);
        } else {
          history.replaceState(null, '', '#articles');
        }
      });

      // Eagerly fetch and render markdown
      loadArticle(item.querySelector('.article-content'), a.author, a.date);
    });
  }

  // ── Open article by slug ──
  function openArticleBySlug(slug) {
    if (!slug) return;
    var item = panel.querySelector('.accordion-item[data-slug="' + slug + '"]');
    if (!item || item.classList.contains('open')) return;
    toggleAccordion(item);
  }

  // ── Expand first (most recent) article ──
  function expandFirst() {
    var first = panel.querySelector('.accordion-item');
    if (first && !first.classList.contains('open')) {
      toggleAccordion(first);
    }
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
        el.querySelectorAll('pre code').forEach(function (block) {
          hljs.highlightElement(block);
        });

        // Recompute max-height if this article's accordion is already open
        var item = el.closest('.accordion-item');
        if (item && item.classList.contains('open')) {
          item.querySelector('.accordion-body').style.maxHeight =
            item.querySelector('.accordion-body').scrollHeight + 'px';
        }
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
