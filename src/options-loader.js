(function () {
  const OPTIONS_KEY = "__igvc_options_v1__";

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

  function sanitizeOptions(rawOptions) {
    const options = {
      ...DEFAULT_OPTIONS,
      ...(rawOptions && typeof rawOptions === "object" ? rawOptions : {}),
    };

    options.defaultVolume = Math.min(1, Math.max(0, Number(options.defaultVolume)));
    options.defaultSpeed = Math.min(4, Math.max(0.25, Number(options.defaultSpeed)));
    options.seekStepSeconds = Math.min(60, Math.max(1, Number(options.seekStepSeconds)));
    options.volumeStep = Math.min(0.5, Math.max(0.01, Number(options.volumeStep)));

    options.rememberVolume = Boolean(options.rememberVolume);
    options.rememberMuted = Boolean(options.rememberMuted);
    options.rememberSpeed = Boolean(options.rememberSpeed);
    options.defaultMuted = Boolean(options.defaultMuted);
    options.keyboardShortcutsEnabled = Boolean(options.keyboardShortcutsEnabled);
    options.keepCurrentVideoPlaying = Boolean(options.keepCurrentVideoPlaying);
    options.backgroundPlayback = Boolean(options.backgroundPlayback);
    options.showDownloadButton = Boolean(options.showDownloadButton);
    options.showControlsOnlyOnHover = Boolean(options.showControlsOnlyOnHover);

    return options;
  }

  function writeOptionsToPageStorage(options) {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(sanitizeOptions(options)));
    } catch (error) {
      console.warn("IGVC: failed to write synced options to page storage", error);
    }
  }

  if (!chrome?.storage?.sync) {
    writeOptionsToPageStorage(DEFAULT_OPTIONS);
    return;
  }

  chrome.storage.sync.get(DEFAULT_OPTIONS, function (items) {
    writeOptionsToPageStorage(items);
  });

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== "sync") {
      return;
    }

    chrome.storage.sync.get(DEFAULT_OPTIONS, function (items) {
      writeOptionsToPageStorage(items);
    });
  });
})();
