(function () {
  const igvc = window.__igvc;
  const {
    EXTENSION_MARK,
    BAR_HEIGHT,
    VOLUME_WIDTH,
    VOLUME_HEIGHT,
    POSITION_INTERVAL_MS,
    HIDE_DELAY_MS,
    VOLUME_HIDE_DELAY_MS,
    overlays,
    intentionallyPausedVideos,
  } = igvc;

  const {
    applySavedState,
    clamp,
    createBarIframe,
    createVolumeIframe,
    forceSavedStateRepeatedly,
    formatTime,
    getDuration,
    getFastDlUrl,
    getPreferredState,
    getSettings,
    hasPreferredStateMismatch,
    pauseOtherVideosExcept,
    setActiveControlledVideo,
    isAllowedVideo,
    isInternalPauseAllowed,
    isMouseInsideRect,
    isStoriesPage,
    isVideoVisible,
    runWithAllowedPause,
    saveState,
    setVideoTime,
  } = igvc;

  function attachControls(video) {
    if (!isAllowedVideo(video)) {
      return;
    }

    video.dataset[EXTENSION_MARK] = "true";

    applySavedState(video);

    const barIframe = createBarIframe();
    const volumeIframe = createVolumeIframe();

    const barDoc = barIframe.contentDocument;
    const volumeDoc = volumeIframe.contentDocument;

    const playButton = barDoc.getElementById("playButton");
    const muteButton = barDoc.getElementById("muteButton");
    const downloadButton = barDoc.getElementById("downloadButton");
    const seekBar = barDoc.getElementById("seekBar");
    const timeText = barDoc.getElementById("timeText");
    const speedSelect = barDoc.getElementById("speedSelect");

    const volumeSlider = volumeDoc.getElementById("volumeSlider");

    let isSeeking = false;
    let hideTimer = null;
    let volumeHideTimer = null;
    let mediaStateFixTimer = null;
    let isVolumeOpen = false;

    function showControls() {
      setActiveControlledVideo(video, false);

      if (!isVideoVisible(video)) {
        return;
      }

      clearTimeout(hideTimer);

      updatePosition();

      barIframe.style.opacity = "1";
      barIframe.style.transform = "translateY(0px)";
      barIframe.style.pointerEvents = "auto";
    }

    function hideControls() {
      if (!getSettings().showControlsOnlyOnHover) {
        showControls();
        return;
      }

      if (isSeeking || isVolumeOpen) {
        return;
      }

      barIframe.style.opacity = "0";
      barIframe.style.transform = "translateY(12px)";
      barIframe.style.pointerEvents = "none";

      hideVolumePanel();
    }

    function scheduleHide() {
      if (!getSettings().showControlsOnlyOnHover) {
        showControls();
        return;
      }

      clearTimeout(hideTimer);

      hideTimer = setTimeout(function () {
        hideControls();
      }, HIDE_DELAY_MS);
    }

    function showVolumePanel() {
      isVolumeOpen = true;
      clearTimeout(volumeHideTimer);
      updatePosition();

      volumeIframe.style.display = "block";
      volumeIframe.style.opacity = "1";
      volumeIframe.style.transform = "translateY(0px)";
      volumeIframe.style.pointerEvents = "auto";

      showControls();
    }

    function hideVolumePanel() {
      isVolumeOpen = false;

      volumeIframe.style.opacity = "0";
      volumeIframe.style.transform = "translateY(8px)";
      volumeIframe.style.pointerEvents = "none";

      setTimeout(function () {
        if (!isVolumeOpen) {
          volumeIframe.style.display = "none";
        }
      }, 150);
    }

    function scheduleVolumeHide() {
      clearTimeout(volumeHideTimer);

      volumeHideTimer = setTimeout(function () {
        hideVolumePanel();
      }, VOLUME_HIDE_DELAY_MS);
    }

    function updatePosition() {
      if (!document.contains(video) || isStoriesPage()) {
        cleanup();
        return;
      }

      if (!isVideoVisible(video)) {
        barIframe.style.display = "none";
        volumeIframe.style.display = "none";
        return;
      }

      const rect = video.getBoundingClientRect();
      const viewportPadding = 4;

      const barWidth = clamp(
        rect.width,
        260,
        window.innerWidth - viewportPadding * 2,
      );

      const barLeft = clamp(
        rect.left,
        viewportPadding,
        window.innerWidth - barWidth - viewportPadding,
      );

      let barTop = rect.bottom - BAR_HEIGHT;

      if (barTop < rect.top) {
        barTop = rect.top;
      }

      if (barTop + BAR_HEIGHT > window.innerHeight) {
        barTop = window.innerHeight - BAR_HEIGHT;
      }

      barIframe.style.left = `${barLeft}px`;
      barIframe.style.top = `${barTop}px`;
      barIframe.style.width = `${barWidth}px`;
      barIframe.style.height = `${BAR_HEIGHT}px`;
      barIframe.style.display = "block";

      const volumeLeft = clamp(
        barLeft + barWidth - VOLUME_WIDTH - 2,
        viewportPadding,
        window.innerWidth - VOLUME_WIDTH - viewportPadding,
      );

      const volumeTop = clamp(
        barTop - VOLUME_HEIGHT,
        viewportPadding,
        window.innerHeight - VOLUME_HEIGHT - viewportPadding,
      );

      volumeIframe.style.left = `${volumeLeft}px`;
      volumeIframe.style.top = `${volumeTop}px`;
      volumeIframe.style.width = `${VOLUME_WIDTH}px`;
      volumeIframe.style.height = `${VOLUME_HEIGHT}px`;
    }

    function updateUi() {
      const settings = getSettings();
      const duration = getDuration(video);
      const currentTime = video.currentTime || 0;

      seekBar.max = duration > 0 ? String(duration) : "100";

      if (!isSeeking) {
        seekBar.value = String(currentTime);
      }

      timeText.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

      playButton.textContent = video.paused ? "▶" : "❚❚";
      muteButton.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";

      downloadButton.style.display = settings.showDownloadButton ? "" : "none";

      volumeSlider.value = String(video.volume);

      const speedValue = String(video.playbackRate);

      if (
        [...speedSelect.options].some((option) => option.value === speedValue)
      ) {
        speedSelect.value = speedValue;
      }
    }

    function handleMediaStateChange() {
      updateUi();

      if (!getPreferredState().hasState) {
        return;
      }

      if (!hasPreferredStateMismatch(video)) {
        return;
      }

      clearTimeout(mediaStateFixTimer);

      mediaStateFixTimer = setTimeout(function () {
        if (hasPreferredStateMismatch(video)) {
          applySavedState(video);
          updateUi();
        }
      }, 80);
    }

    async function togglePlay() {
      try {
        applySavedState(video);

        if (video.paused) {
          intentionallyPausedVideos.delete(video);
          setActiveControlledVideo(video, true);
          await video.play();
          pauseOtherVideosExcept(video);
        } else {
          intentionallyPausedVideos.add(video);

          runWithAllowedPause(function () {
            video.pause();
          });
        }
      } catch (error) {
        console.warn("IGVC: failed to play/pause", error);
      }

      updateUi();
      showControls();
    }

    function handlePlay() {
      intentionallyPausedVideos.delete(video);
      setActiveControlledVideo(video, true);
      applySavedState(video);
      pauseOtherVideosExcept(video);
      updateUi();
    }

    function handlePause() {
      if (
        igvc.activeVideo === video &&
        !document.hidden &&
        document.hasFocus() &&
        !isInternalPauseAllowed()
      ) {
        intentionallyPausedVideos.add(video);
      }

      updateUi();
    }

    function handleDocumentMouseMove(event) {
      if (!document.contains(video)) {
        cleanup();
        return;
      }

      if (!isVideoVisible(video)) {
        hideControls();
        return;
      }

      const rect = video.getBoundingClientRect();

      if (isMouseInsideRect(event, rect)) {
        showControls();
      } else {
        scheduleHide();
      }
    }

    function cleanup() {
      clearInterval(positionTimer);
      clearTimeout(hideTimer);
      clearTimeout(volumeHideTimer);
      clearTimeout(mediaStateFixTimer);

      document.removeEventListener("mousemove", handleDocumentMouseMove, true);

      video.removeEventListener("timeupdate", updateUi);
      video.removeEventListener("durationchange", updateUi);
      video.removeEventListener("loadedmetadata", updateUi);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleMediaStateChange);
      video.removeEventListener("ratechange", handleMediaStateChange);

      delete video.dataset[EXTENSION_MARK];

      overlays.delete(video);

      if (igvc.activeVideo === video) {
        igvc.activeVideo = null;
      }

      if (barIframe && barIframe.parentElement) {
        barIframe.remove();
      }

      if (volumeIframe && volumeIframe.parentElement) {
        volumeIframe.remove();
      }
    }

    playButton.addEventListener("click", function () {
      togglePlay();
    });

    muteButton.addEventListener("click", function () {
      if (video.muted || video.volume === 0) {
        if (video.volume === 0) {
          const preferredState = getPreferredState();

          video.volume =
            preferredState.volume && preferredState.volume > 0
              ? preferredState.volume
              : 0.7;
        }

        video.muted = false;
      } else {
        video.muted = true;
      }

      saveState({
        muted: video.muted,
        volume: video.volume,
        playbackRate: video.playbackRate,
      });

      forceSavedStateRepeatedly();

      updateUi();
      showVolumePanel();
    });

    muteButton.addEventListener("mouseenter", function () {
      showVolumePanel();
    });

    muteButton.addEventListener("mouseleave", function () {
      scheduleVolumeHide();
    });

    volumeDoc.addEventListener("mouseenter", function () {
      showVolumePanel();
    });

    volumeDoc.addEventListener("mousemove", function () {
      showVolumePanel();
    });

    volumeDoc.addEventListener("mouseleave", function () {
      scheduleVolumeHide();
    });

    downloadButton.addEventListener("click", function () {
      const downloadUrl = getFastDlUrl(video);

      if (!downloadUrl) {
        alert("Could not find the Instagram post or reel link for this video.");
        showControls();
        return;
      }

      window.open(downloadUrl, "_blank", "noopener,noreferrer");

      showControls();
    });

    seekBar.addEventListener("mousedown", function () {
      isSeeking = true;
      showControls();
    });

    seekBar.addEventListener("mouseup", function () {
      isSeeking = false;
      setVideoTime(video, Number(seekBar.value));
      updateUi();
      showControls();
      scheduleHide();
    });

    seekBar.addEventListener("input", function () {
      setVideoTime(video, Number(seekBar.value));
      updateUi();
      showControls();
    });

    seekBar.addEventListener("change", function () {
      isSeeking = false;
      setVideoTime(video, Number(seekBar.value));
      updateUi();
      showControls();
      scheduleHide();
    });

    speedSelect.addEventListener("change", function () {
      const nextSpeed = Number(speedSelect.value);

      if (Number.isFinite(nextSpeed) && nextSpeed > 0) {
        video.playbackRate = nextSpeed;

        saveState({
          playbackRate: video.playbackRate,
          muted: video.muted,
          volume: video.volume,
        });

        forceSavedStateRepeatedly();
      }

      updateUi();
      showControls();
    });

    volumeSlider.addEventListener("mousedown", function () {
      isSeeking = true;
      showVolumePanel();
    });

    volumeSlider.addEventListener("mouseup", function () {
      isSeeking = false;
      showVolumePanel();
    });

    volumeSlider.addEventListener("input", function () {
      const nextVolume = Number(volumeSlider.value);

      if (Number.isFinite(nextVolume)) {
        video.volume = clamp(nextVolume, 0, 1);

        if (video.volume === 0) {
          video.muted = true;
        } else {
          video.muted = false;
        }

        saveState({
          volume: video.volume,
          muted: video.muted,
          playbackRate: video.playbackRate,
        });

        forceSavedStateRepeatedly();
      }

      updateUi();
      showVolumePanel();
    });

    barDoc.addEventListener("mousemove", function () {
      showControls();
    });

    barDoc.addEventListener("mouseleave", function () {
      scheduleHide();
    });

    document.addEventListener("mousemove", handleDocumentMouseMove, true);

    video.addEventListener("timeupdate", updateUi);
    video.addEventListener("durationchange", updateUi);
    video.addEventListener("loadedmetadata", updateUi);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleMediaStateChange);
    video.addEventListener("ratechange", handleMediaStateChange);

    const positionTimer = setInterval(function () {
      updatePosition();
      updateUi();
    }, POSITION_INTERVAL_MS);

    overlays.set(video, {
      barIframe,
      volumeIframe,
      cleanup,
    });

    if (!video.paused && !video.ended && isVideoVisible(video)) {
      setActiveControlledVideo(video, true);
    }

    setTimeout(function () {
      applySavedState(video);
      updateUi();
      updatePosition();
      if (getSettings().showControlsOnlyOnHover) {
        hideControls();
      } else {
        showControls();
      }
    }, 300);

    setTimeout(function () {
      applySavedState(video);
      updateUi();
      updatePosition();
      if (getSettings().showControlsOnlyOnHover) {
        hideControls();
      } else {
        showControls();
      }
    }, 900);

    updatePosition();
    updateUi();

    if (getSettings().showControlsOnlyOnHover) {
      hideControls();
    } else {
      showControls();
    }

    console.log("IGVC: controls attached", video);
  }

  igvc.attachControls = attachControls;
})();
