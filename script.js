document.addEventListener('DOMContentLoaded', function () {
  var logo = document.querySelector('.logo');
  var slider = document.querySelector('.tab-slider');
  var tabBar = document.querySelector('.tab-bar');
  var tabs = document.querySelectorAll('.tab-btn');
  var panel = document.getElementById('articles-panel');
  var initialLogoTop = window.innerHeight / 2;
  var finalLogoTop = 50;

  // ── Placeholder for tab bar when it goes sticky ──
  var placeholder = document.createElement('div');
  placeholder.className = 'tab-bar-placeholder';
  tabBar.parentNode.insertBefore(placeholder, tabBar.nextSibling);
  var tabBarOffset = null;

  // ── Scroll animation (logo + section fade + sticky tabs) ──
  function animate() {
    var scrollY = window.scrollY;
    logo.style.top = Math.max(finalLogoTop, initialLogoTop - scrollY) + 'px';

    // Sticky tab bar
    if (tabBarOffset === null && !tabBar.classList.contains('sticky')) {
      tabBarOffset = tabBar.offsetTop;
    }
    if (tabBarOffset !== null) {
      if (scrollY >= tabBarOffset - 20) {
        if (!tabBar.classList.contains('sticky')) {
          placeholder.style.height = tabBar.offsetHeight + 32 + 'px';
          placeholder.classList.add('visible');
          tabBar.classList.add('sticky');
        }
      } else {
        if (tabBar.classList.contains('sticky')) {
          tabBar.classList.remove('sticky');
          placeholder.classList.remove('visible');
          tabBarOffset = null;
        }
      }
    }

    var els = document.querySelectorAll(
      '#projects-panel h2, #projects-panel .about > p, ' +
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
      // Snap to scrollHeight first so the transition animates from content height to 0
      body.style.maxHeight = body.scrollHeight + 'px';
      // Force reflow
      body.offsetHeight;
      body.style.maxHeight = '0';
      item.classList.remove('open');
      return;
    }

    // Close others
    document.querySelectorAll('.accordion-item.open').forEach(function (o) {
      var ob = o.querySelector('.accordion-body');
      ob.style.maxHeight = ob.scrollHeight + 'px';
      ob.offsetHeight;
      ob.style.maxHeight = '0';
      o.classList.remove('open');
    });

    item.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';

    // After transition, remove the cap so content is never clipped
    function onEnd() {
      if (item.classList.contains('open')) {
        body.style.maxHeight = 'none';
      }
      body.removeEventListener('transitionend', onEnd);
    }
    body.addEventListener('transitionend', onEnd);
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

        // If accordion is open, uncap max-height so new content isn't clipped
        var item = el.closest('.accordion-item');
        if (item && item.classList.contains('open')) {
          item.querySelector('.accordion-body').style.maxHeight = 'none';
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
