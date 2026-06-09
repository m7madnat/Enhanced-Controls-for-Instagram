(function () {
  const igvc = window.__igvc;
  const {
    SCAN_INTERVAL_MS,
    overlays,
    attachControls,
    installBackgroundPlaybackHandlers,
    installKeyboardShortcuts,
    installPauseGuard,
    isAllowedPage,
    enforceSinglePlayingVideo,
  } = igvc;

  function cleanupAll() {
    overlays.forEach(function (overlay) {
      overlay.cleanup();
    });

    overlays.clear();
  }

  function scanVideos() {
    if (!isAllowedPage()) {
      cleanupAll();
      return;
    }

    const videos = document.querySelectorAll("video");

    videos.forEach(function (video) {
      attachControls(video);
    });

    enforceSinglePlayingVideo();
  }

  function start() {
    installPauseGuard();
    installBackgroundPlaybackHandlers();
    installKeyboardShortcuts();

    scanVideos();

    const observer = new MutationObserver(function () {
      scanVideos();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setInterval(scanVideos, SCAN_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
