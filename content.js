(function () {
  const DEFAULT_OPTIONS = {
    rememberVolume: true,
    rememberMuted: true,
    rememberSpeed: true,
    defaultVolume: 0.7,
    defaultMuted: false,
    defaultSpeed: 1,
    keyboardShortcutsEnabled: true,
    seekStepSeconds: 5,
    volumeStep: 0.05,
    keepCurrentVideoPlaying: true,
    backgroundPlayback: true,
    showDownloadButton: true,
    showControlsOnlyOnHover: true,
  };

  window.__igvc = {
    EXTENSION_MARK: "igvcIframeAttached",
    STATE_KEY: "__igvc_video_state_v2__",
    OPTIONS_KEY: "__igvc_options_v1__",
    DEFAULT_OPTIONS,

    BAR_HEIGHT: 42,
    VOLUME_WIDTH: 28,
    VOLUME_HEIGHT: 86,

    SCAN_INTERVAL_MS: 1000,
    POSITION_INTERVAL_MS: 200,
    HIDE_DELAY_MS: 700,
    VOLUME_HIDE_DELAY_MS: 350,

    overlays: new Map(),
    intentionallyPausedVideos: new WeakSet(),
    backgroundWantedVideos: new Set(),
    activeVideo: null,
  };
})();
