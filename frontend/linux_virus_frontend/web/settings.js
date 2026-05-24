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

  function createCommandInput(value = "") {
    const input = document.createElement("input");
    input.className = "command-input";
    input.type = "text";
    input.value = value;
    input.maxLength = 64;
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    return input;
  }

  function setCommandInputs(commands) {
    const container = document.querySelector("#commands");
    container.replaceChildren();
    for (const command of commands.length ? commands : [""]) {
      container.appendChild(createCommandInput(command));
    }
  }

  function getCommandValues() {
    return Array.from(document.querySelectorAll(".command-input"))
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  function readSavedSettings() {
    return LinuxVirusStorage.readSettings();
  }

  function saveCurrentSettings() {
    const timerSeconds = document.querySelector("#timerSeconds")?.value;
    const sleepMinutes = document.querySelector("#sleepMinutes")?.value;
    const settings = {
      timerSeconds: timerSeconds ? Number(timerSeconds) : undefined,
      sleepMinutes: sleepMinutes ? Number(sleepMinutes) : 0,
      commands: getCommandValues(),
      personalizeEnabled,
    };
    LinuxVirusStorage.saveSettings(settings);
    return settings;
  }

  function addCommandInput() {
    const container = document.querySelector("#commands");
    if (container.querySelectorAll(".command-input").length >= 10) {
      return;
    }

    const input = createCommandInput();
    container.appendChild(input);
    input.focus();
    input.scrollIntoView({ block: "center" });
  }

  function removeFocusedCommandInput() {
    const inputs = Array.from(document.querySelectorAll(".command-input"));
    if (!inputs.length) return;

    const activeInput = document.activeElement?.classList?.contains("command-input")
      ? document.activeElement
      : null;
    const target = activeInput || inputs[inputs.length - 1];
    const targetIndex = inputs.indexOf(target);
    const nextFocus = inputs[targetIndex + 1] || inputs[targetIndex - 1] || null;

    if (inputs.length === 1) {
      target.value = "";
      target.focus();
      return;
    }

    target.remove();
    nextFocus?.focus();
  }

  function showHelp() {
    document.querySelector("#helpDialog").showModal();
  }

  function closeHelp() {
    document.querySelector("#helpDialog").close();
  }

  return {
    addCommandInput,
    closeHelp,
    getCommandValues,
    isPersonalizeEnabled,
    removeFocusedCommandInput,
    refreshPersonalizeToggle,
    readSavedSettings,
    saveCurrentSettings,
    setCommandInputs,
    showHelp,
  };
})();
