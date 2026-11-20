(function () {
  const igvc = window.__igvc;
  const { EXTENSION_MARK, STATE_KEY, OPTIONS_KEY, DEFAULT_OPTIONS, overlays } = igvc;

  function clamp(number, min, max) {
    return Math.min(max, Math.max(min, number));
  }

  function sanitizeOptions(rawOptions) {
    const options = {
      ...DEFAULT_OPTIONS,
      ...(rawOptions && typeof rawOptions === "object" ? rawOptions : {}),
    };

    options.defaultVolume = clamp(Number(options.defaultVolume), 0, 1);
    options.defaultSpeed = clamp(Number(options.defaultSpeed), 0.25, 4);
    options.seekStepSeconds = clamp(Number(options.seekStepSeconds), 1, 60);
    options.volumeStep = clamp(Number(options.volumeStep), 0.01, 0.5);

    options.rememberVolume = Boolean(options.rememberVolume);
    options.rememberMuted = Boolean(options.rememberMuted);
    options.rememberSpeed = Boolean(options.rememberSpeed);
    options.defaultMuted = Boolean(options.defaultMuted);
    options.keyboardShortcutsEnabled = Boolean(options.keyboardShortcutsEnabled);
    options.keepCurrentVideoPlaying = Boolean(options.keepCurrentVideoPlaying);
    options.backgroundPlayback = Boolean(options.backgroundPlayback);
  options.backgroundStories = Boolean(options.backgroundStories);
    options.showDownloadButton = Boolean(options.showDownloadButton);
    options.showControlsOnlyOnHover = Boolean(options.showControlsOnlyOnHover);

    return options;
  }

  function loadOptions() {
    try {
      const raw = localStorage.getItem(OPTIONS_KEY);

      if (!raw) {
        return sanitizeOptions(DEFAULT_OPTIONS);
      }

      return sanitizeOptions(JSON.parse(raw));
    } catch (error) {
      return sanitizeOptions(DEFAULT_OPTIONS);
    }
  }

  function getSettings() {
    return loadOptions();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);

      if (!raw) {
        return {
          hasState: false,
          muted: null,
          volume: null,
          playbackRate: null,
        };
      }

      const parsed = JSON.parse(raw);

      return {
        hasState: parsed.hasState === true,
        muted: typeof parsed.muted === "boolean" ? parsed.muted : null,
        volume:
          typeof parsed.volume === "number" ? clamp(parsed.volume, 0, 1) : null,
        playbackRate:
          typeof parsed.playbackRate === "number"
            ? clamp(parsed.playbackRate, 0.25, 4)
            : null,
      };
    } catch (error) {
      return {
        hasState: false,
        muted: null,
        volume: null,
        playbackRate: null,
      };
    }
  }

  let preferredState = loadState();

  function getPreferredState() {
    return preferredState;
  }

  function saveState(patch) {
    const settings = getSettings();
    const nextState = { ...preferredState, hasState: true };

    if (settings.rememberMuted && typeof patch.muted === "boolean") {
      nextState.muted = patch.muted;
    }

    if (settings.rememberVolume && typeof patch.volume === "number") {
      nextState.volume = clamp(patch.volume, 0, 1);
    }

    if (settings.rememberSpeed && typeof patch.playbackRate === "number") {
      nextState.playbackRate = clamp(patch.playbackRate, 0.25, 4);
    }

    preferredState = nextState;

    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(preferredState));
    } catch (error) {
      console.warn("IGVC: failed to save state", error);
    }
  }

  function applySavedState(video) {
    const settings = getSettings();

    try {
      if (
        settings.rememberVolume &&
        preferredState.hasState &&
        typeof preferredState.volume === "number"
      ) {
        video.volume = clamp(preferredState.volume, 0, 1);
      } else {
        video.volume = settings.defaultVolume;
      }

      if (
        settings.rememberMuted &&
        preferredState.hasState &&
        typeof preferredState.muted === "boolean"
      ) {
        video.muted = preferredState.muted;
      } else {
        video.muted = settings.defaultMuted;
      }

      if (
        settings.rememberSpeed &&
        preferredState.hasState &&
        typeof preferredState.playbackRate === "number"
      ) {
        video.playbackRate = clamp(preferredState.playbackRate, 0.25, 4);
      } else {
        video.playbackRate = settings.defaultSpeed;
      }
    } catch (error) {
      console.warn("IGVC: failed to apply saved state", error);
    }
  }

  function isAttachedVideo(video) {
    return (
      video instanceof HTMLVideoElement &&
      video.dataset &&
      video.dataset[EXTENSION_MARK] === "true"
    );
  }

  function hasPreferredStateMismatch(video) {
    if (!isAttachedVideo(video)) {
      return false;
    }

    const settings = getSettings();

    if (!preferredState.hasState) {
      return false;
    }

    const mutedMismatch =
      settings.rememberMuted &&
      typeof preferredState.muted === "boolean" &&
      video.muted !== preferredState.muted;

    const volumeMismatch =
      settings.rememberVolume &&
      typeof preferredState.volume === "number" &&
      Math.abs(video.volume - preferredState.volume) > 0.02;

    const speedMismatch =
      settings.rememberSpeed &&
      typeof preferredState.playbackRate === "number" &&
      Math.abs(video.playbackRate - preferredState.playbackRate) > 0.01;

    return mutedMismatch || volumeMismatch || speedMismatch;
  }

  function forceSavedStateOnVideo(video) {
    if (!isAttachedVideo(video)) {
      return;
    }

    if (!preferredState.hasState) {
      return;
    }

    applySavedState(video);
  }

  function forceSavedStateOnAllVideos() {
    if (isAttachedVideo(igvc.activeVideo)) {
      forceSavedStateOnVideo(igvc.activeVideo);
    }
  }

  function forceSavedStateRepeatedly() {
    [0, 50, 150, 300, 700, 1200, 2000].forEach(function (delay) {
      setTimeout(function () {
        forceSavedStateOnAllVideos();
      }, delay);
    });
  }

  igvc.clamp = clamp;
  igvc.getSettings = getSettings;
  igvc.getPreferredState = getPreferredState;
  igvc.saveState = saveState;
  igvc.applySavedState = applySavedState;
  igvc.isAttachedVideo = isAttachedVideo;
  igvc.hasPreferredStateMismatch = hasPreferredStateMismatch;
  igvc.forceSavedStateOnVideo = forceSavedStateOnVideo;
  igvc.forceSavedStateOnAllVideos = forceSavedStateOnAllVideos;
  igvc.forceSavedStateRepeatedly = forceSavedStateRepeatedly;
})();
