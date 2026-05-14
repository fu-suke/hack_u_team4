const state = {
  state: "minimized",
  timerText: "Timer: not set",
  keyCount: 0,
  buffer: "-",
  commands: ["/focus"],
  timerSeconds: 60,
  status: "Idle",
};

let lastRenderedState = state.state;
let didDrag = false;
let isDragging = false;
let activeDrag = null;
let suppressTokenClickUntil = 0;
let quizVersion = 0;
let renderedQuizVersion = -1;

const quiz = {
  answer: ["ls", "-la"],
  tokens: ["-la", "ls"],
  selected: [],
};

function resetQuizState() {
  quiz.selected = [];
  quizVersion++;
  const result = document.querySelector("#quizResult");
  const bottom = document.querySelector("#quizBottom");
  const quizEl = document.querySelector(".quiz");
  if (result) {
    result.textContent = "トークンを順番に選んでね！";
    result.className = "quiz__result";
  }
  if (bottom) bottom.className = "quiz-bottom";
  if (quizEl) {
    quizEl.classList.remove("quiz--celebrate", "quiz--shake");
  }
  const bar = document.querySelector("#progressBar");
  if (bar) bar.style.width = "30%";
}

let lastFlipDigits = "";

function updateFlipTimer(timerText) {
  const match = timerText.match(/(\d+)s?$/);
  const totalSeconds = match ? parseInt(match[1], 10) : 0;
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  const digits = mm + ss;

  for (let i = 0; i < 4; i++) {
    const card = document.querySelector(`#fd${i}`);
    if (!card) continue;
    const newDigit = digits[i];
    if (lastFlipDigits && lastFlipDigits[i] !== newDigit) {
      card.classList.remove("flipping");
      void card.offsetWidth;
      card.classList.add("flipping");
    }
    card.textContent = newDigit;
  }

  lastFlipDigits = digits;
}

function post(action, payload = {}) {
  window.webkit.messageHandlers.resident.postMessage({ action, ...payload });
}

function setText(selector, value) {
  for (const node of document.querySelectorAll(selector)) {
    node.textContent = value;
  }
}

function createCommandInput(value = "") {
  const input = document.createElement("input");
  input.className = "command-input";
  input.type = "text";
  input.value = value;
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  return input;
}

function createTokenButton(token, action, className, index = "") {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = token;
  button.draggable = true;
  button.dataset.action = action;
  button.dataset.token = token;
  button.dataset.index = String(index);
  return button;
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

function renderQuiz(force = false) {
  if (isDragging) return;
  if (!force && renderedQuizVersion === quizVersion) return;
  renderedQuizVersion = quizVersion;

  const answerEl = document.querySelector("#answer");
  const tokensEl = document.querySelector("#tokens");
  const placeholder = document.querySelector("#answerPlaceholder");

  // Build new children in a fragment to avoid flicker
  const answerFrag = document.createDocumentFragment();
  const tokensFrag = document.createDocumentFragment();

  for (const [index, token] of quiz.selected.entries()) {
    answerFrag.appendChild(
      createTokenButton(token, "unselectToken", "token token--selected", index),
    );
  }

  const remaining = [...quiz.tokens];
  for (const token of quiz.selected) {
    const idx = remaining.indexOf(token);
    if (idx >= 0) remaining.splice(idx, 1);
  }

  for (const token of remaining) {
    tokensFrag.appendChild(createTokenButton(token, "selectToken", "token"));
  }

  answerEl.replaceChildren(answerFrag);
  tokensEl.replaceChildren(tokensFrag);

  // Show/hide placeholder
  if (placeholder) {
    placeholder.style.display = quiz.selected.length ? "none" : "";
  }
}

function render() {
  const app = document.querySelector("#app");
  const enteredExpanded = state.state === "expanded" && lastRenderedState !== "expanded";
  const enteredSettings = state.state === "settings" && lastRenderedState !== "settings";
  app.className = `app app--${state.state}`;
  updateFlipTimer(state.timerText);
  setText('[data-bind="status"]', state.status);
  setText('[data-bind="keyCount"]', `Keys: ${state.keyCount}`);
  setText('[data-bind="buffer"]', `Buffer: ${state.buffer}`);

  const secondsInput = document.querySelector("#timerSeconds");
  if (enteredSettings && secondsInput) {
    secondsInput.value = String(state.timerSeconds);
  }
  if (enteredSettings) {
    setCommandInputs(state.commands || ["/focus"]);
  }

  // Reset quiz when entering expanded view
  if (enteredExpanded) {
    resetQuizState();
  }

  renderQuiz();
  lastRenderedState = state.state;
}

function moveTokenToAnswer(token, targetIndex = quiz.selected.length) {
  const normalizedIndex = Math.max(0, Math.min(targetIndex, quiz.selected.length));
  quiz.selected.splice(normalizedIndex, 0, token);
  quizVersion++;
  document.querySelector("#quizResult").textContent = "いい感じ！並び替え中…";
  renderQuiz();
}

function removeTokenFromAnswer(token, index = quiz.selected.lastIndexOf(token)) {
  if (index >= 0) {
    quiz.selected.splice(index, 1);
  }
  quizVersion++;
  document.querySelector("#quizResult").textContent = "トークンを戻したよ";
  renderQuiz();
}

function reorderAnswerToken(fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= quiz.selected.length) return;
  const [token] = quiz.selected.splice(fromIndex, 1);
  const dest = fromIndex < toIndex ? toIndex - 1 : toIndex;
  quiz.selected.splice(Math.max(0, dest), 0, token);
  quizVersion++;
  document.querySelector("#quizResult").textContent = "並び替えたよ！";
  renderQuiz();
}

