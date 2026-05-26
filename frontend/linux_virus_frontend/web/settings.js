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

  function createCommandRow(value = "") {
    const row = document.createElement("div");
    row.className = "command-row";

    const input = document.createElement("input");
    input.className = "command-input";
    input.type = "text";
    input.value = value;
    input.maxLength = 64;
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;

    const removeButton = document.createElement("button");
    removeButton.className = "icon-button command-row__remove";
    removeButton.type = "button";
    removeButton.dataset.action = "removeCommand";
    removeButton.setAttribute("aria-label", "Delete command");
    removeButton.textContent = "×";

    row.append(input, removeButton);
    return row;
  }

  function setCommandInputs(commands) {
    const container = document.querySelector("#commands");
    container.replaceChildren();
    for (const command of commands.length ? commands : [""]) {
      container.appendChild(createCommandRow(command));
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
    const minTimerSeconds = Number(LinuxVirusConfig.get("minTimerSeconds"));
    const normalizedTimerSeconds = timerSeconds
      ? Math.max(minTimerSeconds, Number(timerSeconds))
      : undefined;
    const settings = {
      timerSeconds: normalizedTimerSeconds,
      sleepMinutes: sleepMinutes ? Number(sleepMinutes) : 0,
      commands: getCommandValues(),
      personalizeEnabled,
    };
    if (normalizedTimerSeconds !== undefined) {
      document.querySelector("#timerSeconds").value = String(normalizedTimerSeconds);
    }
    LinuxVirusStorage.saveSettings(settings);
    return settings;
  }

  function addCommandInput() {
    const container = document.querySelector("#commands");
    if (container.querySelectorAll(".command-input").length >= 10) {
      return;
    }

    const row = createCommandRow();
    const input = row.querySelector(".command-input");
    container.appendChild(row);
    input.focus();
    input.scrollIntoView({ block: "center" });
  }

  function removeCommandRow(button) {
    const rows = Array.from(document.querySelectorAll(".command-row"));
    const targetRow = button?.closest(".command-row");
    if (!rows.length || !targetRow) return;

    const targetIndex = rows.indexOf(targetRow);
    const nextRow = rows[targetIndex + 1] || rows[targetIndex - 1] || null;
    const nextInput = nextRow?.querySelector(".command-input");

    if (rows.length === 1) {
      const input = targetRow.querySelector(".command-input");
      input.value = "";
      input.focus();
      return;
    }

    targetRow.remove();
    nextInput?.focus();
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
    removeCommandRow,
    refreshPersonalizeToggle,
    readSavedSettings,
    saveCurrentSettings,
    setCommandInputs,
    showHelp,
  };
})();
