const state = {
  state: "minimized",
  timerText: "Timer: not set",
  keyCount: 0,
  buffer: "-",
  commands: [],
  timerSeconds: 0,
  sleepMinutes: 0,
  timerMode: "timer",
  status: "Idle",
  config: {},
  quizMode: "normal",
};

let lastRenderedState = state.state;
let restoredSettings = false;
let vaccineInProgress = false;

function post(action, payload = {}) {
  window.webkit.messageHandlers.resident.postMessage({ action, ...payload });
}

function setText(selector, value) {
  for (const node of document.querySelectorAll(selector)) {
    node.textContent = value;
  }
}

function render() {
  const app = document.querySelector("#app");
  const enteredExpanded =
    state.state === "expanded" && lastRenderedState !== "expanded";
  const enteredSettings =
    state.state === "settings" && lastRenderedState !== "settings";
  const enteredUser = state.state === "user" && lastRenderedState !== "user";
  const virusClass = state.quizMode === "virus" ? " app--virus" : "";
  app.className = `app app--${state.state}${virusClass}`;
  LinuxVirusConfig.update(state.config);
  applyConfigToDom();
  LinuxVirusUser.updateBadge();
  LinuxVirusTimer.updateFlipTimer(state.timerText, state.timerMode);
  setText('[data-bind="status"]', state.status);
  setText('[data-bind="keyCount"]', `Keys: ${state.keyCount}`);
  setText('[data-bind="buffer"]', `Buffer: ${state.buffer}`);

  const secondsInput = document.querySelector("#timerSeconds");
  if (enteredSettings && secondsInput) {
    secondsInput.value = String(state.timerSeconds);
  }
  const sleepInput = document.querySelector("#sleepMinutes");
  if (enteredSettings && sleepInput) {
    sleepInput.value = String(state.sleepMinutes || 0);
  }
  if (enteredSettings) {
    const savedSettings = LinuxVirusSettings.readSavedSettings();
    if (savedSettings) {
      state.timerSeconds = savedSettings.timerSeconds || state.timerSeconds;
      state.sleepMinutes = savedSettings.sleepMinutes ?? state.sleepMinutes;
      state.commands = savedSettings.commands?.length
        ? savedSettings.commands
        : state.commands;
      if (secondsInput) secondsInput.value = String(state.timerSeconds);
      if (sleepInput) sleepInput.value = String(state.sleepMinutes || 0);
    }
    LinuxVirusSettings.setCommandInputs(
      state.commands?.length
        ? state.commands
        : LinuxVirusConfig.get("defaultCommands", []),
    );
    LinuxVirusSettings.refreshPersonalizeToggle();
  }
  if (enteredExpanded) {
    LinuxVirusQuiz.loadQuestion(state.quizMode || "normal");
    LinuxVirusSound.play(
      state.quizMode === "virus" ? "virusQuestion" : "normalQuestion",
    );
  }
  if (enteredUser) {
    LinuxVirusUser.renderUserScreen();
  }

  if (state.state === "expanded") {
    LinuxVirusQuiz.renderQuiz();
  }
  lastRenderedState = state.state;
}

function applyConfigToDom() {
  const secondsInput = document.querySelector("#timerSeconds");
  if (secondsInput) {
    secondsInput.max = String(LinuxVirusConfig.get("maxTimerSeconds", ""));
  }

  const sleepInput = document.querySelector("#sleepMinutes");
  if (sleepInput) {
    sleepInput.max = String(LinuxVirusConfig.get("maxSleepMinutes", ""));
  }
}

