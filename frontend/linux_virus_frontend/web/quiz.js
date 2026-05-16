const LinuxVirusQuiz = (() => {
  let quizVersion = 0;
  let renderedQuizVersion = -1;

  const quiz = {
    id: null,
    prompt: "問題を読み込み中…",
    choices: [],
    selected: [],
    answerLogged: false,
  };

  function choiceFromDataset(dataset) {
    return {
      id: Number(dataset.id),
      label: dataset.label,
    };
  }

  function shuffleChoices(choices) {
    const shuffled = [...choices];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const nextIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]];
    }
    return shuffled;
  }

  function normalizeQuestion(data) {
    const questionId = Number(data.id);
    if (!Number.isInteger(questionId) || !Array.isArray(data.choices)) {
      throw new Error("Invalid question payload");
    }

    return {
      id: questionId,
      prompt: String(data.prompt),
      choices: shuffleChoices(
        data.choices.map((label, index) => ({
          id: index + 1,
          label: String(label),
        })),
      ),
    };
  }

  function createTokenButton(choice, action, className, index = "") {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = choice.label;
    button.draggable = true;
    button.dataset.action = action;
    button.dataset.id = String(choice.id);
    button.dataset.label = choice.label;
    button.dataset.index = String(index);
    return button;
  }

  function findSelectedIndex(choice) {
    for (let index = quiz.selected.length - 1; index >= 0; index--) {
      if (quiz.selected[index].id === choice.id) return index;
    }
    return -1;
  }

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
  }

  async function loadQuestion() {
    const promptEl = document.querySelector("#quizPrompt");
    if (promptEl) promptEl.textContent = "問題を読み込み中…";

    try {
      Object.assign(quiz, normalizeQuestion(await LinuxVirusApi.fetchQuestion()), {
        selected: [],
        answerLogged: false,
      });
      if (promptEl) promptEl.textContent = quiz.prompt;
      resetQuizState();
      renderQuiz(true);
    } catch (error) {
      console.error("Failed to load question", error);
      if (promptEl) promptEl.textContent = "問題を読み込めませんでした。";
      const result = document.querySelector("#quizResult");
      if (result) result.textContent = "バックエンドの起動を確認してね";
    }
  }

  function renderQuiz(force = false) {
    if (LinuxVirusDrag.isDragging()) return;
    if (!force && renderedQuizVersion === quizVersion) return;
    renderedQuizVersion = quizVersion;

    const promptEl = document.querySelector("#quizPrompt");
    const answerEl = document.querySelector("#answer");
    const tokensEl = document.querySelector("#tokens");
    const placeholder = document.querySelector("#answerPlaceholder");

    if (promptEl) promptEl.textContent = quiz.prompt;

    const answerFrag = document.createDocumentFragment();
    const tokensFrag = document.createDocumentFragment();

    for (const [index, token] of quiz.selected.entries()) {
      answerFrag.appendChild(
        createTokenButton(token, "unselectToken", "token token--selected", index),
      );
    }

    const remaining = [...quiz.choices];
    for (const choice of quiz.selected) {
      const idx = remaining.findIndex((item) => item.id === choice.id);
      if (idx >= 0) remaining.splice(idx, 1);
    }

    for (const choice of remaining) {
      tokensFrag.appendChild(createTokenButton(choice, "selectToken", "token"));
    }

    answerEl.replaceChildren(answerFrag);
    tokensEl.replaceChildren(tokensFrag);

    if (placeholder) {
      placeholder.style.display = quiz.selected.length ? "none" : "";
    }
  }

  function moveTokenToAnswer(choice, targetIndex = quiz.selected.length) {
    const normalizedIndex = Math.max(0, Math.min(targetIndex, quiz.selected.length));
    quiz.selected.splice(normalizedIndex, 0, choice);
    quizVersion++;
    document.querySelector("#quizResult").textContent = "いい感じ！並び替え中…";
    renderQuiz();
  }

  function removeTokenFromAnswer(choice, index = findSelectedIndex(choice)) {
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

  async function checkAndLogAnswer() {
    if (quiz.id === null) {
      throw new Error("Question is not loaded");
    }

    const correct = await LinuxVirusApi.checkAnswer(quiz.id, quiz.selected);
    if (!quiz.answerLogged) {
      quiz.answerLogged = true;
      await LinuxVirusApi.submitAnswerLog(quiz.id, correct);
    }
    return correct;
  }

  return {
    checkAndLogAnswer,
    choiceFromDataset,
    loadQuestion,
    moveTokenToAnswer,
    removeTokenFromAnswer,
    renderQuiz,
    reorderAnswerToken,
    resetQuizState,
    selectedLength: () => quiz.selected.length,
  };
})();
