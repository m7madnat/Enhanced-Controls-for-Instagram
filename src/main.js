(function () {
  const igvc = window.__igvc;

  const {
    SCAN_INTERVAL_MS,
    overlays,
    attachControls,
    installBackgroundPlaybackHandlers,
    installPauseGuard,
    isAllowedPage,
    isVideoVisible,
  } = igvc;

  let scanRafId = null;
  let lastActiveVideo = null;

  function cleanupOverlay(video) {
    const overlay = overlays.get(video);

    if (!overlay || typeof overlay.cleanup !== "function") {
      return;
    }

    overlay.cleanup();
  }

  function cleanupAllExcept(activeVideo) {
    overlays.forEach(function (overlay, video) {
      if (video !== activeVideo && overlay && typeof overlay.cleanup === "function") {
        overlay.cleanup();
      }
    });
  }

  function cleanupAll() {
    overlays.forEach(function (overlay) {
      if (overlay && typeof overlay.cleanup === "function") {
        overlay.cleanup();
      }
    });

    overlays.clear();
    lastActiveVideo = null;
  }

  function getVisibleVideos() {
    return Array.from(document.querySelectorAll("video")).filter(function (video) {
      return isVideoVisible(video);
    });
  }

  function getVisibleArea(video) {
    const rect = video.getBoundingClientRect();

    const visibleLeft = Math.max(rect.left, 0);
    const visibleTop = Math.max(rect.top, 0);
    const visibleRight = Math.min(rect.right, window.innerWidth);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight);

    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    return visibleWidth * visibleHeight;
  }

  function getViewportCenterDistance(video) {
    const rect = video.getBoundingClientRect();

    const videoCenterX = rect.left + rect.width / 2;
    const videoCenterY = rect.top + rect.height / 2;

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    const dx = videoCenterX - viewportCenterX;
    const dy = videoCenterY - viewportCenterY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  function findActiveVideo() {
    const videos = getVisibleVideos();

    if (videos.length === 0) {
      return null;
    }

    const playingVideos = videos.filter(function (video) {
      return !video.paused && !video.ended;
    });

    const candidates = playingVideos.length > 0 ? playingVideos : videos;

    candidates.sort(function (a, b) {
      const areaDiff = getVisibleArea(b) - getVisibleArea(a);

      if (Math.abs(areaDiff) > 1000) {
        return areaDiff;
      }

      return getViewportCenterDistance(a) - getViewportCenterDistance(b);
    });

    return candidates[0] || null;
  }

  function pauseOtherVideos(activeVideo) {
    document.querySelectorAll("video").forEach(function (video) {
      if (video === activeVideo) {
        return;
      }

      if (!video.paused && !video.ended) {
        try {
          video.pause();
        } catch (error) {
          console.warn("IGVC: failed to pause non-active video", error);
        }
      }
    });
  }

  function attachOnlyActiveVideo() {
    if (!isAllowedPage()) {
      cleanupAll();
      return;
    }

    const activeVideo = findActiveVideo();

    if (!activeVideo) {
      cleanupAll();
      return;
    }

    if (lastActiveVideo && lastActiveVideo !== activeVideo) {
      cleanupOverlay(lastActiveVideo);
    }

    cleanupAllExcept(activeVideo);
    pauseOtherVideos(activeVideo);

    if (!overlays.has(activeVideo)) {
      attachControls(activeVideo);
    }

    lastActiveVideo = activeVideo;
  }

  function scheduleScan() {
    if (scanRafId !== null) {
      return;
    }

    scanRafId = requestAnimationFrame(function () {
      scanRafId = null;
      attachOnlyActiveVideo();
    });
  }

  function start() {
    installPauseGuard();
    installBackgroundPlaybackHandlers();

    attachOnlyActiveVideo();

    const observer = new MutationObserver(function () {
      scheduleScan();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("scroll", scheduleScan, true);
    window.addEventListener("resize", scheduleScan, true);
    window.addEventListener("focus", scheduleScan, true);
    document.addEventListener("visibilitychange", scheduleScan, true);

    setInterval(attachOnlyActiveVideo, SCAN_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();