window.residentSetState = (nextState) => {
  const activeEl = document.activeElement;
  const protectedIds = new Set(["timerSeconds", "sleepMinutes", "userName"]);
  const activeIsProtected =
    activeEl &&
    (protectedIds.has(activeEl.id) ||
      activeEl.classList?.contains("command-input"));

  const incoming = { ...nextState };
  if (incoming.config) {
    const hadBaseUrl = Boolean(LinuxVirusConfig.get("apiBaseUrl"));
    LinuxVirusConfig.update(incoming.config);
    if (!hadBaseUrl && LinuxVirusConfig.get("apiBaseUrl")) {
      LinuxVirusApi.pingHealth();
    }
    if (incoming.state === "minimized") {
      restoreSavedSettingsOnce();
    }
  }
  if (activeIsProtected) {
    delete incoming.timerSeconds;
    delete incoming.sleepMinutes;
    delete incoming.commands;
  }
  Object.assign(state, incoming);
  render();
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.classList.contains("token")) return;

  const action = button.dataset.action;
  if (action === "useVaccine") {
    if (vaccineInProgress) return;
    const vaccineState = LinuxVirusStorage.useVaccine();
    LinuxVirusQuiz.renderVaccines();
    if (!vaccineState.used) return;
    vaccineInProgress = true;
    LinuxVirusQuiz.showVaccineMessage();
    window.setTimeout(() => {
      post("useVaccine");
      vaccineInProgress = false;
    }, 800);
    return;
  }

  if (action === "resetQuiz") {
    if (LinuxVirusQuiz.isBusy()) return;
    LinuxVirusSound.play("cancel");
    document.querySelector("#resetQuiz").hidden = false;
    document.querySelector("#checkQuiz").hidden = false;
    document.querySelector("#closeExplanation").hidden = true;
    LinuxVirusQuiz.resetQuizState();
    LinuxVirusQuiz.renderQuiz();
    return;
  }

  if (action === "retryQuiz") {
    LinuxVirusQuiz.loadQuestion(state.quizMode || "normal");
    return;
  }

  if (action === "closeExplanation") {
    if (LinuxVirusQuiz.isVirusMode()) {
      post("closeVirus");
    } else {
      LinuxVirusQuiz.loadQuestion("normal");
      post("minimize");
    }
    return;
  }

  if (action === "checkQuiz") {
    if (LinuxVirusQuiz.isBusy()) return;
    const result = document.querySelector("#quizResult");
    const bottom = document.querySelector("#quizBottom");
    const quizEl = document.querySelector(".quiz");
    result.textContent = "判定中…";
    result.className = "quiz__result";
    let answerResult = null;
    try {
      answerResult = await LinuxVirusQuiz.checkAndLogAnswer();
    } catch (error) {
      console.error("Failed to check answer", error);
      result.textContent =
        error && error.isNetwork
          ? "バックエンドに接続できません。"
          : "判定できませんでした。";
      result.className = "quiz__result quiz__result--wrong";
      bottom.className = "quiz-bottom quiz-bottom--wrong";
      return;
    }
    if (!answerResult) {
      result.textContent = "トークンを順番に選んでね！";
      result.className = "quiz__result";
      bottom.className = "quiz-bottom";
      return;
    }

    if (answerResult.correct) {
      LinuxVirusSound.play("correct");
      LinuxVirusQuiz.lockInteractions();
      const labelEl = document.querySelector(".quiz__label");
      if (labelEl) {
        labelEl.textContent = "正解！🎉";
        labelEl.classList.add("quiz__label--correct");
      }
      document.querySelector("#answer").hidden = true;
      document.querySelector("#tokens").hidden = true;
      result.innerHTML = `${LinuxVirusMarkdown.render(answerResult.tutorial)}`;
      result.className =
        "quiz__result quiz__result--correct quiz__result--explanation";
      bottom.className = "quiz-bottom quiz-bottom--correct";
      quizEl.classList.add("quiz--celebrate");
      const existingOutput = document.querySelector("#sampleOutput");
      if (existingOutput) existingOutput.remove();
      if (answerResult.sample_output) {
        const outputEl = document.createElement("pre");
        outputEl.id = "sampleOutput";
        outputEl.className = "quiz__sample-output";
        outputEl.textContent = answerResult.sample_output;
        bottom.insertBefore(outputEl, bottom.firstChild);
      }
      document.querySelector("#resetQuiz").hidden = true;
      document.querySelector("#checkQuiz").hidden = true;
      document.querySelector("#closeExplanation").hidden = false;
      if (answerResult.ratingChange !== null) {
        const { newRating, delta } = answerResult.ratingChange;
        const sign = delta >= 0 ? "+" : "";
        const ratingEl = document.createElement("div");
        ratingEl.id = "quizRatingChange";
        ratingEl.className = "quiz__rating-change";
        ratingEl.textContent = `レーティング: ${newRating} (${sign}${delta})`;
        bottom.appendChild(ratingEl);
      }
      bottom.appendChild(document.querySelector("#closeExplanation"));
    } else {
      LinuxVirusSound.play("incorrect");
      result.textContent = "😅 もう一回やってみよう！";
      result.className = "quiz__result quiz__result--wrong";
      bottom.className = "quiz-bottom quiz-bottom--wrong";
      document.querySelector("#resetQuiz").hidden = false;
      document.querySelector("#checkQuiz").hidden = false;
      document.querySelector("#closeExplanation").hidden = true;
      quizEl.classList.add("quiz--shake");
      window.setTimeout(() => quizEl.classList.remove("quiz--shake"), 450);
    }
    return;
  }

  if (action === "addCommand") {
    LinuxVirusSettings.addCommandInput();
    return;
  }

  if (action === "showHelp") {
    LinuxVirusSettings.showHelp();
    return;
  }

  if (action === "closeHelp") {
    LinuxVirusSettings.closeHelp();
    return;
  }

  if (action === "loginUser") {
    LinuxVirusUser.login();
    return;
  }

  if (action === "createUser") {
    LinuxVirusUser.create();
    return;
  }

  if (action === "logoutUser") {
    LinuxVirusUser.logout();
    return;
  }

  if (action === "done") {
    const settings = LinuxVirusSettings.saveCurrentSettings();
    post("setTimer", {
      seconds: settings.timerSeconds,
      sleepMinutes: settings.sleepMinutes,
      commands: settings.commands,
    });
    return;
  }

  post(action);
});

document.addEventListener("click", (event) => {
  if (LinuxVirusDrag.isClickSuppressed()) return;
  const button = event.target.closest(".token");
  if (!button) return;
  if (LinuxVirusQuiz.isInteractionLocked()) return;

  const action = button.dataset.action;
  if (action === "selectToken") {
    LinuxVirusSound.play("click");
    LinuxVirusQuiz.moveTokenToAnswer(
      LinuxVirusQuiz.choiceFromDataset(button.dataset),
    );
  }
  if (action === "unselectToken") {
    LinuxVirusSound.play("click");
    LinuxVirusQuiz.removeTokenFromAnswer(
      LinuxVirusQuiz.choiceFromDataset(button.dataset),
      Number(button.dataset.index),
    );
  }
});

LinuxVirusDrag.install();
render();

window.setInterval(() => LinuxVirusApi.pingHealth(), 60000);
window.setInterval(() => LinuxVirusQuiz.renderVaccines(), 60000);

function restoreSavedSettingsOnce() {
  if (restoredSettings) return;
  const savedSettings = LinuxVirusSettings.readSavedSettings();
  if (!savedSettings) return;

  restoredSettings = true;
  post("setTimer", {
    seconds: savedSettings.timerSeconds,
    sleepMinutes: savedSettings.sleepMinutes,
    commands: savedSettings.commands,
  });
}
