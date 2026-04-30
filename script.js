document.addEventListener('DOMContentLoaded', function () {
  var logo = document.querySelector('.logo');
  var slider = document.querySelector('.tab-slider');
  var tabBar = document.querySelector('.tab-bar');
  var tabs = document.querySelectorAll('.tab-btn');
  var panel = document.getElementById('articles-panel');
  var themeToggle = document.querySelector('.theme-toggle');
  var initialLogoTop = window.innerHeight / 2;
  var finalLogoTop = 50;

  function applyTheme(theme) {
    var dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('oy-theme', dark ? 'dark' : 'light');
    if (themeToggle) {
      themeToggle.textContent = dark ? 'Light' : 'Dark';
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      themeToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
    }
  }

  applyTheme(localStorage.getItem('oy-theme') === 'dark' ? 'dark' : 'light');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  // ── Configure marked extensions (guarded so a CDN failure can't crash the page) ──
  try {
    if (window.markedSmartypants) {
      var sp = window.markedSmartypants.markedSmartypants || window.markedSmartypants;
      if (typeof sp === 'function') marked.use(sp());
    }
    if (window.markedKatex) {
      marked.use(markedKatex({ throwOnError: false }));
    }
    if (window.markedFootnote) {
      marked.use(markedFootnote());
    }
    if (window.markedAlert) {
      marked.use(markedAlert({
        variants: [
          { type: 'success', icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm3.78-9.72a.751.751 0 0 0-1.06-1.06L6.5 9.44 5.28 8.22a.751.751 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l4.75-4.75Z"></path></svg>', title: 'Success' },
          { type: 'error', icon: '<svg class="octicon" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.06 1.06L6.94 8 4.97 9.97a.751.751 0 1 0 1.06 1.06L8 9.06l1.97 1.97a.751.751 0 1 0 1.06-1.06L9.06 8l1.97-1.97a.751.751 0 0 0-1.06-1.06L8 6.94 6.03 4.97Z"></path></svg>', title: 'Error' }
        ]
      }));
    }
  } catch (e) { console.error('marked extension init failed:', e); }
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral'
    });
  }
  catch (e) { console.error('mermaid init failed:', e); }

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
    // Ignore footnote anchors -- not a route change
    if (h.indexOf('footnote-') === 0) return null;
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
    if (!route) return; // footnote anchor, not a route
    selectTab(route.tab);
    if (route.tab === 'articles') {
      if (route.slug) {
        openArticleBySlug(route.slug);
      } else {
        hideDirectOnlyArticles();
      }
    } else {
      hideDirectOnlyArticles();
    }
  });

  // ── Load articles eagerly on page load ──
  fetch('articles/index.json')
    .then(function (r) { return r.json(); })
    .then(function (articles) {
      buildAccordion(articles);
      // Apply initial route after articles are built
      var route = parseHash();
      if (route) selectTab(route.tab);
      if (route && route.slug) {
        openArticleBySlug(route.slug);
      } else if (route && route.tab === 'articles') {
        // On articles tab with no specific slug, expand first (most recent)
        expandFirst();
      } else {
        // Default: expand most recent article so it's ready when user switches
        expandFirst();
      }
    })
    .catch(function () {
      panel.innerHTML = '<p class="load-state">Could not load articles.</p>';
    });

  // ── Build accordion and pre-render all articles ──
  function buildAccordion(articles) {
    panel.innerHTML = '';
    articles.forEach(function (a) {
      var item = document.createElement('div');
      item.className = 'accordion-item';
      var slug = a.file.replace(/\.md$/, '');
      var hidden = a.hidden === true;
      item.dataset.slug = slug;
      item.dataset.hidden = hidden ? 'true' : 'false';
      if (hidden) item.classList.add('hidden-article');

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
            '<p class="load-state">Loading...</p>' +
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
    if (item && isHiddenArticle(item)) revealHiddenArticle(item);
    if (!item || item.classList.contains('open')) return;
    toggleAccordion(item);
  }

  // ── Expand first (most recent) article ──
  function expandFirst() {
    var first = panel.querySelector('.accordion-item:not(.hidden-article)');
    if (first && !first.classList.contains('open')) {
      toggleAccordion(first);
    }
  }

  function isHiddenArticle(item) {
    return item && item.dataset.hidden === 'true';
  }

  function revealHiddenArticle(item) {
    if (isHiddenArticle(item)) item.classList.add('forced-visible');
  }

  function hideHiddenArticle(item) {
    if (!isHiddenArticle(item)) return;
    item.classList.remove('forced-visible');
  }

  function hideDirectOnlyArticles() {
    panel.querySelectorAll('.accordion-item.hidden-article').forEach(function (item) {
      if (item.classList.contains('open')) {
        closeAccordion(item);
      } else {
        hideHiddenArticle(item);
      }
    });
  }

  // ── Accordion toggle ──
  function toggleAccordion(item) {
    if (item.classList.contains('open')) {
      closeAccordion(item);
      return;
    }

    // Close others
    document.querySelectorAll('.accordion-item.open').forEach(function (o) {
      closeAccordion(o);
    });

    revealHiddenArticle(item);

    var body = item.querySelector('.accordion-body');
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

  function closeAccordion(item) {
    var body = item.querySelector('.accordion-body');

    // Snap to scrollHeight first so the transition animates from content height to 0
    body.style.maxHeight = body.scrollHeight + 'px';
    body.offsetHeight;
    body.style.maxHeight = '0';
    item.classList.remove('open');

    if (isHiddenArticle(item)) {
      function onEnd() {
        if (!item.classList.contains('open')) hideHiddenArticle(item);
        body.removeEventListener('transitionend', onEnd);
      }
      body.addEventListener('transitionend', onEnd);
    }
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

        // Syntax highlighting (skip mermaid blocks)
        el.querySelectorAll('pre code').forEach(function (block) {
          if (!block.classList.contains('language-mermaid')) {
            hljs.highlightElement(block);
          }
        });

        // Render mermaid diagrams
        el.querySelectorAll('pre code.language-mermaid').forEach(function (block) {
          var pre = block.parentElement;
          var diagram = document.createElement('div');
          diagram.className = 'mermaid';
          diagram.textContent = block.textContent;
          pre.replaceWith(diagram);
        });
        mermaid.run({ nodes: el.querySelectorAll('.mermaid') });

        // Wire footnote links to scroll within the article instead of changing hash
        el.querySelectorAll('a[data-footnote-ref], a[data-footnote-backref]').forEach(function (link) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            var id = link.getAttribute('href').replace(/^#/, '');
            var target = el.querySelector('[id="' + id + '"]');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });

        // If accordion is open, uncap max-height so new content isn't clipped
        var item = el.closest('.accordion-item');
        if (item && item.classList.contains('open')) {
          item.querySelector('.accordion-body').style.maxHeight = 'none';
        }
      })
      .catch(function () {
        el.innerHTML = '<p class="load-state">Failed to load article.</p>';
      });
  }

  // ── Auto-generate repo badges from GitHub API ──
  var GITHUB_ACCOUNTS = ['rakelang', 'overyonder', 'hannigancooper', 'KaiStarkk'];

  function loadRepoBadges() {
    var container = document.querySelector('.repo-badges');
    if (!container) return;

    var fetches = GITHUB_ACCOUNTS.map(function (account) {
      return fetch('https://api.github.com/users/' + account + '/repos?per_page=100&sort=updated')
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    });

    Promise.all(fetches).then(function (results) {
      var seen = {};
      var repos = [];

      results.forEach(function (accountRepos) {
        if (!Array.isArray(accountRepos)) return;
        accountRepos.forEach(function (repo) {
          if (repo.fork || repo.private) return;
          if (seen[repo.name]) return;
          seen[repo.name] = true;
          repos.push(repo);
        });
      });

      repos.sort(function (a, b) {
        if (b.stargazers_count !== a.stargazers_count) return b.stargazers_count - a.stargazers_count;
        return a.name.localeCompare(b.name);
      });

      container.innerHTML = '';
      repos.forEach(function (repo) {
        var a = document.createElement('a');
        a.href = repo.html_url;
        a.target = '_blank';
        var img = document.createElement('img');
        img.src = 'https://img.shields.io/github/stars/' + repo.full_name + '?style=flat-square&label=' + encodeURIComponent(repo.name);
        img.alt = repo.name;
        a.appendChild(img);
        container.appendChild(a);
      });
    });
  }

  loadRepoBadges();

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
