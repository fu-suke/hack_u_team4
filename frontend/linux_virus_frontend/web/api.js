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
    const rawBaseUrl = LinuxVirusConfig.get("apiBaseUrl");
    if (!rawBaseUrl) {
      throw new ApiError("API URL is not configured", { status: 0 });
    }
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
      const response = await fetch(url, {
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

  async function fetchPersonalizedQuestion(userId) {
    const params = new URLSearchParams({ user_id: String(userId) });
    const response = await request(`/questions/personalize?${params}`, {
      timeoutMs: LONG_TIMEOUT_MS,
    });
    return response.json();
  }

  async function fetchRating(userId) {
    const params = new URLSearchParams({ user_id: String(userId) });
    const response = await request(`/rating?${params}`);
    return response.json();
  }

  async function fetchRatingHistory(userId) {
    const params = new URLSearchParams({ user_id: String(userId) });
    const response = await request(`/rating/history?${params}`);
    return response.json();
  }

  async function pingHealth() {
    try {
      await request("/health", { timeoutMs: 10000 });
    } catch (_) {
      // ignore: warmup ping is best-effort
    }
  }

  async function checkAnswer(questionId, choices) {
    const params = new URLSearchParams({ id: String(questionId) });
    for (const choice of choices) {
      params.append("answer", String(choice.id));
    }
    const response = await request(`/questions/check?${params}`);
    const data = await response.json();
    return Boolean(data.is_correct);
  }

  async function loginUser(name, password) {
    return postUser("/users/login", name, password);
  }

  async function createUser(name, password) {
    return postUser("/users", name, password);
  }

  async function postUser(path, name, password) {
    const response = await request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
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

  async function fetchStreak(userId) {
    const response = await request(`/answer_logs/streak?user_id=${userId}`);
    return response.json();
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
    fetchPersonalizedQuestion,
    fetchQuestion,
    fetchRating,
    fetchRatingHistory,
    fetchStreak,
    fetchVirusQuestion,
    increaseVirusQuestion,
    loginUser,
    decreaseVirusQuestion,
    pingHealth,
    submitAnswerLog,
  };
})();
