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
  // Stories have no custom control overlay. Track the playing Story separately.
  let activeStoryVideo = null;

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

  function getVisibleArea(video) {
    if (!(video instanceof HTMLVideoElement) || !document.contains(video)) {
      return 0;
    }
    const rect = video.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) {
      return 0;
    }
    const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return visibleWidth * visibleHeight;
  }

  function getVisibilityScore(video) {
    return isControlledVideo(video) ? getVisibleArea(video) : 0;
  }

  function isStoryVideo(video) {
    return igvc.isStoriesPage() && getVisibleArea(video) > 0;
  }

  function findPlayingStoryVideo() {
    if (!igvc.isStoriesPage()) {
      return null;
    }
    let best = null;
    let score = 0;
    document.querySelectorAll("video").forEach(function (video) {
      if (video.paused || video.ended) return;
      const area = getVisibleArea(video);
      if (area > score) {
        score = area;
        best = video;
      }
    });
    return best;
  }

  function trackStoryVideo() {
    if (!igvc.isStoriesPage()) {
      if (activeStoryVideo) backgroundWantedVideos.delete(activeStoryVideo);
      activeStoryVideo = null;
      return;
    }

    const playing = findPlayingStoryVideo();
    if (playing && playing !== activeStoryVideo) {
      if (activeStoryVideo) {
        backgroundWantedVideos.delete(activeStoryVideo);
        if (!activeStoryVideo.paused) {
          runWithAllowedPause(function () { activeStoryVideo.pause(); });
        }
      }
      activeStoryVideo = playing;
      intentionallyPausedVideos.delete(playing);
      if (document.hidden || !document.hasFocus()) {
        if (getSettings().backgroundPlayback && getSettings().backgroundStories) {
          backgroundWantedVideos.add(playing);
        }
      }
    }
    if (activeStoryVideo && !isStoryVideo(activeStoryVideo)) {
      backgroundWantedVideos.delete(activeStoryVideo);
      activeStoryVideo = null;
    }
  }

  function onStoryPlay(event) {
    const video = event.target;
    if (!isStoryVideo(video)) return;
    if (activeStoryVideo && activeStoryVideo !== video) {
      backgroundWantedVideos.delete(activeStoryVideo);
      if (!activeStoryVideo.paused) {
        runWithAllowedPause(function () { activeStoryVideo.pause(); });
      }
    }
    activeStoryVideo = video;
    intentionallyPausedVideos.delete(video);
    if ((document.hidden || !document.hasFocus()) &&
        getSettings().backgroundPlayback && getSettings().backgroundStories) {
      backgroundWantedVideos.add(video);
    }
  }

  function onStoryPause(event) {
    const video = event.target;
    if (!isStoryVideo(video)) return;
    // Respect foreground pauses (including Instagram's own story pause UI).
    if (!document.hidden && document.hasFocus() && !isInternalPauseAllowed()) {
      intentionallyPausedVideos.add(video);
      backgroundWantedVideos.delete(video);
    }
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
    if (igvc.isStoriesPage()) return;
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
    if (allowInternalPause || intentionallyPausedVideos.has(media)) {
      return false;
    }

    const pageIsInactive = document.hidden ||
      document.visibilityState === "hidden" || !document.hasFocus();

    if (igvc.isStoriesPage()) {
      // Only protect a Story which was already playing. Do not restart a Story
      // paused by the user and do not intercept navigation in the foreground.
      return settings.backgroundPlayback && settings.backgroundStories &&
        pageIsInactive && media === activeStoryVideo &&
        isStoryVideo(media) && !media.ended;
    }

    if (!settings.backgroundPlayback && !settings.keepCurrentVideoPlaying) {
      return false;
    }
    if (!isControlledVideo(media)) {
      return false;
    }
    if (!isControlledVideo(igvc.activeVideo)) {
      igvc.activeVideo = media;
    }
    if (media !== igvc.activeVideo) {
      return false;
    }
    return pageIsInactive ? settings.backgroundPlayback : settings.keepCurrentVideoPlaying;
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

    if (igvc.isStoriesPage()) {
      if (!getSettings().backgroundStories) return;
      trackStoryVideo();
      // Instagram can pause just before our visibility listener executes.
      // The tracked Story was previously playing, so it is a valid fallback.
      const story = findPlayingStoryVideo() || activeStoryVideo;
      if (story && isStoryVideo(story) && !story.ended &&
          !intentionallyPausedVideos.has(story)) {
        activeStoryVideo = story;
        backgroundWantedVideos.add(story);
      }
      return;
    }

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
      const story = isStoryVideo(video);
      if (story && (!getSettings().backgroundPlayback || !getSettings().backgroundStories)) {
        backgroundWantedVideos.delete(video);
        return;
      }
      if (!story && !isControlledVideo(video)) {
        backgroundWantedVideos.delete(video);
        return;
      }
      if (story ? video !== activeStoryVideo : video !== igvc.activeVideo) {
        backgroundWantedVideos.delete(video);
        return;
      }
      if (intentionallyPausedVideos.has(video) || video.ended) {
        backgroundWantedVideos.delete(video);
        return;
      }
      try {
        // Stories retain Instagram's own volume/speed and navigation logic.
        if (!story) {
          applySavedState(video);
          pauseOtherVideosExcept(video);
        }
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

    document.addEventListener("play", onStoryPlay, true);
    document.addEventListener("pause", onStoryPause, true);
    // This is not requestAnimationFrame: that API stops in background tabs.
    setInterval(trackStoryVideo, 1000);
    trackStoryVideo();

    window.addEventListener(
      "blur",
      function () {
        trackStoryVideo();
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
          trackStoryVideo();
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
        trackStoryVideo();

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
  igvc.isStoryVideo = isStoryVideo;
  igvc.findPlayingStoryVideo = findPlayingStoryVideo;
  igvc.trackStoryVideo = trackStoryVideo;
  igvc.installBackgroundPlaybackHandlers = installBackgroundPlaybackHandlers;
})();
