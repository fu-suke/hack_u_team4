const state = {
  state: "minimized",
  timerText: "",
  sleepMinutes: 0,
  timerMode: "idle",
  status: "Idle",
  config: {},
  quizMode: "normal",
  triggerCommand: null,
};

const APP_ROOT = document.querySelector("#app");
const IS_QUIZ_PAGE = APP_ROOT?.dataset.waitForState === "true";

let lastRenderedState = state.state;
let vaccineInProgress = false;
let questionSoundPlayed = false;

function post(action, payload = {}) {
  window.webkit.messageHandlers.resident.postMessage({ action, ...payload });
}

function hasQuizModule() {
  return typeof LinuxVirusQuiz !== "undefined";
}

function playQuestionSoundOnce() {
  if (questionSoundPlayed) return;
  LinuxVirusSound.play(
    state.quizMode === "virus" ? "virusQuestion" : "normalQuestion",
  );
  questionSoundPlayed = true;
}

function render() {
  if (!APP_ROOT) return;
  const enteredExpanded =
    state.state === "expanded" && lastRenderedState !== "expanded";
  const enteredSettings =
    state.state === "settings" && lastRenderedState !== "settings";
  const enteredUser = state.state === "user" && lastRenderedState !== "user";
  const virusClass = state.quizMode === "virus" ? " app--virus" : "";
  APP_ROOT.className = `app app--${state.state}${virusClass}`;
  LinuxVirusConfig.update(state.config);
  LinuxVirusUser.updateBadge();
  if (typeof LinuxVirusTimer !== "undefined") {
    LinuxVirusTimer.updateFlipTimer(state.timerText, state.timerMode);
  }
  if (enteredSettings) {
    const savedSettings = LinuxVirusSettings.readSavedSettings();
    state.sleepMinutes = LinuxVirusSettings.normalizeSleepMinutes(
      LinuxVirusSettings.sleepMinutesFromSettings(savedSettings, state.sleepMinutes),
    );
    const sleepInput = document.querySelector("#sleepMinutes");
    if (sleepInput) {
      sleepInput.value = String(state.sleepMinutes);
      sleepInput.max = String(LinuxVirusConfig.get("maxSleepMinutes", ""));
    }
    LinuxVirusSettings.refreshPersonalizeToggle();
  }
  if (state.state !== "expanded") {
    questionSoundPlayed = false;
  }
  if (enteredExpanded && hasQuizModule()) {
    LinuxVirusQuiz.loadQuestion(state.quizMode || "normal", {
      force: true,
      triggerCommand: state.triggerCommand,
    });
    playQuestionSoundOnce();
  }
  if (enteredUser) {
    LinuxVirusUser.renderUserScreen();
  }

  if (state.state === "expanded" && hasQuizModule()) {
    LinuxVirusQuiz.renderQuiz();
  }
  lastRenderedState = state.state;
}

window.residentSetState = (nextState) => {
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
  }
  Object.assign(state, incoming);
  render();
};

async function runCheck() {
  if (LinuxVirusQuiz.isBusy()) return;
  const bottom = document.querySelector("#quizBottom");
  const quizEl = document.querySelector(".quiz");
  if (bottom) bottom.className = "quiz-bottom";
  let answerResult = null;
  try {
    answerResult = await LinuxVirusQuiz.checkAndLogAnswer();
  } catch (error) {
    console.error("Failed to check answer", error);
    return;
  }
  if (!answerResult) {
    if (bottom) bottom.className = "quiz-bottom";
    const streakElReset = document.querySelector("#quizStreak");
    if (streakElReset) streakElReset.hidden = true;
    return;
  }

  if (answerResult.correct) {
    renderResolvedAnswer(answerResult);
  } else {
    LinuxVirusSound.play("incorrect");
    document.querySelector("#closeExplanation").hidden = true;
    const streakElWrong = document.querySelector("#quizStreak");
    if (streakElWrong) streakElWrong.hidden = true;
    quizEl?.classList.add("quiz--shake");
    window.setTimeout(() => quizEl?.classList.remove("quiz--shake"), 450);
  }
}

async function runTimeout() {
  if (LinuxVirusQuiz.isBusy() || LinuxVirusQuiz.isInteractionLocked()) return;
  let answerResult = null;
  try {
    answerResult = await LinuxVirusQuiz.timeoutAndLogAnswer();
  } catch (error) {
    console.error("Failed to log timeout answer", error);
  }
  if (!answerResult) return;
  LinuxVirusSound.play("incorrect");
  renderResolvedAnswer(answerResult, { timedOut: true });
}

function updateResolvedHeader(answerResult, timedOut) {
  LinuxVirusQuiz.setQuizLabel(
    timedOut ? "時間切れ！⌛" : "正解！🎉",
    timedOut ? "quiz__label--timeout" : "quiz__label--correct",
  );

  const streakEl = document.querySelector("#quizStreak");
  if (!streakEl) return;
  if (!timedOut && answerResult.streak >= 2) {
    streakEl.textContent = `${answerResult.streak}問連続正解中！`;
    streakEl.hidden = false;
  } else {
    streakEl.hidden = true;
  }
}

