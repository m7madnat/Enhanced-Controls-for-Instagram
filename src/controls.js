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
    createCompactLauncherIframe,
    computeControlsPlacement,
    computeFeedOverlayPlacement,
    isDockingAreaSafe,
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
    const launcherIframe = createCompactLauncherIframe();

    const barDoc = barIframe.contentDocument;
    const volumeDoc = volumeIframe.contentDocument;
    const launcherDoc = launcherIframe.contentDocument;

    const playButton = barDoc.getElementById("playButton");
    const collapseButton = barDoc.getElementById("collapseButton");
    const openControlsButton = launcherDoc.getElementById("openControls");
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
    let isCompact = false;
    // New videos start expanded, even in the collision-safe compact fallback.
    let isExpanded = true;
    let manuallyCollapsed = false;
    let pointerOverVideo = false;
    let isCleanedUp = false;

    function updateLauncherVisibility() {
      const show = isVideoVisible(video) && (
        manuallyCollapsed || (isCompact && !isExpanded &&
          (pointerOverVideo || !getSettings().showControlsOnlyOnHover))
      );
      launcherIframe.style.display = show ? "block" : "none";
      launcherIframe.style.opacity = show ? "1" : "0";
      launcherIframe.style.pointerEvents = show ? "auto" : "none";
    }

    function showControls(expand = false) {
      // Only pressing the launcher can override an explicit manual collapse.
      if (isCleanedUp || (manuallyCollapsed && !expand)) return;
      if (expand) {
        manuallyCollapsed = false;
        isExpanded = true;
      }

      setActiveControlledVideo(video, false);
      if (!isVideoVisible(video)) {
        return;
      }

      clearTimeout(hideTimer);
      // Do not reveal a stale off-video toolbar if the visible video region
      // has become too small (e.g., while scrolling past a feed post).
      if (!updatePosition()) return;
      // Normally expanded from the outset; if closed, only ☷ reopens it.
      const showBar = !manuallyCollapsed && (!isCompact || isExpanded);
      barIframe.style.display = showBar ? "block" : "none";
      barIframe.style.opacity = showBar ? "1" : "0";
      barIframe.style.transform = "translateY(0px)";
      barIframe.style.pointerEvents = showBar ? "auto" : "none";
      updateLauncherVisibility();
    }

    function collapseControls() {
      manuallyCollapsed = true;
      isExpanded = false;
      clearTimeout(hideTimer);
      hideVolumePanel();
      barIframe.style.display = "none";
      barIframe.style.opacity = "0";
      barIframe.style.pointerEvents = "none";
      updateLauncherVisibility();
    }

    function hideControls() {
      if (manuallyCollapsed || !getSettings().showControlsOnlyOnHover) return;
      if (isSeeking || isVolumeOpen) {
        return;
      }

      isExpanded = false;
      barIframe.style.opacity = "0";
      barIframe.style.transform = "translateY(12px)";
      barIframe.style.pointerEvents = "none";
      if (isCompact) {
        barIframe.style.display = "none";
      }
      updateLauncherVisibility();
      hideVolumePanel();
    }

    function scheduleHide() {
      if (manuallyCollapsed || !getSettings().showControlsOnlyOnHover) return;

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
      if (isCleanedUp) {
        return false;
      }
      if (!document.contains(video) || isStoriesPage()) {
        cleanup();
        return false;
      }

      if (!isVideoVisible(video)) {
        barIframe.style.display = "none";
        volumeIframe.style.display = "none";
        launcherIframe.style.display = "none";
        return false;
      }

      const rect = video.getBoundingClientRect();
      // The home feed should behave like an in-video Reels toolbar, not
      // float beside posts when Instagram leaves a blank side column.
      // Keep Reels and other routes' existing placement untouched.
      const placement = window.location.pathname === '/'
        ? computeFeedOverlayPlacement(rect, window.innerWidth, window.innerHeight)
        : computeControlsPlacement(
          rect,
          window.innerWidth,
          window.innerHeight,
          function (candidate) {
            return isDockingAreaSafe(candidate, video, document,
              [barIframe, volumeIframe, launcherIframe]);
          },
        );
      if (!placement) {
        barIframe.style.display = 'none';
        volumeIframe.style.display = 'none';
        launcherIframe.style.display = 'none';
        return false;
      }
      isCompact = placement.mode === "compact";

      barIframe.style.left = `${placement.left}px`;
      barIframe.style.top = `${placement.top}px`;
      barIframe.style.width = `${placement.width}px`;
      barIframe.style.height = `${BAR_HEIGHT}px`;
      barIframe.style.display = !manuallyCollapsed && (!isCompact || isExpanded)
        ? "block" : "none";
      // Closing must work even when the toolbar is docked outside the video.
      collapseButton.style.display = "flex";

      // The launcher is also needed after manually closing a docked toolbar.
      // Anchor it to the video (not the now-invisible docked toolbar).
      const launcherLeft = Math.max(8,
        Math.min(rect.right - 42, window.innerWidth - 44));
      const launcherTop = Math.max(8,
        Math.min(rect.top + 8, window.innerHeight - 40));
      launcherIframe.style.left = `${launcherLeft}px`;
      launcherIframe.style.top = `${launcherTop}px`;
      updateLauncherVisibility();

      const viewportPadding = 4;
      const volumeLeft = clamp(
        placement.left + placement.width - VOLUME_WIDTH - 2,
        viewportPadding,
        Math.max(viewportPadding, window.innerWidth - VOLUME_WIDTH - viewportPadding),
      );
      const volumeTop = clamp(
        placement.top - VOLUME_HEIGHT,
        viewportPadding,
        Math.max(viewportPadding, window.innerHeight - VOLUME_HEIGHT - viewportPadding),
      );
      volumeIframe.style.left = `${volumeLeft}px`;
      volumeIframe.style.top = `${volumeTop}px`;
      volumeIframe.style.width = `${VOLUME_WIDTH}px`;
      volumeIframe.style.height = `${VOLUME_HEIGHT}px`;
      return true;
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

      pointerOverVideo = isMouseInsideRect(event, rect);
      if (pointerOverVideo) {
        showControls();
      } else {
        updateLauncherVisibility();
        scheduleHide();
      }
    }

    function cleanup() {
      if (isCleanedUp) return;
      isCleanedUp = true;
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
      if (launcherIframe && launcherIframe.parentElement) {
        launcherIframe.remove();
      }
    }

    openControlsButton.addEventListener("click", function () {
      showControls(true);
    });

    collapseButton.addEventListener("click", collapseControls);

    launcherDoc.addEventListener("mouseenter", function () {
      pointerOverVideo = true;
      updateLauncherVisibility();
    });

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
      launcherIframe,
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
