(function () {
  const igvc = window.__igvc;

  function normalizeInstagramUrl(href) {
    if (!href) {
      return null;
    }

    try {
      const url = new URL(href, window.location.origin);

      url.search = "";
      url.hash = "";

      return url.toString();
    } catch (error) {
      return null;
    }
  }

  function isInstagramPostOrReelUrl(url) {
    if (!url) {
      return false;
    }

    try {
      const parsed = new URL(url);

      return (
        parsed.hostname.includes("instagram.com") &&
        (parsed.pathname.startsWith("/p/") ||
          parsed.pathname.startsWith("/reel/") ||
          parsed.pathname.startsWith("/reels/"))
      );
    } catch (error) {
      return false;
    }
  }

  function getVideoPostUrl(video) {
    const currentPageUrl = normalizeInstagramUrl(window.location.href);

    if (isInstagramPostOrReelUrl(currentPageUrl)) {
      return currentPageUrl;
    }

    const article = video.closest("article");

    if (article) {
      const links = article.querySelectorAll("a[href]");

      for (const link of links) {
        const url = normalizeInstagramUrl(link.getAttribute("href"));

        if (isInstagramPostOrReelUrl(url)) {
          return url;
        }
      }
    }

    let parent = video.parentElement;

    while (parent && parent !== document.body) {
      const links = parent.querySelectorAll?.("a[href]") || [];

      for (const link of links) {
        const url = normalizeInstagramUrl(link.getAttribute("href"));

        if (isInstagramPostOrReelUrl(url)) {
          return url;
        }
      }

      parent = parent.parentElement;
    }

    return null;
  }

  function getFastDlUrl(video) {
    const postUrl = getVideoPostUrl(video);

    if (!postUrl) {
      return null;
    }

    return `https://f-d.app/${postUrl}`;
  }

  igvc.normalizeInstagramUrl = normalizeInstagramUrl;
  igvc.isInstagramPostOrReelUrl = isInstagramPostOrReelUrl;
  igvc.getVideoPostUrl = getVideoPostUrl;
  igvc.getFastDlUrl = getFastDlUrl;
})();
