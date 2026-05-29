const LinuxVirusSettings = (() => {
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

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.id === "personalizeToggle") {
      personalizeEnabled = target.checked;
      saveCurrentSettings();
    }
  });

  function readSavedSettings() {
    return LinuxVirusStorage.readSettings();
  }

  function saveCurrentSettings() {
    const timerSeconds = document.querySelector("#timerSeconds")?.value;
    const sleepMinutes = document.querySelector("#sleepMinutes")?.value;
    const minTimerSeconds = Number(LinuxVirusConfig.get("minTimerSeconds"));
    const normalizedTimerSeconds = timerSeconds
      ? Math.max(minTimerSeconds, Number(timerSeconds))
      : undefined;
    const settings = {
      timerSeconds: normalizedTimerSeconds,
      sleepMinutes: sleepMinutes ? Number(sleepMinutes) : 0,
      personalizeEnabled,
    };
    if (normalizedTimerSeconds !== undefined) {
      document.querySelector("#timerSeconds").value = String(normalizedTimerSeconds);
    }
    LinuxVirusStorage.saveSettings(settings);
    return settings;
  }

  return {
    isPersonalizeEnabled,
    refreshPersonalizeToggle,
    readSavedSettings,
    saveCurrentSettings,
  };
})();
