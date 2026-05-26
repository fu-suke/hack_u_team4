const LinuxVirusQuiz = (() => {
  const ANSWER_TIME_LIMIT_MS = 60000;
  let quizVersion = 0;
  let renderedQuizVersion = -1;
  let isLoading = false;
  let isChecking = false;
  let countdownTimer = null;
  let countdownDeadline = 0;
  let timeoutHandler = null;

  const quiz = {
    id: null,
    difficulty: 1,
    prompt: "問題を読み込み中…",
    tutorial: "",
    sample_output: "",
    correct_answer: "",
    choices: [],
    selected: [],
    typed: "",
    answers: [],
    mode: "normal",
    answerLogged: false,
    interactionLocked: false,
    preAnswerRating: null,
    lastStreak: 0,
    lastRatingChange: null,
  };

  function tokenizeTyped() {
    return quiz.typed.trim().split(/\s+/).filter(Boolean);
  }

  function takeChoiceFromPool(pool, token) {
    const idx = pool.findIndex((choice) => choice.label === token);
    if (idx < 0) return null;
    const [choice] = pool.splice(idx, 1);
    return choice;
  }

  function parsedAnswer() {
    const tokens = tokenizeTyped();
    const pool = quiz.choices.map((choice) => ({ ...choice }));
    const result = [];
    for (const tok of tokens) {
      result.push(takeChoiceFromPool(pool, tok) || { id: 0, label: tok });
    }
    return result;
  }

  function parsedTypedSegments() {
    const pool = quiz.choices.map((choice) => ({ ...choice }));
    return quiz.typed.split(/(\s+)/).map((segment) => {
      if (!segment || /^\s+$/.test(segment)) {
        return { text: segment, invalid: false };
      }

      if (takeChoiceFromPool(pool, segment)) {
        return { text: segment, invalid: false };
      }
      return { text: segment, invalid: true };
    });
  }

  function usedChoiceIds() {
    const used = new Set();
    for (const choice of parsedAnswer()) {
      if (choice.id > 0) used.add(choice.id);
    }
    return used;
  }

  function hasInvalidTypedTokens() {
    for (const choice of parsedAnswer()) {
      if (choice.id === 0) return true;
    }
    return false;
  }

  function completeToken(prefix) {
    if (!prefix) return null;
    const used = usedChoiceIds();
    const matches = quiz.choices.filter(
      (choice) => choice.label.startsWith(prefix) && !used.has(choice.id),
    );
    const uniqueLabels = [...new Set(matches.map((choice) => choice.label))];
    if (uniqueLabels.length !== 1) return null;
    if (uniqueLabels[0] === prefix) return null;
    return uniqueLabels[0];
  }

  function reorderChoice(fromIndex, toIndex) {
    if (quiz.interactionLocked) return;
    if (fromIndex < 0 || fromIndex >= quiz.choices.length) return;
    const [moved] = quiz.choices.splice(fromIndex, 1);
    const dest = fromIndex < toIndex ? toIndex - 1 : toIndex;
    quiz.choices.splice(Math.max(0, dest), 0, moved);
    quizVersion++;
    renderQuiz();
  }

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
      correct_answer: String(data.correct_answer || ""),
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

  function createTokenButton(choice, action, className, index = "", { dimmed = false } = {}) {
    const button = document.createElement("button");
    button.className = dimmed ? `${className} token--used` : className;
    button.type = "button";
    button.textContent = choice.label;
    const interactive = !quiz.interactionLocked && !dimmed;
    button.draggable = interactive;
    button.disabled = !interactive;
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

  function setTimeoutHandler(handler) {
    timeoutHandler = typeof handler === "function" ? handler : null;
  }

  function resetTimebar() {
    const timebar = document.querySelector("#quizTimebar");
    const fill = document.querySelector("#quizTimebarFill");
    if (timebar) timebar.hidden = false;
    if (fill) fill.style.transform = "scaleX(1)";
  }

  function stopCountdown() {
    if (countdownTimer !== null) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function updateCountdown() {
    const fill = document.querySelector("#quizTimebarFill");
    const remaining = Math.max(0, countdownDeadline - Date.now());
    if (fill) {
      fill.style.transform = `scaleX(${remaining / ANSWER_TIME_LIMIT_MS})`;
    }
    if (quiz.interactionLocked || isChecking || isLoading || quiz.id === null) return;
    if (remaining > 0) return;

    stopCountdown();
    if (timeoutHandler) timeoutHandler();
  }

  function startCountdown() {
    stopCountdown();
    countdownDeadline = Date.now() + ANSWER_TIME_LIMIT_MS;
    resetTimebar();
    countdownTimer = window.setInterval(updateCountdown, 200);
    updateCountdown();
  }

  function resetQuizState() {
    quiz.selected = [];
    quiz.typed = "";
    const terminalInput = document.querySelector("#terminalInput");
    if (terminalInput) {
      terminalInput.value = "";
      terminalInput.disabled = false;
    }
    document.querySelector(".quiz__terminal")?.classList.remove("quiz__terminal--timeout");
    quiz.interactionLocked = false;
    quizVersion++;
    const result = document.querySelector("#quizResult");
    const bottom = document.querySelector("#quizBottom");
    const quizEl = document.querySelector(".quiz");
    const sampleOutput = document.querySelector("#sampleOutput");
    const ratingChange = document.querySelector("#quizRatingChange");
    const shellCommand = document.querySelector("#quizShellCommand");
    const toggleExplanation = document.querySelector("#toggleExplanation");
    const explanationOverlay = document.querySelector("#explanationOverlay");
    const explanationOverlayContent = document.querySelector("#explanationOverlayContent");
    if (sampleOutput) sampleOutput.remove();
    if (ratingChange) ratingChange.remove();
    if (shellCommand) shellCommand.remove();
    if (toggleExplanation) toggleExplanation.remove();
    if (explanationOverlay) explanationOverlay.hidden = true;
    if (explanationOverlayContent) explanationOverlayContent.innerHTML = "";
    if (result) {
      result.hidden = false;
      result.textContent = "ターミナルにコマンドを入力してね！";
      result.className = "quiz__result";
    }
    if (bottom) bottom.className = "quiz-bottom";
    document.querySelector("#closeExplanation").hidden = true;
    const hintEl = document.querySelector(".quiz__hint");
    if (hintEl) hintEl.hidden = false;
    if (quizEl) {
      quizEl.classList.remove("quiz--celebrate", "quiz--resolved", "quiz--shake");
    }
    resetTimebar();
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
      button.disabled = quiz.interactionLocked || index >= vaccineState.remaining;
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
    stopCountdown();
    isLoading = true;
    const promptEl = document.querySelector("#quizPrompt");
    const quizEl = document.querySelector(".quiz");
    const result = document.querySelector("#quizResult");
    if (promptEl) promptEl.textContent = "問題を読み込み中…";
    const labelEl = document.querySelector(".quiz__label");
    if (labelEl) {
      labelEl.textContent = "ターミナルにコマンドを入力しよう";
      labelEl.classList.remove("quiz__label--correct", "quiz__label--timeout");
    }
    const streakEl = document.querySelector("#quizStreak");
    if (streakEl) streakEl.hidden = true;
    const tokensContainer = document.querySelector("#tokens");
    if (tokensContainer) tokensContainer.hidden = false;
    if (quizEl) quizEl.setAttribute("aria-busy", "true");
    setActionsDisabled(true);
    document.querySelector("#retryQuiz")?.setAttribute("hidden", "");

    try {
      const data = await fetchQuestionByMode(mode);
      Object.assign(quiz, normalizeQuestion(data, mode), {
        selected: [],
        typed: "",
        answerLogged: false,
        interactionLocked: false,
        preAnswerRating: null,
        lastRatingChange: null,
        lastStreak: 0,
      });
      const userId = LinuxVirusUser.currentUserId();
      if (userId) {
        try {
          const ratingData = await LinuxVirusApi.fetchRating(userId);
          quiz.preAnswerRating = Math.round(Number(ratingData.rating || 0));
        } catch (_) {
          quiz.preAnswerRating = null;
        }
        try {
          const streakData = await LinuxVirusApi.fetchStreak(userId);
          quiz.lastStreak = streakData.streak;
        } catch (_) {
          quiz.lastStreak = 0;
        }
      }
      if (promptEl) promptEl.innerHTML = LinuxVirusMarkdown.render(quiz.prompt);
      resetQuizState();
      renderQuiz(true);
      startCountdown();
      const streakBadge = document.querySelector("#quizStreak");
      if (streakBadge) {
        if (quiz.lastStreak >= 2) {
          streakBadge.textContent = `${quiz.lastStreak}問連続正解中！`;
          streakBadge.hidden = false;
        } else {
          streakBadge.hidden = true;
        }
      }
    } catch (error) {
      console.error("Failed to load question", error);
      quiz.id = null;
      quiz.difficulty = 1;
      quiz.choices = [];
      quiz.selected = [];
      quiz.answers = [];
      quiz.correct_answer = "";
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
      stopCountdown();
      document.querySelector("#retryQuiz")?.removeAttribute("hidden");
    } finally {
      if (quizEl) quizEl.removeAttribute("aria-busy");
      setActionsDisabled(false);
      isLoading = false;
    }
  }

  function setActionsDisabled(disabled) {
    for (const id of ["closeExplanation", "retryQuiz"]) {
      const el = document.querySelector(`#${id}`);
      if (el) el.disabled = disabled;
    }
  }

  function renderQuiz(force = false) {
    if (!force && LinuxVirusDrag.isDragging()) return;
    if (!force && renderedQuizVersion === quizVersion) return;
    renderedQuizVersion = quizVersion;

    const promptEl = document.querySelector("#quizPrompt");
    const tokensEl = document.querySelector("#tokens");

    if (promptEl) promptEl.innerHTML = LinuxVirusMarkdown.render(quiz.prompt);
    renderTerminalHighlight();
    renderVaccines();
    updateMascot();

    const tokensFrag = document.createDocumentFragment();
    const used = usedChoiceIds();
    for (const [index, choice] of quiz.choices.entries()) {
      tokensFrag.appendChild(
        createTokenButton(choice, "selectToken", "token", index, { dimmed: used.has(choice.id) }),
      );
    }
    tokensEl.replaceChildren(tokensFrag);
  }

  function renderTerminalHighlight() {
    const highlightEl = document.querySelector("#terminalHighlight");
    if (!highlightEl) return;

    const frag = document.createDocumentFragment();
    for (const segment of parsedTypedSegments()) {
      const span = document.createElement("span");
      span.textContent = segment.text;
      if (segment.invalid) span.className = "quiz__terminal-invalid";
      frag.appendChild(span);
    }
    highlightEl.replaceChildren(frag);
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
      const correct = await LinuxVirusApi.checkAnswer(quiz.id, parsedAnswer());
      const ratingChange = await logAnswerResult(correct);
      const command = quiz.typed.trim() || quiz.selected.map((c) => c.label).join(" ");
      return { correct, command, tutorial: quiz.tutorial, sample_output: quiz.sample_output, ratingChange: ratingChange ?? quiz.lastRatingChange, streak: quiz.lastStreak ?? 0 };
    } finally {
      isChecking = false;
      setActionsDisabled(false);
    }
  }

  async function logAnswerResult(correct) {
    let ratingChange = null;
    if (quiz.answerLogged) return ratingChange;

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
        if (correct) {
          const streakData = await LinuxVirusApi.fetchStreak(userId);
          quiz.lastStreak = streakData.streak;
        } else {
          quiz.lastStreak = 0;
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
    return ratingChange;
  }

  async function timeoutAndLogAnswer() {
    if (quiz.id === null) {
      throw new Error("Question is not loaded");
    }
    if (isChecking) return null;
    isChecking = true;
    stopCountdown();
    lockInteractions();
    setActionsDisabled(true);
    try {
      const ratingChange = await logAnswerResult(false);
      return {
        correct: false,
        timedOut: true,
        command: quiz.typed.trim() || quiz.selected.map((c) => c.label).join(" "),
        tutorial: quiz.tutorial,
        sample_output: quiz.sample_output,
        correct_answer: quiz.correct_answer,
        ratingChange: ratingChange ?? quiz.lastRatingChange,
        streak: quiz.lastStreak ?? 0,
      };
    } finally {
      isChecking = false;
      setActionsDisabled(false);
    }
  }

  function isBusy() {
    return isLoading || isChecking;
  }

  function lockInteractions() {
    stopCountdown();
    quiz.interactionLocked = true;
    const terminalInput = document.querySelector("#terminalInput");
    if (terminalInput) terminalInput.disabled = true;
    quizVersion++;
    renderQuiz(true);
  }

  function showCorrectAnswerInTerminal({ timeout = false } = {}) {
    const answer = quiz.correct_answer;
    if (!answer) return;

    quiz.typed = answer;
    const terminalInput = document.querySelector("#terminalInput");
    if (terminalInput) terminalInput.value = answer;
    document
      .querySelector(".quiz__terminal")
      ?.classList.toggle("quiz__terminal--timeout", timeout);
    renderTerminalHighlight();
  }

  function setTyped(value) {
    if (quiz.interactionLocked) return;
    quiz.typed = String(value || "");
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
    completeToken,
    hasInvalidTypedTokens,
    reorderChoice,
    resetQuizState,
    selectedLength: () => quiz.choices.length,
    setTimeoutHandler,
    setTyped,
    showCorrectAnswerInTerminal,
    showVaccineMessage,
    timeoutAndLogAnswer,
  };
})();
