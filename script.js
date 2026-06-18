document.addEventListener('DOMContentLoaded', function () {
  var logo = document.querySelector('.logo');
  var slider = document.querySelector('.tab-slider');
  var tabBar = document.querySelector('.tab-bar');
  var tabs = document.querySelectorAll('.tab-btn');
  var articlesPanel = document.getElementById('articles-panel');
  var initialLogoTop = window.innerHeight / 2;
  var finalLogoTop = 50;
  var currentTab = 'projects';
  var articleToolsPromise = null;
  var articleToolsConfigured = false;
  var articlesIndexPromise = null;
  var articleRuntimeFailed = false;
  var projectFadeEls = [];
  var animationQueued = false;

  var ARTICLE_STYLES = [
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github-dark-dimmed.min.css',
    'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css'
  ];

  var ARTICLE_SCRIPTS = [
    'https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js',
    'https://cdn.jsdelivr.net/npm/marked@15/marked.min.js',
    'https://cdn.jsdelivr.net/npm/marked-katex-extension/lib/index.umd.js',
    'https://cdn.jsdelivr.net/npm/marked-footnote/dist/index.umd.js',
    'https://cdn.jsdelivr.net/npm/marked-smartypants/lib/index.umd.js',
    'https://cdn.jsdelivr.net/npm/marked-alert@2/dist/index.umd.js',
    'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/rust.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/c.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/bash.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/nix.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/markdown.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/diff.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/languages/latex.min.js'
  ];

  refreshProjectFadeEls();

  // Placeholder for tab bar when it goes sticky
  var placeholder = document.createElement('div');
  placeholder.className = 'tab-bar-placeholder';
  tabBar.parentNode.insertBefore(placeholder, tabBar.nextSibling);
  var tabBarOffset = null;

  function animate() {
    animationQueued = false;

    var scrollY = window.scrollY;
    logo.style.top = Math.max(finalLogoTop, initialLogoTop - scrollY) + 'px';

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
      } else if (tabBar.classList.contains('sticky')) {
        tabBar.classList.remove('sticky');
        placeholder.classList.remove('visible');
        tabBarOffset = null;
      }
    }

    if (currentTab !== 'projects') return;

    var vh = window.innerHeight;
    projectFadeEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
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

  function queueAnimate() {
    if (animationQueued) return;
    animationQueued = true;
    window.requestAnimationFrame(animate);
  }

  window.addEventListener('scroll', queueAnimate, { passive: true });
  window.addEventListener('resize', function () {
    initialLogoTop = window.innerHeight / 2;
    tabBarOffset = null;
    queueAnimate();
  });
  queueAnimate();

  function refreshProjectFadeEls() {
    projectFadeEls = Array.prototype.slice.call(document.querySelectorAll(
      '#projects-panel h2, #projects-panel .about > p, ' +
      '#projects-panel .project-card, #projects-panel .repo-badges'
    ));
  }

  function parseHash() {
    var h = window.location.hash.replace(/^#\/?/, '');
    if (!h) return { tab: 'projects', slug: null };
    if (h.indexOf('footnote-') === 0) return null;
    var parts = h.split('/');
    if (parts[0] === 'articles') return { tab: 'articles', slug: parts[1] || null };
    if (parts[0] === 'projects') return { tab: 'projects', slug: null };
    return { tab: 'projects', slug: null };
  }

  function selectTab(name) {
    currentTab = name;
    tabs.forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    slider.classList.toggle('show-articles', name === 'articles');
    queueAnimate();
  }

  function loadStylesheet(href) {
    var existing = Array.prototype.some.call(
      document.querySelectorAll('link[data-article-asset]'),
      function (node) { return node.dataset.articleAsset === href; }
    );
    if (existing) {
      return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.articleAsset = href;
      link.onload = resolve;
      link.onerror = function () { reject(new Error('Failed to load stylesheet: ' + href)); };
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
    var existing = Array.prototype.some.call(
      document.querySelectorAll('script[data-article-asset]'),
      function (node) { return node.dataset.articleAsset === src; }
    );
    if (existing) {
      return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.articleAsset = src;
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Failed to load script: ' + src)); };
      document.body.appendChild(script);
    });
  }

  function configureArticleTools() {
    if (articleToolsConfigured) return;

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
    } catch (e) {
      console.error('marked extension init failed:', e);
    }

    try {
      if (window.mermaid) {
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      }
    } catch (e) {
      console.error('mermaid init failed:', e);
    }

    articleToolsConfigured = true;
  }

  function ensureArticleRuntime() {
    if (articleRuntimeFailed) {
      return Promise.reject(new Error('Article runtime previously failed to load.'));
    }
    if (articleToolsPromise) return articleToolsPromise;

    articleToolsPromise = Promise.all(ARTICLE_STYLES.map(loadStylesheet))
      .then(function () {
        return ARTICLE_SCRIPTS.reduce(function (promise, src) {
          return promise.then(function () { return loadScript(src); });
        }, Promise.resolve());
      })
      .then(function () {
        configureArticleTools();
      })
      .catch(function (err) {
        articleRuntimeFailed = true;
        throw err;
      });

    return articleToolsPromise;
  }

  function ensureArticlesIndex() {
    if (articlesIndexPromise) return articlesIndexPromise;

    articlesIndexPromise = fetch('articles/index.json')
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load articles index.');
        return r.json();
      })
      .then(function (articles) {
        buildAccordion(articles);
      })
      .catch(function (err) {
        articlesPanel.innerHTML = '<p style="color:rgba(255,255,255,0.6)">Could not load articles.</p>';
        throw err;
      });

    return articlesIndexPromise;
  }

  function ensureArticlesReady() {
    return Promise.all([ensureArticleRuntime(), ensureArticlesIndex()]);
  }

  function handleRoute(route) {
    if (!route) return;

    selectTab(route.tab);

    if (route.tab !== 'articles') {
      hideDirectOnlyArticles();
      return;
    }

    ensureArticlesReady()
      .then(function () {
        if (route.slug) {
          openArticleBySlug(route.slug);
        } else {
          hideDirectOnlyArticles();
          expandFirst();
        }
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      history.replaceState(null, '', '#' + btn.dataset.tab);
      handleRoute({ tab: btn.dataset.tab, slug: null });
    });
  });

  window.addEventListener('hashchange', function () {
    var route = parseHash();
    if (!route) return;
    handleRoute(route);
  });

  handleRoute(parseHash());
  loadRepoBadges();

  function buildAccordion(articles) {
    articlesPanel.innerHTML = '';

    articles.forEach(function (a) {
      var item = document.createElement('div');
      var slug = a.file.replace(/\.md$/, '');
      var hidden = a.hidden === true;
      var tags = '';

      item.className = 'accordion-item';
      item.dataset.slug = slug;
      item.dataset.hidden = hidden ? 'true' : 'false';
      if (hidden) item.classList.add('hidden-article');

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
          '<div class="article-content" data-file="' + esc(a.file) + '" data-loaded="false">' +
            '<div class="article-meta">' + esc(a.author) + ' &middot; ' + esc(a.date) + '</div>' +
            '<p style="color:rgba(255,255,255,0.5)">Open article to load content.</p>' +
          '</div>' +
        '</div>';

      articlesPanel.appendChild(item);

      item.querySelector('.accordion-header').addEventListener('click', function () {
        toggleAccordion(item);
        history.replaceState(null, '', item.classList.contains('open') ? '#articles/' + slug : '#articles');
      });
    });
  }

  function openArticleBySlug(slug) {
    if (!slug) return;

    var item = articlesPanel.querySelector('.accordion-item[data-slug="' + slug + '"]');
    if (item && isHiddenArticle(item)) revealHiddenArticle(item);
    if (!item || item.classList.contains('open')) return;
    toggleAccordion(item);
  }

  function expandFirst() {
    var first = articlesPanel.querySelector('.accordion-item:not(.hidden-article)');
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
    if (isHiddenArticle(item)) item.classList.remove('forced-visible');
  }

  function hideDirectOnlyArticles() {
    articlesPanel.querySelectorAll('.accordion-item.hidden-article').forEach(function (item) {
      if (item.classList.contains('open')) {
        closeAccordion(item);
      } else {
        hideHiddenArticle(item);
      }
    });
  }

  function toggleAccordion(item) {
    if (item.classList.contains('open')) {
      closeAccordion(item);
      return;
    }

    articlesPanel.querySelectorAll('.accordion-item.open').forEach(function (openItem) {
      closeAccordion(openItem);
    });

    revealHiddenArticle(item);

    var body = item.querySelector('.accordion-body');
    item.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';

    ensureArticleLoaded(item).finally(function () {
      if (!item.classList.contains('open')) return;
      expandAccordionBody(item);
    });
  }

  function expandAccordionBody(item) {
    var body = item.querySelector('.accordion-body');
    var fallback;

    function releaseHeight(e) {
      if (e && e.target !== body) return;
      if (e && e.propertyName !== 'max-height') return;

      window.clearTimeout(fallback);
      if (item.classList.contains('open')) {
        body.style.maxHeight = 'none';
      }
      body.removeEventListener('transitionend', releaseHeight);
    }

    body.addEventListener('transitionend', releaseHeight);
    body.style.maxHeight = body.scrollHeight + 'px';

    fallback = window.setTimeout(releaseHeight, 520);
  }

  function closeAccordion(item) {
    var body = item.querySelector('.accordion-body');
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

  function ensureArticleLoaded(item) {
    var el = item.querySelector('.article-content');
    if (!el || el.dataset.loaded === 'true' || el.dataset.loading === 'true') {
      return Promise.resolve();
    }

    el.dataset.loading = 'true';
    return loadArticle(el)
      .catch(function () {
        el.innerHTML = '<p style="color:rgba(255,255,255,0.6)">Failed to load article.</p>';
      })
      .finally(function () {
        delete el.dataset.loading;
      });
  }

  function loadArticle(el) {
    var file = el.dataset.file;
    var meta = el.querySelector('.article-meta');
    var metaHtml = meta ? meta.outerHTML : '';

    el.innerHTML = metaHtml + '<p style="color:rgba(255,255,255,0.5)">Loading...</p>';

    return fetch('articles/' + file)
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load article: ' + file);
        return r.text();
      })
      .then(function (md) {
        var stripped = md.replace(/^---[\s\S]*?---\s*/, '');
        el.innerHTML = metaHtml + marked.parse(stripped);
        el.dataset.loaded = 'true';

        el.querySelectorAll('pre code').forEach(function (block) {
          if (!block.classList.contains('language-mermaid') && window.hljs) {
            hljs.highlightElement(block);
          }
        });

        if (window.mermaid) {
          el.querySelectorAll('pre code.language-mermaid').forEach(function (block) {
            var pre = block.parentElement;
            var diagram = document.createElement('div');
            diagram.className = 'mermaid';
            diagram.textContent = block.textContent;
            pre.replaceWith(diagram);
          });
          mermaid.run({ nodes: el.querySelectorAll('.mermaid') });
        }

        el.querySelectorAll('a[data-footnote-ref], a[data-footnote-backref]').forEach(function (link) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            var id = link.getAttribute('href').replace(/^#/, '');
            var target = el.querySelector('[id="' + id + '"]');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });

        var item = el.closest('.accordion-item');
        if (item && item.classList.contains('open')) {
          item.querySelector('.accordion-body').style.maxHeight = 'none';
        }
      });
  }

  function loadRepoBadges() {
    var container = document.querySelector('.repo-badges');
    if (!container) return;

    fetch('data/repos.json')
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load repo manifest.');
        return r.json();
      })
      .then(function (repos) {
        container.innerHTML = '';
        repos.forEach(function (repo) {
          var a = document.createElement('a');
          var img = document.createElement('img');

          a.href = repo.html_url;
          a.target = '_blank';
          a.rel = 'noreferrer';

          img.src = 'https://img.shields.io/github/stars/' + repo.full_name + '?style=flat-square&label=' + encodeURIComponent(repo.name);
          img.alt = repo.name;

          a.appendChild(img);
          container.appendChild(a);
        });
        refreshProjectFadeEls();
        queueAnimate();
      })
      .catch(function () {
        container.innerHTML = '<p style="margin:0;color:rgba(40,46,38,0.8)">Could not load project badges.</p>';
        refreshProjectFadeEls();
        queueAnimate();
      });
  }

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
