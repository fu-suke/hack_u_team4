const LinuxVirusQuiz = (() => {
  const ANSWER_TIME_LIMIT_MS = 60000;
  let quizVersion = 0;
  let renderedQuizVersion = -1;
  let isLoading = false;
  let loadRequestId = 0;
  let isChecking = false;
  let countdownTimer = null;
  let countdownDeadline = 0;
  let timeoutHandler = null;
  let latestExplanationHtml = "";

  function emptyQuizState(mode = "normal", prompt = "問題を読み込み中…") {
    return {
      id: null,
      difficulty: 1,
      prompt,
      tutorial: "",
      sample_output: "",
      correct_answer: "",
      choices: [],
      typed: "",
      answers: [],
      mode,
      answerLogged: false,
      interactionLocked: false,
      preAnswerRating: null,
      lastStreak: 0,
      lastRatingChange: null,
    };
  }

  const quiz = emptyQuizState();

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

  function createTokenButton(choice, className, index = "", { dimmed = false } = {}) {
    const button = document.createElement("button");
    button.className = dimmed ? `${className} token--used` : className;
    button.type = "button";
    button.textContent = choice.label;
    const interactive = !quiz.interactionLocked && !dimmed;
    button.draggable = interactive;
    button.disabled = !interactive;
    button.dataset.id = String(choice.id);
    button.dataset.label = choice.label;
    button.dataset.index = String(index);
    return button;
  }

  function setTimeoutHandler(handler) {
    timeoutHandler = typeof handler === "function" ? handler : null;
  }

  function setExplanationHtml(html) {
    latestExplanationHtml = String(html || "");
  }

  function explanationHtml() {
    return latestExplanationHtml;
  }

  function setQuizLabel(content, ...classes) {
    const labelEl = document.querySelector(".quiz__label");
    if (!labelEl) return;
    labelEl.replaceChildren();
    if (typeof content === "string") {
      labelEl.textContent = content;
    } else {
      labelEl.append(content);
    }
    labelEl.classList.remove(
      "quiz__label--correct",
      "quiz__label--timeout",
      "quiz__label--vaccine",
    );
    labelEl.classList.add(...classes);
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
    quiz.typed = "";
    const terminalInput = document.querySelector("#terminalInput");
    if (terminalInput) {
      terminalInput.value = "";
      terminalInput.disabled = false;
    }
    document.querySelector(".quiz__terminal")?.classList.remove("quiz__terminal--timeout");
    quiz.interactionLocked = false;
    quizVersion++;
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
    setExplanationHtml("");
    if (bottom) bottom.className = "quiz-bottom";
    const closeExplanation = document.querySelector("#closeExplanation");
    if (closeExplanation) closeExplanation.hidden = true;
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
    const message = document.createDocumentFragment();
    message.append("ワクチンを使用!");
    message.append(document.createElement("br"));
    message.append("問題をスキップしました");
    setQuizLabel(message, "quiz__label--vaccine");
    const streakEl = document.querySelector("#quizStreak");
    if (streakEl) streakEl.hidden = true;
    setActionsDisabled(true);
    for (const button of document.querySelectorAll(".quiz__vaccine")) {
      button.disabled = true;
    }
  }

  async function fetchQuestionByMode(mode, triggerCommand = null) {
    if (mode === "virus") {
      return LinuxVirusApi.fetchVirusQuestion();
    }
    if (triggerCommand) {
      try {
        return await LinuxVirusApi.fetchQuestionByCommand(triggerCommand);
      } catch (error) {
        console.warn("Command question fetch failed, falling back to normal", error);
      }
    }
    const userId = LinuxVirusUser.currentUserId();
    const personalizeEnabled =
      typeof LinuxVirusSettings === "undefined"
        ? true
        : LinuxVirusSettings.isPersonalizeEnabled();
    if (userId && personalizeEnabled) {
      try {
        return await LinuxVirusApi.fetchPersonalizedQuestion(userId);
      } catch (error) {
        console.warn("Personalize fetch failed, falling back to random", error);
        return LinuxVirusApi.fetchQuestion();
      }
    }
    return LinuxVirusApi.fetchQuestion();
  }

  async function loadQuestion(mode = "normal", { force = false, triggerCommand = null } = {}) {
    if (isLoading && !force) return;
    const requestId = loadRequestId + 1;
    loadRequestId = requestId;
    stopCountdown();
    isLoading = true;
    Object.assign(quiz, emptyQuizState(mode));
    const promptEl = document.querySelector("#quizPrompt");
    const quizEl = document.querySelector(".quiz");
    if (promptEl) promptEl.textContent = "問題を読み込み中…";
    setQuizLabel("ターミナルにコマンドを入力しよう");
    const streakEl = document.querySelector("#quizStreak");
    if (streakEl) streakEl.hidden = true;
    const tokensContainer = document.querySelector("#tokens");
    if (tokensContainer) tokensContainer.hidden = false;
    if (quizEl) quizEl.setAttribute("aria-busy", "true");
    setActionsDisabled(true);
    document.querySelector("#retryQuiz")?.setAttribute("hidden", "");
    resetQuizState();
    renderQuiz(true);

    try {
      const data = await fetchQuestionByMode(mode, triggerCommand);
      if (requestId !== loadRequestId) return;
      Object.assign(quiz, normalizeQuestion(data, mode), {
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
          if (requestId !== loadRequestId) return;
          quiz.preAnswerRating = Math.round(Number(ratingData.rating || 0));
        } catch (_) {
          quiz.preAnswerRating = null;
        }
        try {
          const streakData = await LinuxVirusApi.fetchStreak(userId);
          if (requestId !== loadRequestId) return;
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
      if (requestId !== loadRequestId) return;
      console.error("Failed to load question", error);
      Object.assign(quiz, emptyQuizState(mode, "問題を読み込めませんでした。"));
      if (promptEl) promptEl.textContent = "問題を読み込めませんでした。";
      stopCountdown();
      resetQuizState();
      renderQuiz(true);
      document.querySelector("#retryQuiz")?.removeAttribute("hidden");
    } finally {
      if (requestId !== loadRequestId) return;
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
    if (!force && typeof LinuxVirusDrag !== "undefined" && LinuxVirusDrag.isDragging()) return;
    if (!force && renderedQuizVersion === quizVersion) return;
    renderedQuizVersion = quizVersion;

    const promptEl = document.querySelector("#quizPrompt");
    const tokensEl = document.querySelector("#tokens");
    if (!tokensEl) return;

    if (promptEl) promptEl.innerHTML = LinuxVirusMarkdown.render(quiz.prompt);
    renderTerminalHighlight();
    renderVaccines();
    updateMascot();

    const tokensFrag = document.createDocumentFragment();
    const used = usedChoiceIds();
    for (const [index, choice] of quiz.choices.entries()) {
      tokensFrag.appendChild(
        createTokenButton(choice, "token", index, { dimmed: used.has(choice.id) }),
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

  function buildAnswerResult(correct, ratingChange, extra = {}) {
    return {
      correct,
      command: quiz.typed.trim(),
      tutorial: quiz.tutorial,
      sample_output: quiz.sample_output,
      ratingChange: ratingChange ?? quiz.lastRatingChange,
      streak: quiz.lastStreak ?? 0,
      ...extra,
    };
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
      return buildAnswerResult(correct, ratingChange);
    } finally {
      isChecking = false;
      setActionsDisabled(false);
    }
  }

  async function updateUserProgress(correct) {
    let ratingChange = null;
    const userId = LinuxVirusUser.currentUserId();
    if (!userId) return ratingChange;

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
    return ratingChange;
  }

  function updateVirusQuestionWeight(correct) {
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

  async function logAnswerResult(correct) {
    if (quiz.answerLogged) return null;

    quiz.answerLogged = true;
    const ratingChange = await updateUserProgress(correct);
    updateVirusQuestionWeight(correct);
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
      return buildAnswerResult(false, ratingChange, {
        timedOut: true,
        correct_answer: quiz.correct_answer,
      });
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
    explanationHtml,
    hasChoiceId,
    isInteractionLocked,
    isBusy,
    isVirusMode,
    loadQuestion,
    lockInteractions,
    renderQuiz,
    renderVaccines,
    completeToken,
    hasInvalidTypedTokens,
    reorderChoice,
    resetQuizState,
    choiceCount: () => quiz.choices.length,
    setQuizLabel,
    setTimeoutHandler,
    setExplanationHtml,
    setTyped,
    showCorrectAnswerInTerminal,
    showVaccineMessage,
    timeoutAndLogAnswer,
  };
})();
