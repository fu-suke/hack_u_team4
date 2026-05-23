const LinuxVirusQuiz = (() => {
  let quizVersion = 0;
  let renderedQuizVersion = -1;
  let isLoading = false;
  let isChecking = false;

  const quiz = {
    id: null,
    difficulty: 1,
    prompt: "問題を読み込み中…",
    tutorial: "",
    sample_output: "",
    choices: [],
    selected: [],
    answers: [],
    mode: "normal",
    answerLogged: false,
    interactionLocked: false,
    preAnswerRating: null,
    lastRatingChange: null,
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

  function normalizeQuestion(data, mode = "normal") {
    const questionId = Number(data.id);
    if (!Number.isInteger(questionId) || !Array.isArray(data.choices)) {
      throw new Error("Invalid question payload");
    }

    const answers = Array.isArray(data.answers)
      ? data.answers.map((answer) => (Array.isArray(answer) ? answer.map(Number) : []))
      : [];

    return {
      id: questionId,
      difficulty: normalizeDifficulty(data.difficulty),
      prompt: String(data.prompt),
      tutorial: String(data.tutorial || LinuxVirusConfig.get("defaultTutorial", "")),
      sample_output: String(data.sample_output || ""),
      answers,
      mode,
      choices: shuffleChoices(
        data.choices.map((label, index) => ({
          id: index + 1,
          label: String(label),
        })),
      ),
    };
  }

  function normalizeDifficulty(value) {
    const difficulty = Number(value);
    if (difficulty === 2 || difficulty === 3) return difficulty;
    return 1;
  }

  function updateMascot() {
    const mascot = document.querySelector("#quizMascot");
    if (!mascot) return;

    const images = LinuxVirusConfig.get("penguinImages", {});
    const src = quiz.mode === "virus"
      ? images.virus || images["3"] || images["1"]
      : images[String(quiz.difficulty)] || images["1"];
    if (!src) return;
    if (mascot.getAttribute("src") !== src) {
      mascot.setAttribute("src", src);
    }
    const alt = quiz.mode === "virus"
      ? "Virus Linux penguin"
      : `Difficulty ${quiz.difficulty} Linux penguin`;
    mascot.setAttribute("alt", alt);
  }

  function createTokenButton(choice, action, className, index = "") {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = choice.label;
    button.draggable = !quiz.interactionLocked;
    button.disabled = quiz.interactionLocked;
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
    quiz.interactionLocked = false;
    quizVersion++;
    const result = document.querySelector("#quizResult");
    const bottom = document.querySelector("#quizBottom");
    const quizEl = document.querySelector(".quiz");
    const sampleOutput = document.querySelector("#sampleOutput");
    const ratingChange = document.querySelector("#quizRatingChange");
    const shellCommand = document.querySelector("#quizShellCommand");
    if (sampleOutput) sampleOutput.remove();
    if (ratingChange) ratingChange.remove();
    if (shellCommand) shellCommand.remove();
    if (result) {
      result.textContent = "トークンを順番に選んでね！";
      result.className = "quiz__result";
    }
    if (bottom) bottom.className = "quiz-bottom";
    document.querySelector("#resetQuiz").hidden = false;
    document.querySelector("#checkQuiz").hidden = false;
    document.querySelector("#closeExplanation").hidden = true;
    if (quizEl) {
      quizEl.classList.remove("quiz--celebrate", "quiz--shake");
    }
  }

  function renderVaccines() {
    const container = document.querySelector("#vaccineButtons");
    if (!container) return;

    const vaccineState = LinuxVirusStorage.readVaccineState();
    const buttons = [];
    for (let index = 0; index < 3; index++) {
      const button = document.createElement("button");
      button.className = "quiz__vaccine";
      button.type = "button";
      button.dataset.action = "useVaccine";
      button.textContent = "💉";
      button.disabled = index >= vaccineState.remaining;
      button.setAttribute(
        "aria-label",
        button.disabled ? "Used vaccine" : "Use vaccine",
      );
      buttons.push(button);
    }
    container.replaceChildren(...buttons);
  }

  function showVaccineMessage() {
    const result = document.querySelector("#quizResult");
    const bottom = document.querySelector("#quizBottom");
    if (result) {
      result.textContent = "ワクチンを使用しました。問題をスキップします。";
      result.className = "quiz__result quiz__result--vaccine";
    }
    if (bottom) bottom.className = "quiz-bottom quiz-bottom--vaccine";
    setActionsDisabled(true);
    for (const button of document.querySelectorAll(".quiz__vaccine")) {
      button.disabled = true;
    }
  }

  async function fetchQuestionByMode(mode) {
    if (mode === "virus") {
      return LinuxVirusApi.fetchVirusQuestion();
    }
    const userId = LinuxVirusUser.currentUserId();
    if (userId && LinuxVirusSettings.isPersonalizeEnabled()) {
      try {
        return await LinuxVirusApi.fetchPersonalizedQuestion(userId);
      } catch (error) {
        console.warn("Personalize fetch failed, falling back to random", error);
        return LinuxVirusApi.fetchQuestion();
      }
    }
    return LinuxVirusApi.fetchQuestion();
  }

  async function loadQuestion(mode = "normal") {
    if (isLoading) return;
    isLoading = true;
    const promptEl = document.querySelector("#quizPrompt");
    const quizEl = document.querySelector(".quiz");
    const result = document.querySelector("#quizResult");
    if (promptEl) promptEl.textContent = "問題を読み込み中…";
    const labelEl = document.querySelector(".quiz__label");
    if (labelEl) {
      labelEl.textContent = "コマンドを並び替えよう";
      labelEl.classList.remove("quiz__label--correct");
    }
    document.querySelector("#answer").hidden = false;
    document.querySelector("#tokens").hidden = false;
    if (quizEl) quizEl.setAttribute("aria-busy", "true");
    setActionsDisabled(true);
    document.querySelector("#retryQuiz")?.setAttribute("hidden", "");

    try {
      const data = await fetchQuestionByMode(mode);
      Object.assign(quiz, normalizeQuestion(data, mode), {
        selected: [],
        answerLogged: false,
        interactionLocked: false,
        preAnswerRating: null,
        lastRatingChange: null,
      });
      const userId = LinuxVirusUser.currentUserId();
      if (userId) {
        try {
          const ratingData = await LinuxVirusApi.fetchRating(userId);
          quiz.preAnswerRating = Math.round(Number(ratingData.rating || 0));
        } catch (_) {
          quiz.preAnswerRating = null;
        }
      }
      if (promptEl) promptEl.innerHTML = LinuxVirusMarkdown.render(quiz.prompt);
      resetQuizState();
      renderQuiz(true);
    } catch (error) {
      console.error("Failed to load question", error);
      quiz.id = null;
      quiz.difficulty = 1;
      quiz.choices = [];
      quiz.selected = [];
      quiz.answers = [];
      quiz.mode = mode;
      quiz.interactionLocked = false;
      if (promptEl) promptEl.textContent = "問題を読み込めませんでした。";
      if (result) {
        result.textContent =
          error && error.isNetwork
            ? "バックエンドに接続できません。再試行してください。"
            : "問題の取得に失敗しました。";
        result.className = "quiz__result quiz__result--wrong";
      }
      document.querySelector("#retryQuiz")?.removeAttribute("hidden");
      document.querySelector("#resetQuiz").hidden = true;
      document.querySelector("#checkQuiz").hidden = true;
    } finally {
      if (quizEl) quizEl.removeAttribute("aria-busy");
      setActionsDisabled(false);
      isLoading = false;
    }
  }

  function setActionsDisabled(disabled) {
    for (const id of ["resetQuiz", "checkQuiz", "closeExplanation", "retryQuiz"]) {
      const el = document.querySelector(`#${id}`);
      if (el) el.disabled = disabled;
    }
  }

  function renderQuiz(force = false) {
    if (!force && LinuxVirusDrag.isDragging()) return;
    if (!force && renderedQuizVersion === quizVersion) return;
    renderedQuizVersion = quizVersion;

    const promptEl = document.querySelector("#quizPrompt");
    const answerEl = document.querySelector("#answer");
    const tokensEl = document.querySelector("#tokens");
    const placeholder = document.querySelector("#answerPlaceholder");

    if (promptEl) promptEl.innerHTML = LinuxVirusMarkdown.render(quiz.prompt);
    renderVaccines();
    updateMascot();

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
    if (quiz.interactionLocked) return;
    const normalizedIndex = Math.max(0, Math.min(targetIndex, quiz.selected.length));
    quiz.selected.splice(normalizedIndex, 0, choice);
    quizVersion++;
    document.querySelector("#quizResult").textContent = "いい感じ！並び替え中…";
    renderQuiz();
  }

  function removeTokenFromAnswer(choice, index = findSelectedIndex(choice)) {
    if (quiz.interactionLocked) return;
    if (index >= 0) {
      quiz.selected.splice(index, 1);
    }
    quizVersion++;
    document.querySelector("#quizResult").textContent = "トークンを戻したよ";
    renderQuiz();
  }

  function reorderAnswerToken(fromIndex, toIndex) {
    if (quiz.interactionLocked) return;
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
    if (isChecking) return null;
    isChecking = true;
    setActionsDisabled(true);
    try {
      const correct = await LinuxVirusApi.checkAnswer(quiz.id, quiz.selected);
      let ratingChange = null;
      if (!quiz.answerLogged) {
        quiz.answerLogged = true;
        const userId = LinuxVirusUser.currentUserId();
        if (userId) {
          try {
            await LinuxVirusApi.submitAnswerLog(quiz.id, correct, userId);
            if (quiz.preAnswerRating !== null) {
              const ratingData = await LinuxVirusApi.fetchRating(userId);
              const newRating = Math.round(Number(ratingData.rating || 0));
              ratingChange = { newRating, delta: newRating - quiz.preAnswerRating };
              quiz.lastRatingChange = ratingChange;
            }
          } catch (err) {
            console.error("Failed to submit answer log or fetch rating", err);
          }
        }
        if (quiz.mode === "virus" && correct) {
          LinuxVirusApi.decreaseVirusQuestion(quiz.id).catch((err) => {
            console.error("Failed to decrease virus question", err);
          });
        }
        if (quiz.mode !== "virus" && !correct) {
          LinuxVirusApi.increaseVirusQuestion(quiz.id).catch((err) => {
            console.error("Failed to increase virus question", err);
          });
        }
      }
      const command = quiz.selected.map((c) => c.label).join(" ");
      return { correct, command, tutorial: quiz.tutorial, sample_output: quiz.sample_output, ratingChange: ratingChange ?? quiz.lastRatingChange };
    } finally {
      isChecking = false;
      setActionsDisabled(false);
    }
  }

  function isBusy() {
    return isLoading || isChecking;
  }

  function lockInteractions() {
    quiz.interactionLocked = true;
    quizVersion++;
    renderQuiz(true);
  }

  function isInteractionLocked() {
    return quiz.interactionLocked;
  }

  function isVirusMode() {
    return quiz.mode === "virus";
  }

  function hasChoiceId(id) {
    const target = Number(id);
    return quiz.choices.some((choice) => choice.id === target);
  }

  return {
    checkAndLogAnswer,
    choiceFromDataset,
    hasChoiceId,
    isInteractionLocked,
    isBusy,
    isVirusMode,
    loadQuestion,
    lockInteractions,
    moveTokenToAnswer,
    removeTokenFromAnswer,
    renderQuiz,
    renderVaccines,
    reorderAnswerToken,
    resetQuizState,
    selectedLength: () => quiz.selected.length,
    showVaccineMessage,
  };
})();
