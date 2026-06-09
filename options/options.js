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

const fields = {
  rememberVolume: document.getElementById("rememberVolume"),
  rememberMuted: document.getElementById("rememberMuted"),
  rememberSpeed: document.getElementById("rememberSpeed"),
  defaultVolume: document.getElementById("defaultVolume"),
  defaultVolumeValue: document.getElementById("defaultVolumeValue"),
  defaultMuted: document.getElementById("defaultMuted"),
  defaultSpeed: document.getElementById("defaultSpeed"),
  keyboardShortcutsEnabled: document.getElementById("keyboardShortcutsEnabled"),
  seekStepSeconds: document.getElementById("seekStepSeconds"),
  volumeStep: document.getElementById("volumeStep"),
  keepCurrentVideoPlaying: document.getElementById("keepCurrentVideoPlaying"),
  backgroundPlayback: document.getElementById("backgroundPlayback"),
  showDownloadButton: document.getElementById("showDownloadButton"),
  showControlsOnlyOnHover: document.getElementById("showControlsOnlyOnHover"),
};

const resetButton = document.getElementById("resetButton");
const saveStatus = document.getElementById("saveStatus");

let saveTimer = null;

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
  options.showDownloadButton = Boolean(options.showDownloadButton);
  options.showControlsOnlyOnHover = Boolean(options.showControlsOnlyOnHover);

  return options;
}

function updateVolumeLabel(value) {
  fields.defaultVolumeValue.textContent = `${Math.round(Number(value) * 100)}%`;
}

function renderOptions(options) {
  fields.rememberVolume.checked = options.rememberVolume;
  fields.rememberMuted.checked = options.rememberMuted;
  fields.rememberSpeed.checked = options.rememberSpeed;

  fields.defaultVolume.value = String(options.defaultVolume);
  updateVolumeLabel(options.defaultVolume);

  fields.defaultMuted.checked = options.defaultMuted;
  fields.defaultSpeed.value = String(options.defaultSpeed);

  fields.keyboardShortcutsEnabled.checked = options.keyboardShortcutsEnabled;
  fields.seekStepSeconds.value = String(options.seekStepSeconds);
  fields.volumeStep.value = String(options.volumeStep);

  fields.keepCurrentVideoPlaying.checked = options.keepCurrentVideoPlaying;
  fields.backgroundPlayback.checked = options.backgroundPlayback;
  fields.showDownloadButton.checked = options.showDownloadButton;
  fields.showControlsOnlyOnHover.checked = options.showControlsOnlyOnHover;
}

function readOptionsFromForm() {
  return sanitizeOptions({
    rememberVolume: fields.rememberVolume.checked,
    rememberMuted: fields.rememberMuted.checked,
    rememberSpeed: fields.rememberSpeed.checked,
    defaultVolume: Number(fields.defaultVolume.value),
    defaultMuted: fields.defaultMuted.checked,
    defaultSpeed: Number(fields.defaultSpeed.value),
    keyboardShortcutsEnabled: fields.keyboardShortcutsEnabled.checked,
    seekStepSeconds: Number(fields.seekStepSeconds.value),
    volumeStep: Number(fields.volumeStep.value),
    keepCurrentVideoPlaying: fields.keepCurrentVideoPlaying.checked,
    backgroundPlayback: fields.backgroundPlayback.checked,
    showDownloadButton: fields.showDownloadButton.checked,
    showControlsOnlyOnHover: fields.showControlsOnlyOnHover.checked,
  });
}

function showSavedMessage(text = "Saved") {
  saveStatus.textContent = text;

  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    saveStatus.textContent = "";
  }, 1400);
}

function saveOptions() {
  const options = readOptionsFromForm();

  chrome.storage.sync.set(options, function () {
    showSavedMessage();
  });
}

function loadOptions() {
  chrome.storage.sync.get(DEFAULT_OPTIONS, function (items) {
    renderOptions(sanitizeOptions(items));
  });
}

Object.values(fields).forEach(function (field) {
  if (!field || field.tagName === "OUTPUT") {
    return;
  }

  field.addEventListener("input", function () {
    if (field === fields.defaultVolume) {
      updateVolumeLabel(field.value);
    }

    saveOptions();
  });

  field.addEventListener("change", saveOptions);
});

resetButton.addEventListener("click", function () {
  chrome.storage.sync.set(DEFAULT_OPTIONS, function () {
    renderOptions(DEFAULT_OPTIONS);
    showSavedMessage("Defaults restored");
  });
});

loadOptions();
