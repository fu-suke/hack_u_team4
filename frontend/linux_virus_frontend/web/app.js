const state = {
  state: "minimized",
  timerText: "Timer: not set",
  keyCount: 0,
  buffer: "-",
  commands: ["<cmd>+v"],
  timerSeconds: 60,
  sleepMinutes: 0,
  timerMode: "timer",
  status: "Idle",
};

let lastRenderedState = state.state;

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
  const enteredExpanded = state.state === "expanded" && lastRenderedState !== "expanded";
  const enteredSettings = state.state === "settings" && lastRenderedState !== "settings";
  const enteredUser = state.state === "user" && lastRenderedState !== "user";
  app.className = `app app--${state.state}`;
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
    LinuxVirusSettings.setCommandInputs(state.commands || ["<cmd>+v"]);
  }
  if (enteredExpanded) {
    LinuxVirusQuiz.loadQuestion();
  }
  if (enteredUser) {
    LinuxVirusUser.renderUserScreen();
  }

  LinuxVirusQuiz.renderQuiz();
  lastRenderedState = state.state;
}

window.residentSetState = (nextState) => {
  Object.assign(state, nextState);
  render();
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.classList.contains("token")) return;

  const action = button.dataset.action;
  if (action === "resetQuiz") {
    document.querySelector("#resetQuiz").hidden = false;
    document.querySelector("#checkQuiz").hidden = false;
    document.querySelector("#closeExplanation").hidden = true;
    LinuxVirusQuiz.resetQuizState();
    LinuxVirusQuiz.renderQuiz();
    return;
  }

  if (action === "closeExplanation") {
    post("minimize");
    return;
  }

  if (action === "checkQuiz") {
    const result = document.querySelector("#quizResult");
    const bottom = document.querySelector("#quizBottom");
    const quizEl = document.querySelector(".quiz");
    let answerResult = null;
    try {
      answerResult = await LinuxVirusQuiz.checkAndLogAnswer();
    } catch (error) {
      console.error("Failed to check answer", error);
      result.textContent = "判定できませんでした。";
      result.className = "quiz__result quiz__result--wrong";
      bottom.className = "quiz-bottom quiz-bottom--wrong";
      return;
    }

    if (answerResult.correct) {
      result.textContent = `🎉 正解！ ${answerResult.tutorial}`;
      result.className = "quiz__result quiz__result--correct quiz__result--explanation";
      bottom.className = "quiz-bottom quiz-bottom--correct";
      quizEl.classList.add("quiz--celebrate");
      document.querySelector("#resetQuiz").hidden = true;
      document.querySelector("#checkQuiz").hidden = true;
      document.querySelector("#closeExplanation").hidden = false;
    } else {
      result.textContent = "😅 もう一回やってみよう！";
      result.className = "quiz__result quiz__result--wrong";
      bottom.className = "quiz-bottom quiz-bottom--wrong";
      document.querySelector("#resetQuiz").hidden = true;
      document.querySelector("#checkQuiz").hidden = true;
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

  if (action === "done") {
    post("setTimer", {
      seconds: document.querySelector("#timerSeconds").value,
      sleepMinutes: document.querySelector("#sleepMinutes").value,
      commands: LinuxVirusSettings.getCommandValues(),
    });
    return;
  }

  post(action);
});

document.addEventListener("click", (event) => {
  if (LinuxVirusDrag.isClickSuppressed()) return;
  const button = event.target.closest(".token");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "selectToken") {
    LinuxVirusQuiz.moveTokenToAnswer(LinuxVirusQuiz.choiceFromDataset(button.dataset));
  }
  if (action === "unselectToken") {
    LinuxVirusQuiz.removeTokenFromAnswer(
      LinuxVirusQuiz.choiceFromDataset(button.dataset),
      Number(button.dataset.index),
    );
  }
});

LinuxVirusDrag.install();
render();
