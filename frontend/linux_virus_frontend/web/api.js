const LinuxVirusApi = (() => {
  const LONG_TIMEOUT_MS = 75000;

  class ApiError extends Error {
    constructor(message, { status = 0, cause = null } = {}) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.isNetwork = status === 0;
      if (cause) this.cause = cause;
    }
  }

  async function request(path, options = {}) {
    const { timeoutMs = LinuxVirusConfig.get("apiTimeoutMs"), ...init } = options;
    const baseUrl = LinuxVirusConfig.get("apiBaseUrl");
    if (!baseUrl) {
      throw new ApiError("API URL is not configured", { status: 0 });
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ApiError(`HTTP ${response.status}`, { status: response.status });
      }
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const message =
        error && error.name === "AbortError"
          ? "リクエストがタイムアウトしました"
          : "バックエンドに接続できません";
      throw new ApiError(message, { status: 0, cause: error });
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function fetchQuestion() {
    const response = await request("/questions/random", { timeoutMs: LONG_TIMEOUT_MS });
    return response.json();
  }

  async function fetchVirusQuestion() {
    const response = await request("/virus", { timeoutMs: LONG_TIMEOUT_MS });
    return response.json();
  }

  async function pingHealth() {
    try {
      await request("/health", { timeoutMs: 10000 });
    } catch (_) {
      // ignore: warmup ping is best-effort
    }
  }

  async function checkAnswer(questionId, selectedChoices) {
    const params = new URLSearchParams({ id: String(questionId) });
    for (const choice of selectedChoices) {
      params.append("answer", String(choice.id));
    }
    const response = await request(`/questions/check?${params}`);
    const data = await response.json();
    return Boolean(data.is_correct);
  }

  async function loginUser(name) {
    return postUser("/users/login", name);
  }

  async function createUser(name) {
    return postUser("/users", name);
  }

  async function postUser(path, name) {
    const response = await request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
      timeoutMs: LONG_TIMEOUT_MS,
    });
    return response.json();
  }

  async function submitAnswerLog(questionId, isCorrect, userId) {
    await request("/answer_logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        question_id: questionId,
        is_correct: isCorrect,
      }),
    });
  }

  async function decreaseVirusQuestion(questionId) {
    await request("/virus/decrease", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId }),
    });
  }

  async function increaseVirusQuestion(questionId) {
    await request("/virus/increase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId }),
    });
  }

  return {
    ApiError,
    checkAnswer,
    createUser,
    fetchQuestion,
    fetchVirusQuestion,
    increaseVirusQuestion,
    loginUser,
    decreaseVirusQuestion,
    pingHealth,
    submitAnswerLog,
  };
})();
