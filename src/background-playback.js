(function () {
  const igvc = window.__igvc;
  const {
    EXTENSION_MARK,
    overlays,
    intentionallyPausedVideos,
    backgroundWantedVideos,
  } = igvc;

  const {
    applySavedState,
    forceSavedStateOnAllVideos,
    forceSavedStateRepeatedly,
    getSettings,
  } = igvc;

  let allowInternalPause = false;
  let backgroundHandlersInstalled = false;

  function runWithAllowedPause(callback) {
    allowInternalPause = true;

    try {
      return callback();
    } finally {
      allowInternalPause = false;
    }
  }

  function isInternalPauseAllowed() {
    return allowInternalPause;
  }

  function isControlledVideo(video) {
    return (
      video instanceof HTMLVideoElement &&
      video.dataset &&
      video.dataset[EXTENSION_MARK] === "true" &&
      document.contains(video)
    );
  }

  function getControlledVideos() {
    const found = new Set();

    overlays.forEach(function (_overlay, video) {
      if (isControlledVideo(video)) {
        found.add(video);
      }
    });

    document.querySelectorAll("video").forEach(function (video) {
      if (isControlledVideo(video)) {
        found.add(video);
      }
    });

    return Array.from(found);
  }

  function getVisibilityScore(video) {
    if (!isControlledVideo(video)) {
      return 0;
    }

    const rect = video.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return 0;
    }

    const visibleWidth = Math.max(
      0,
      Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
    );
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
    );

    return visibleWidth * visibleHeight;
  }

  function getBestPlayingVideo() {
    let bestVideo = null;
    let bestScore = 0;

    getControlledVideos().forEach(function (video) {
      if (video.paused || video.ended) {
        return;
      }

      const score = getVisibilityScore(video);

      if (score > bestScore) {
        bestScore = score;
        bestVideo = video;
      }
    });

    return bestVideo;
  }

  function setActiveControlledVideo(video, shouldPauseOthers) {
    if (!isControlledVideo(video)) {
      return;
    }

    igvc.activeVideo = video;

    if (shouldPauseOthers) {
      pauseOtherVideosExcept(video);
    }
  }

  function pauseOtherVideosExcept(activeVideo) {
    getControlledVideos().forEach(function (video) {
      if (video === activeVideo) {
        return;
      }

      backgroundWantedVideos.delete(video);

      if (!video.paused && !video.ended) {
        runWithAllowedPause(function () {
          video.pause();
        });
      }
    });
  }

  function enforceSinglePlayingVideo() {
    const activeVideo = isControlledVideo(igvc.activeVideo)
      ? igvc.activeVideo
      : getBestPlayingVideo();

    if (!activeVideo) {
      igvc.activeVideo = null;
      return;
    }

    setActiveControlledVideo(activeVideo, true);
  }

  function shouldBlockInstagramAutoPause(media) {
    const settings = getSettings();

    if (!settings.backgroundPlayback && !settings.keepCurrentVideoPlaying) {
      return false;
    }

    if (!isControlledVideo(media)) {
      return false;
    }

    if (allowInternalPause) {
      return false;
    }

    if (intentionallyPausedVideos.has(media)) {
      return false;
    }

    if (!isControlledVideo(igvc.activeVideo)) {
      igvc.activeVideo = media;
    }

    if (media !== igvc.activeVideo) {
      return false;
    }

    const pageIsInactive =
      document.hidden ||
      document.visibilityState === "hidden" ||
      !document.hasFocus();

    if (pageIsInactive) {
      return settings.backgroundPlayback;
    }

    return settings.keepCurrentVideoPlaying;
  }

  function installPauseGuard() {
    if (window.__igvcPauseGuardInstalled === true) {
      return;
    }

    window.__igvcPauseGuardInstalled = true;

    const nativePause = HTMLMediaElement.prototype.pause;

    HTMLMediaElement.prototype.pause = function (...args) {
      if (shouldBlockInstagramAutoPause(this)) {
        return;
      }

      return nativePause.apply(this, args);
    };
  }

  function rememberPlayingVideosBeforeBackground() {
    backgroundWantedVideos.clear();

    const activeVideo = isControlledVideo(igvc.activeVideo)
      ? igvc.activeVideo
      : getBestPlayingVideo();

    if (activeVideo && !activeVideo.paused && !activeVideo.ended) {
      igvc.activeVideo = activeVideo;
      backgroundWantedVideos.add(activeVideo);
      intentionallyPausedVideos.delete(activeVideo);
    }
  }

  function resumeBackgroundVideos() {
    backgroundWantedVideos.forEach(function (video) {
      if (!isControlledVideo(video)) {
        backgroundWantedVideos.delete(video);
        return;
      }

      if (video !== igvc.activeVideo) {
        backgroundWantedVideos.delete(video);
        return;
      }

      if (intentionallyPausedVideos.has(video) || video.ended) {
        return;
      }

      try {
        applySavedState(video);
        pauseOtherVideosExcept(video);

        if (video.paused) {
          video.play().catch(function (error) {
            console.warn("IGVC: failed to resume background video", error);
          });
        }
      } catch (error) {
        console.warn("IGVC: background resume failed", error);
      }
    });
  }

  function keepPlayingAfterPageBecomesInactive() {
    if (!getSettings().backgroundPlayback) {
      return;
    }

    rememberPlayingVideosBeforeBackground();

    [50, 150, 400, 900, 1600].forEach(function (delay) {
      setTimeout(function () {
        forceSavedStateOnAllVideos();
        resumeBackgroundVideos();
        enforceSinglePlayingVideo();
      }, delay);
    });
  }

  function installBackgroundPlaybackHandlers() {
    if (backgroundHandlersInstalled) {
      return;
    }

    backgroundHandlersInstalled = true;

    window.addEventListener(
      "blur",
      function () {
        forceSavedStateRepeatedly();
        keepPlayingAfterPageBecomesInactive();
      },
      true,
    );

    document.addEventListener(
      "visibilitychange",
      function () {
        forceSavedStateRepeatedly();

        if (document.hidden || document.visibilityState === "hidden") {
          keepPlayingAfterPageBecomesInactive();
        }
      },
      true,
    );

    window.addEventListener(
      "focus",
      function () {
        forceSavedStateRepeatedly();
        enforceSinglePlayingVideo();

        setTimeout(function () {
          backgroundWantedVideos.clear();
        }, 2000);
      },
      true,
    );

    window.addEventListener(
      "pageshow",
      function () {
        forceSavedStateRepeatedly();
        enforceSinglePlayingVideo();
      },
      true,
    );
  }

  igvc.runWithAllowedPause = runWithAllowedPause;
  igvc.isInternalPauseAllowed = isInternalPauseAllowed;
  igvc.isControlledVideo = isControlledVideo;
  igvc.getControlledVideos = getControlledVideos;
  igvc.setActiveControlledVideo = setActiveControlledVideo;
  igvc.pauseOtherVideosExcept = pauseOtherVideosExcept;
  igvc.enforceSinglePlayingVideo = enforceSinglePlayingVideo;
  igvc.shouldBlockInstagramAutoPause = shouldBlockInstagramAutoPause;
  igvc.installPauseGuard = installPauseGuard;
  igvc.rememberPlayingVideosBeforeBackground =
    rememberPlayingVideosBeforeBackground;
  igvc.resumeBackgroundVideos = resumeBackgroundVideos;
  igvc.keepPlayingAfterPageBecomesInactive = keepPlayingAfterPageBecomesInactive;
  igvc.installBackgroundPlaybackHandlers = installBackgroundPlaybackHandlers;
})();