function answerDropIndex(event) {
  const targetToken = event.target.closest("#answer .token");
  if (!targetToken) return quiz.selected.length;
  const rect = targetToken.getBoundingClientRect();
  const index = Number(targetToken.dataset.index);
  const afterTarget = event.clientX > rect.left + rect.width / 2;
  return index + (afterTarget ? 1 : 0);
}

function getDragPayload(event) {
  if (activeDrag) return activeDrag;
  const token = event.dataTransfer.getData("text/plain");
  if (!token) return null;
  return {
    token,
    sourceAction: event.dataTransfer.getData("source-action"),
    sourceIndex: Number(event.dataTransfer.getData("source-index")),
  };
}

function clearDragState(suppressClick = true) {
  for (const token of document.querySelectorAll(".token--dragging")) {
    token.classList.remove("token--dragging");
  }
  for (const dropZone of document.querySelectorAll(".dragover")) {
    dropZone.classList.remove("dragover");
  }

  activeDrag = null;
  isDragging = false;

  if (!suppressClick) return;
  didDrag = true;
  suppressTokenClickUntil = Date.now() + 300;
  window.setTimeout(() => {
    if (Date.now() >= suppressTokenClickUntil) didDrag = false;
  }, 300);
}

window.residentSetState = (nextState) => {
  Object.assign(state, nextState);
  render();
};

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  // Token clicks are handled by the dedicated token listener below
  if (button.classList.contains("token")) return;

  const action = button.dataset.action;
  if (action === "resetQuiz") {
    resetQuizState();
    renderQuiz();
    return;
  }

  if (action === "checkQuiz") {
    const correct = quiz.selected.join(" ") === quiz.answer.join(" ");
    const result = document.querySelector("#quizResult");
    const bottom = document.querySelector("#quizBottom");
    const quizEl = document.querySelector(".quiz");
    if (correct) {
      result.textContent = "🎉 正解！すごい！";
      result.className = "quiz__result quiz__result--correct";
      bottom.className = "quiz-bottom quiz-bottom--correct";
      quizEl.classList.add("quiz--celebrate");
      const bar = document.querySelector("#progressBar");
      if (bar) bar.style.width = "100%";
      window.setTimeout(() => post("minimize"), 1200);
    } else {
      result.textContent = "😅 もう一回やってみよう！";
      result.className = "quiz__result quiz__result--wrong";
      bottom.className = "quiz-bottom quiz-bottom--wrong";
      quizEl.classList.add("quiz--shake");
      window.setTimeout(() => quizEl.classList.remove("quiz--shake"), 450);
    }
    return;
  }

  if (action === "addCommand") {
    document.querySelector("#commands").appendChild(createCommandInput());
    return;
  }

  if (action === "showHelp") {
    document.querySelector("#helpDialog").showModal();
    return;
  }

  if (action === "closeHelp") {
    document.querySelector("#helpDialog").close();
    return;
  }

  if (action === "done") {
    post("setTimer", {
      seconds: document.querySelector("#timerSeconds").value,
      commands: getCommandValues(),
    });
    return;
  }

  post(action);
});

// Use click (not pointerup) for token selection to avoid drag conflicts
document.addEventListener("click", (event) => {
  if (didDrag || Date.now() < suppressTokenClickUntil) return;
  const button = event.target.closest(".token");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "selectToken") {
    moveTokenToAnswer(button.dataset.token);
  }
  if (action === "unselectToken") {
    removeTokenFromAnswer(button.dataset.token, Number(button.dataset.index));
  }
});

document.addEventListener("dragstart", (event) => {
  const token = event.target.closest(".token");
  if (!token) return;

  didDrag = true;
  isDragging = true;
  activeDrag = {
    token: token.dataset.token,
    sourceAction: token.dataset.action,
    sourceIndex: Number(token.dataset.index),
  };
  event.dataTransfer.setData("text/plain", token.dataset.token);
  event.dataTransfer.setData("source-action", token.dataset.action);
  event.dataTransfer.setData("source-index", token.dataset.index);
  event.dataTransfer.effectAllowed = "move";
  token.classList.add("token--dragging");
});

document.addEventListener("dragend", () => {
  clearDragState();
});

document.addEventListener("dragover", (event) => {
  const dropZone = event.target.closest("#answer, #tokens");
  if (!dropZone || !activeDrag) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dropZone.classList.add("dragover");
});

document.addEventListener("dragleave", (event) => {
  const dropZone = event.target.closest("#answer, #tokens");
  if (!dropZone || (event.relatedTarget && dropZone.contains(event.relatedTarget))) return;
  dropZone.classList.remove("dragover");
});

document.addEventListener("drop", (event) => {
  const answer = event.target.closest("#answer");
  const tokens = event.target.closest("#tokens");
  if (!answer && !tokens) {
    clearDragState();
    return;
  }

  event.preventDefault();

  const payload = getDragPayload(event);
  const dropIndex = answer ? answerDropIndex(event) : quiz.selected.length;
  clearDragState();
  if (!payload) return;

  if (answer && payload.sourceAction === "selectToken") {
    moveTokenToAnswer(payload.token, dropIndex);
    return;
  }
  if (answer && payload.sourceAction === "unselectToken") {
    reorderAnswerToken(payload.sourceIndex, dropIndex);
    return;
  }
  if (tokens && payload.sourceAction === "unselectToken") {
    removeTokenFromAnswer(payload.token, payload.sourceIndex);
  }
});

render();
