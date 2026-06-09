(function () {
  const igvc = window.__igvc;
  const { EXTENSION_MARK, clamp } = igvc;

  function isStoriesPage() {
    return window.location.pathname.startsWith("/stories/");
  }

  function isAllowedPage() {
    const path = window.location.pathname;

    if (path.startsWith("/stories/")) {
      return false;
    }

    return (
      path === "/" ||
      path.startsWith("/reel/") ||
      path.startsWith("/reels/") ||
      path.startsWith("/p/") ||
      path.startsWith("/explore/") ||
      path.startsWith("/tv/")
    );
  }

  function isAllowedVideo(video) {
    if (!video) {
      return false;
    }

    if (video.dataset[EXTENSION_MARK] === "true") {
      return false;
    }

    if (!isAllowedPage()) {
      return false;
    }

    const storyParent = video.closest(
      'a[href^="/stories/"], a[href*="/stories/"]',
    );

    if (storyParent) {
      return false;
    }

    return true;
  }

  function isVideoVisible(video) {
    const rect = video.getBoundingClientRect();

    if (rect.width < 120 || rect.height < 120) {
      return false;
    }

    if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
      return false;
    }

    if (rect.right <= 0 || rect.left >= window.innerWidth) {
      return false;
    }

    return true;
  }

  function isMouseInsideRect(event, rect) {
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function getDuration(video) {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      return video.duration;
    }

    return 0;
  }

  function setVideoTime(video, time) {
    const duration = getDuration(video);

    try {
      if (duration > 0) {
        video.currentTime = clamp(time, 0, duration);
      } else {
        video.currentTime = Math.max(0, time);
      }
    } catch (error) {
      console.warn("IGVC: failed to seek video", error);
    }
  }

  igvc.isStoriesPage = isStoriesPage;
  igvc.isAllowedPage = isAllowedPage;
  igvc.isAllowedVideo = isAllowedVideo;
  igvc.isVideoVisible = isVideoVisible;
  igvc.isMouseInsideRect = isMouseInsideRect;
  igvc.formatTime = formatTime;
  igvc.getDuration = getDuration;
  igvc.setVideoTime = setVideoTime;
})();
