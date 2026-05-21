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

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target && target.id === "personalizeToggle") {
      personalizeEnabled = target.checked;
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

  function addCommandInput() {
    const container = document.querySelector("#commands");
    if (container.querySelectorAll(".command-input").length >= 10) {
      document.querySelector('[data-bind="status"]').textContent = "Commands are limited to 10.";
      return;
    }

    const input = createCommandInput();
    container.appendChild(input);
    input.focus();
    input.scrollIntoView({ block: "nearest" });
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
    refreshPersonalizeToggle,
    setCommandInputs,
    showHelp,
  };
})();
