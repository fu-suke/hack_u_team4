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
let draggedToken = null;

const quiz = {
  answer: ["ls", "-la"],
  tokens: ["-la", "ls"],
  selected: [],
};

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

function renderQuiz() {
  const answer = document.querySelector("#answer");
  const tokens = document.querySelector("#tokens");
  answer.replaceChildren();
  tokens.replaceChildren();

  for (const [index, token] of quiz.selected.entries()) {
    answer.appendChild(createTokenButton(token, "unselectToken", "token token--selected", index));
  }

  const remaining = [...quiz.tokens];
  for (const token of quiz.selected) {
    const index = remaining.indexOf(token);
    if (index >= 0) {
      remaining.splice(index, 1);
    }
  }

  for (const token of remaining) {
    tokens.appendChild(createTokenButton(token, "selectToken", "token"));
  }

  if (!quiz.selected.length) {
    answer.textContent = "ここにドラッグするか、下のトークンを順番にクリック";
  }
}

function render() {
  const app = document.querySelector("#app");
  const enteredSettings = state.state === "settings" && lastRenderedState !== "settings";
  app.className = `app app--${state.state}`;
  setText('[data-bind="timerText"]', state.timerText);
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
  renderQuiz();
  lastRenderedState = state.state;
}

function moveTokenToAnswer(token, targetIndex = quiz.selected.length) {
  quiz.selected.splice(targetIndex, 0, token);
  document.querySelector("#quizResult").textContent = "並び替え中です。";
  renderQuiz();
}

function removeTokenFromAnswer(token, index = quiz.selected.lastIndexOf(token)) {
  if (index >= 0) {
    quiz.selected.splice(index, 1);
  }
  document.querySelector("#quizResult").textContent = "トークンを戻しました。";
  renderQuiz();
}

function reorderAnswerToken(fromIndex, toIndex) {
  if (fromIndex < 0 || fromIndex >= quiz.selected.length) {
    return;
  }

  const [token] = quiz.selected.splice(fromIndex, 1);
  const normalizedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  quiz.selected.splice(Math.max(0, normalizedIndex), 0, token);
  document.querySelector("#quizResult").textContent = "回答欄を並び替えました。";
  renderQuiz();
}

function answerDropIndex(event) {
  const targetToken = event.target.closest("#answer .token");
  if (!targetToken) {
    return quiz.selected.length;
  }

  const rect = targetToken.getBoundingClientRect();
  const index = Number(targetToken.dataset.index);
  const afterTarget = event.clientX > rect.left + rect.width / 2;
  return index + (afterTarget ? 1 : 0);
}

window.residentSetState = (nextState) => {
  Object.assign(state, nextState);
  render();
};

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === "resetQuiz") {
    quiz.selected = [];
    document.querySelector("#quizResult").textContent = "順番に選択してください。";
    renderQuiz();
    return;
  }

  if (action === "checkQuiz") {
    const correct = quiz.selected.join(" ") === quiz.answer.join(" ");
    document.querySelector("#quizResult").textContent = correct ? "正解です: ls -la" : "まだ違います。";
    if (correct) {
      window.setTimeout(() => post("minimize"), 450);
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

document.addEventListener("pointerup", (event) => {
  const button = event.target.closest(".token");
  if (!button || draggedToken) {
    return;
  }

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
  if (!token) {
    return;
  }

  event.dataTransfer.setData("text/plain", token.dataset.token);
  event.dataTransfer.setData("source-action", token.dataset.action);
  event.dataTransfer.setData("source-index", token.dataset.index);
  draggedToken = token;
  token.classList.add("token--dragging");
});

document.addEventListener("dragend", () => {
  if (draggedToken) {
    draggedToken.classList.remove("token--dragging");
  }
  draggedToken = null;
});

document.addEventListener("dragover", (event) => {
  if (event.target.closest("#answer, #tokens")) {
    event.preventDefault();
  }
});

document.addEventListener("drop", (event) => {
  const answer = event.target.closest("#answer");
  const tokens = event.target.closest("#tokens");
  if (!answer && !tokens) {
    return;
  }

  event.preventDefault();
  const token = event.dataTransfer.getData("text/plain");
  const sourceAction = event.dataTransfer.getData("source-action");
  const sourceIndex = Number(event.dataTransfer.getData("source-index"));
  if (!token) {
    return;
  }

  if (answer && sourceAction === "selectToken") {
    moveTokenToAnswer(token, answerDropIndex(event));
    return;
  }
  if (answer && sourceAction === "unselectToken") {
    reorderAnswerToken(sourceIndex, answerDropIndex(event));
    return;
  }
  if (tokens && sourceAction === "unselectToken") {
    removeTokenFromAnswer(token, sourceIndex);
  }
  renderQuiz();
});

render();
