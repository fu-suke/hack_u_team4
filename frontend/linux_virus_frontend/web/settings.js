const LinuxVirusSettings = (() => {
  const SETTINGS_VERSION = 1;
  let personalizeEnabled = true;
  const savedSettings = LinuxVirusStorage.readSettings();
  if (savedSettings && typeof savedSettings.personalizeEnabled === "boolean") {
    personalizeEnabled = savedSettings.personalizeEnabled;
  }

  function isPersonalizeEnabled() {
    return personalizeEnabled;
  }

  function refreshPersonalizeToggle() {
    const toggle = document.querySelector("#personalizeToggle");
    if (!toggle) return;
    toggle.checked = personalizeEnabled;
  }

  function readSavedSettings() {
    return LinuxVirusStorage.readSettings();
  }

  function sleepMinutesFromSettings(settings, fallback) {
    if (
      !settings ||
      !Object.prototype.hasOwnProperty.call(settings, "sleepMinutes")
    ) {
      return fallback;
    }
    if (!settings.version && Number(settings.sleepMinutes) === 1) {
      return LinuxVirusConfig.get("defaultSleepMinutes", 0);
    }
    return settings.sleepMinutes;
  }

  function normalizeSleepMinutes(value) {
    const fallback = Number(LinuxVirusConfig.get("defaultSleepMinutes", 0));
    const max = Number(LinuxVirusConfig.get("maxSleepMinutes", 99));
    const numericValue = Number(value);
    const minutes = Number.isFinite(numericValue) ? numericValue : fallback;
    return Math.min(Math.max(0, Math.trunc(minutes)), max);
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.id === "personalizeToggle") {
      personalizeEnabled = target.checked;
      saveCurrentSettings();
    }
  });

  function saveCurrentSettings() {
    const sleepMinutes = document.querySelector("#sleepMinutes")?.value;
    const settings = {
      version: SETTINGS_VERSION,
      sleepMinutes: normalizeSleepMinutes(sleepMinutes),
      personalizeEnabled,
    };
    const sleepInput = document.querySelector("#sleepMinutes");
    if (sleepInput) sleepInput.value = String(settings.sleepMinutes);
    LinuxVirusStorage.saveSettings(settings);
    return settings;
  }

  return {
    isPersonalizeEnabled,
    refreshPersonalizeToggle,
    readSavedSettings,
    sleepMinutesFromSettings,
    normalizeSleepMinutes,
    saveCurrentSettings,
  };
})();
