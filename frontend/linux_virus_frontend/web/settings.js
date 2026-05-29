const LinuxVirusSettings = (() => {
  let personalizeEnabled = true;

  function isPersonalizeEnabled() {
    return personalizeEnabled;
  }

  function refreshPersonalizeToggle() {
    const toggle = document.querySelector("#personalizeToggle");
    if (!toggle) return;
    toggle.checked = personalizeEnabled;
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
      sleepMinutes: normalizeSleepMinutes(sleepMinutes),
      personalizeEnabled,
    };
    const sleepInput = document.querySelector("#sleepMinutes");
    if (sleepInput) sleepInput.value = String(settings.sleepMinutes);
    return settings;
  }

  return {
    isPersonalizeEnabled,
    refreshPersonalizeToggle,
    normalizeSleepMinutes,
    saveCurrentSettings,
  };
})();
