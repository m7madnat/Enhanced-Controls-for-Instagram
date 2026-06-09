(function () {
  const igvc = window.__igvc;
  const {
    applySavedState,
    clamp,
    forceSavedStateRepeatedly,
    getFastDlUrl,
    getSettings,
    isVideoVisible,
    runWithAllowedPause,
    setActiveControlledVideo,
    pauseOtherVideosExcept,
    saveState,
    setVideoTime,
  } = igvc;

  function isTypingTarget(target) {
    if (!target) {
      return false;
    }

    const tagName = target.tagName ? target.tagName.toLowerCase() : "";

    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target.isContentEditable === true
    );
  }

  function getActiveVideo() {
    if (igvc.activeVideo && document.contains(igvc.activeVideo) && isVideoVisible(igvc.activeVideo)) {
      return igvc.activeVideo;
    }

    for (const video of document.querySelectorAll("video")) {
      if (video.dataset?.[igvc.EXTENSION_MARK] === "true" && isVideoVisible(video)) {
        setActiveControlledVideo(video, false);
        return video;
      }
    }

    return null;
  }

  async function togglePlay(video) {
    try {
      applySavedState(video);

      if (video.paused) {
        igvc.intentionallyPausedVideos.delete(video);
        setActiveControlledVideo(video, true);
        await video.play();
        pauseOtherVideosExcept(video);
      } else {
        igvc.intentionallyPausedVideos.add(video);

        runWithAllowedPause(function () {
          video.pause();
        });
      }
    } catch (error) {
      console.warn("IGVC: keyboard play/pause failed", error);
    }
  }

  function changeVolume(video, delta) {
    setActiveControlledVideo(video, false);

    const nextVolume = clamp(video.volume + delta, 0, 1);

    video.volume = nextVolume;
    video.muted = nextVolume === 0;

    saveState({
      volume: video.volume,
      muted: video.muted,
      playbackRate: video.playbackRate,
    });

    forceSavedStateRepeatedly();
  }

  function toggleMute(video) {
    setActiveControlledVideo(video, false);

    if (video.muted || video.volume === 0) {
      const settings = getSettings();
      video.volume = video.volume === 0 ? settings.defaultVolume : video.volume;
      video.muted = false;
    } else {
      video.muted = true;
    }

    saveState({
      volume: video.volume,
      muted: video.muted,
      playbackRate: video.playbackRate,
    });

    forceSavedStateRepeatedly();
  }

  function setSpeed(video, speed) {
    setActiveControlledVideo(video, false);

    video.playbackRate = speed;

    saveState({
      volume: video.volume,
      muted: video.muted,
      playbackRate: video.playbackRate,
    });

    forceSavedStateRepeatedly();
  }

  function openDownload(video) {
    const downloadUrl = getFastDlUrl(video);

    if (!downloadUrl) {
      console.warn("IGVC: could not find download URL for active video.");
      return;
    }

    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  function handleKeyDown(event) {
    const settings = getSettings();

    if (!settings.keyboardShortcutsEnabled || isTypingTarget(event.target)) {
      return;
    }

    const video = getActiveVideo();

    if (!video) {
      return;
    }

    let handled = true;

    switch (event.key) {
      case " ":
      case "Spacebar":
        togglePlay(video);
        break;
      case "ArrowRight":
        setVideoTime(video, video.currentTime + settings.seekStepSeconds);
        break;
      case "ArrowLeft":
        setVideoTime(video, video.currentTime - settings.seekStepSeconds);
        break;
      case "ArrowUp":
        changeVolume(video, settings.volumeStep);
        break;
      case "ArrowDown":
        changeVolume(video, -settings.volumeStep);
        break;
      case "m":
      case "M":
        toggleMute(video);
        break;
      case "d":
      case "D":
        if (settings.showDownloadButton) {
          openDownload(video);
        }
        break;
      case "1":
        setSpeed(video, 1);
        break;
      case "2":
        setSpeed(video, 2);
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function installKeyboardShortcuts() {
    document.addEventListener("keydown", handleKeyDown, true);
  }

  igvc.installKeyboardShortcuts = installKeyboardShortcuts;
})();