function insertBeforeActions(element) {
  const bottom = document.querySelector("#quizBottom");
  const actionsEl = document.querySelector(".quiz__actions");
  if (!bottom) return;
  if (actionsEl) {
    bottom.insertBefore(element, actionsEl);
  } else {
    bottom.appendChild(element);
  }
}

function renderSampleOutput(answerResult, timedOut) {
  const existingOutput = document.querySelector("#sampleOutput");
  if (existingOutput) existingOutput.remove();
  if (!answerResult.sample_output) return;

  const outputEl = document.createElement("pre");
  outputEl.id = "sampleOutput";
  outputEl.className = timedOut
    ? "quiz__sample-output quiz__sample-output--timeout"
    : "quiz__sample-output";
  outputEl.textContent = answerResult.sample_output;
  insertBeforeActions(outputEl);
}

function renderExplanationButton() {
  const actionsEl = document.querySelector(".quiz__actions");
  const existingToggle = document.querySelector("#toggleExplanation");
  if (existingToggle) existingToggle.remove();
  if (!actionsEl) return;

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggleExplanation";
  toggleBtn.className = "btn btn--ghost btn--toggle-explanation";
  toggleBtn.type = "button";
  toggleBtn.dataset.action = "toggleExplanation";
  toggleBtn.textContent = "解説を見る";
  actionsEl.prepend(toggleBtn);
}

function renderRatingChange(answerResult) {
  const existingRating = document.querySelector("#quizRatingChange");
  if (existingRating) existingRating.remove();
  if (answerResult.ratingChange === null) return;

  const { newRating, delta } = answerResult.ratingChange;
  const sign = delta >= 0 ? "+" : "";
  const ratingColor = LinuxVirusUser.ratingColor(newRating).color;
  const deltaClass = delta >= 0
    ? "quiz__rating-delta--up"
    : "quiz__rating-delta--down";
  const ratingEl = document.createElement("div");
  ratingEl.id = "quizRatingChange";
  ratingEl.className = "quiz__rating-change";
  ratingEl.innerHTML = `<span class="quiz__rating-label">レーティング</span><span class="quiz__rating-value" style="color:${ratingColor}">${newRating}</span><span class="quiz__rating-delta ${deltaClass}">${sign}${delta}</span>`;
  insertBeforeActions(ratingEl);
}

function renderResolvedAnswer(answerResult, { timedOut = false } = {}) {
  if (!timedOut) {
    LinuxVirusSound.play("correct");
    LinuxVirusQuiz.lockInteractions();
  } else {
    LinuxVirusQuiz.showCorrectAnswerInTerminal({ timeout: true });
  }

  const bottom = document.querySelector("#quizBottom");
  const quizEl = document.querySelector(".quiz");
  updateResolvedHeader(answerResult, timedOut);
  document.querySelector("#tokens").hidden = true;
  LinuxVirusQuiz.setExplanationHtml(
    LinuxVirusMarkdown.render(answerResult.tutorial),
  );
  if (bottom) {
    bottom.className = "quiz-bottom";
  }
  if (quizEl) {
    quizEl.classList.add("quiz--resolved");
    if (!timedOut) quizEl.classList.add("quiz--celebrate");
  }
  renderSampleOutput(answerResult, timedOut);
  renderExplanationButton();
  document.querySelector("#closeExplanation").hidden = false;
  renderRatingChange(answerResult);
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
    LinuxVirusQuiz.loadQuestion(state.quizMode || "normal", {
      triggerCommand: state.triggerCommand,
    });
    return;
  }

  if (action === "toggleExplanation") {
    const overlay = document.querySelector("#explanationOverlay");
    const overlayContent = document.querySelector("#explanationOverlayContent");
    if (!overlay || !overlayContent) return;
    overlayContent.innerHTML = LinuxVirusQuiz.explanationHtml();
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
      post("minimize");
    }
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
    post("setSleep", {
      sleepMinutes: settings.sleepMinutes,
    });
    return;
  }

  post(action);
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target && target.id === "terminalInput") {
    LinuxVirusQuiz.setTyped(target.value);
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!target) return;

  if (event.key === "Enter" && !event.isComposing && target.id === "userPassword") {
    event.preventDefault();
    LinuxVirusUser.login();
    return;
  }

  if (event.key === "Enter" && !event.isComposing && target.id === "userName") {
    event.preventDefault();
    document.querySelector("#userPassword")?.focus();
    return;
  }

  if (target.id !== "terminalInput") {
    const closeBtn = document.querySelector("#closeExplanation");
    const isFormControl =
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target.isContentEditable;
    if (
      event.key === "Enter"
      && !event.isComposing
      && closeBtn
      && !closeBtn.hidden
      && !isFormControl
    ) {
      event.preventDefault();
      closeBtn.click();
    }
    return;
  }
  if (event.key === "Enter" && !event.isComposing) {
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

function isQuizPage() {
  return IS_QUIZ_PAGE;
}

if (isQuizPage()) {
  LinuxVirusDrag.install();
  LinuxVirusQuiz.setTimeoutHandler(runTimeout);
  post("quizPageReady");
  window.setInterval(() => LinuxVirusQuiz.renderVaccines(), 60000);
} else {
  LinuxVirusDrag.install();
  render();
  window.setInterval(() => LinuxVirusApi.pingHealth(), 60000);
}
