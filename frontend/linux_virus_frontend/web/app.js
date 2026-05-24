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
  const protectedIds = new Set(["timerSeconds", "sleepMinutes", "userName", "terminalInput"]);
  const activeIsProtected =
    activeEl &&
    (protectedIds.has(activeEl.id) ||
      activeEl.classList?.contains("command-input"));

  const incoming = { ...nextState };
  if (incoming.currentUser !== undefined) {
    const newId = incoming.currentUser ? Number(incoming.currentUser.id) : null;
    if (newId !== LinuxVirusUser.currentUserId()) {
      LinuxVirusUser.applyUser(incoming.currentUser);
    }
    delete incoming.currentUser;
  }
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

async function runCheck() {
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
    result.textContent = error && error.isNetwork
      ? "バックエンドに接続できません。"
      : "判定できませんでした。";
    result.className = "quiz__result quiz__result--wrong";
    bottom.className = "quiz-bottom quiz-bottom--wrong";
    return;
  }
  if (!answerResult) {
    result.textContent = "ターミナルに入力して Enter で送信";
    result.className = "quiz__result";
    bottom.className = "quiz-bottom";
    const streakElReset = document.querySelector("#quizStreak");
    if (streakElReset) streakElReset.hidden = true;
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
    const streakEl = document.querySelector("#quizStreak");
    if (streakEl) {
      if (answerResult.streak >= 2) {
        streakEl.textContent = `${answerResult.streak}問連続正解中！`;
        streakEl.hidden = false;
      } else {
        streakEl.hidden = true;
      }
    }
    document.querySelector("#tokens").hidden = true;
    const hintEl = document.querySelector(".quiz__hint");
    if (hintEl) hintEl.hidden = true;
    result.innerHTML = LinuxVirusMarkdown.render(answerResult.tutorial);
    result.className = "quiz__result quiz__result--correct quiz__result--explanation";
    result.hidden = true;
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
    const existingToggle = document.querySelector("#toggleExplanation");
    if (existingToggle) existingToggle.remove();
    const actionsEl = document.querySelector(".quiz__actions");
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "toggleExplanation";
    toggleBtn.className = "btn btn--ghost btn--toggle-explanation";
    toggleBtn.type = "button";
    toggleBtn.dataset.action = "toggleExplanation";
    toggleBtn.textContent = "解説を見る";
    if (actionsEl) actionsEl.prepend(toggleBtn);
    document.querySelector("#closeExplanation").hidden = false;
    if (answerResult.ratingChange !== null) {
      const { newRating, delta } = answerResult.ratingChange;
      const sign = delta >= 0 ? "+" : "";
      const ratingColor = LinuxVirusUser.ratingColor(newRating).color;
      const deltaColor = delta >= 0 ? "#aaee44" : "#ff4b4b";
      const existingRating = document.querySelector("#quizRatingChange");
      if (existingRating) existingRating.remove();
      const ratingEl = document.createElement("div");
      ratingEl.id = "quizRatingChange";
      ratingEl.className = "quiz__rating-change";
      const deltaClass = delta >= 0 ? "quiz__rating-delta--up" : "quiz__rating-delta--down";
      ratingEl.innerHTML = `<span class="quiz__rating-label">レーティング</span><span class="quiz__rating-value" style="color:${ratingColor}">${newRating}</span><span class="quiz__rating-delta ${deltaClass}">${sign}${delta}</span>`;
      if (actionsEl) {
        bottom.insertBefore(ratingEl, actionsEl);
      } else {
        bottom.appendChild(ratingEl);
      }
    }
  } else {
    LinuxVirusSound.play("incorrect");
    result.textContent = "😅 もう一回やってみよう!";
    result.className = "quiz__result quiz__result--wrong";
    bottom.className = "quiz-bottom quiz-bottom--wrong";
    document.querySelector("#closeExplanation").hidden = true;
    const streakElWrong = document.querySelector("#quizStreak");
    if (streakElWrong) streakElWrong.hidden = true;
    quizEl.classList.add("quiz--shake");
    window.setTimeout(() => quizEl.classList.remove("quiz--shake"), 450);
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.classList.contains("token")) return;

  const action = button.dataset.action;
  if (action === "useVaccine") {
    if (vaccineInProgress) return;
    if (LinuxVirusQuiz.isInteractionLocked()) return;
    const vaccineState = LinuxVirusStorage.useVaccine();
    LinuxVirusQuiz.renderVaccines();
    if (!vaccineState.used) return;
    vaccineInProgress = true;
    LinuxVirusSound.play("cure");
    LinuxVirusQuiz.showVaccineMessage();
    window.setTimeout(() => {
      post("useVaccine");
      vaccineInProgress = false;
    }, 800);
    return;
  }

  if (action === "retryQuiz") {
    LinuxVirusQuiz.loadQuestion(state.quizMode || "normal");
    return;
  }

  if (action === "toggleExplanation") {
    const explanationEl = document.querySelector("#quizResult");
    const overlay = document.querySelector("#explanationOverlay");
    const overlayContent = document.querySelector("#explanationOverlayContent");
    if (!overlay || !overlayContent) return;
    if (explanationEl) overlayContent.innerHTML = explanationEl.innerHTML;
    overlay.hidden = false;
    return;
  }

  if (action === "closeExplanationOverlay") {
    const overlay = document.querySelector("#explanationOverlay");
    if (overlay) overlay.hidden = true;
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

  if (action === "addCommand") {
    LinuxVirusSettings.addCommandInput();
    return;
  }

  if (action === "removeCommand") {
    LinuxVirusSettings.removeCommandRow(button);
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
    LinuxVirusQuiz.moveTokenToAnswer(
      LinuxVirusQuiz.choiceFromDataset(button.dataset),
    );
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target && target.id === "terminalInput") {
    LinuxVirusQuiz.setTyped(target.value);
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!target || target.id !== "terminalInput") return;
  if (event.key === "Enter") {
    event.preventDefault();
    runCheck();
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    const input = target;
    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const wordMatch = before.match(/(\S*)$/);
    const word = wordMatch ? wordMatch[1] : "";
    if (!word) return;
    const completion = LinuxVirusQuiz.completeToken(word);
    if (!completion) return;
    const newBefore = before.slice(0, before.length - word.length) + completion + " ";
    const newValue = newBefore + after;
    input.value = newValue;
    input.setSelectionRange(newBefore.length, newBefore.length);
    LinuxVirusQuiz.setTyped(newValue);
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
