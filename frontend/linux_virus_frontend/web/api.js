const LinuxVirusApi = (() => {
  const BASE_URL = "http://127.0.0.1:8000";

  async function fetchQuestion() {
    const response = await fetch(`${BASE_URL}/questions/random`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function checkAnswer(questionId, selectedChoices) {
    const params = new URLSearchParams({ id: String(questionId) });
    for (const choice of selectedChoices) {
      params.append("answer", String(choice.id));
    }

    const response = await fetch(`${BASE_URL}/questions/check?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function submitAnswerLog(questionId, isCorrect, userId) {
    const response = await fetch(`${BASE_URL}/answer_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        question_id: questionId,
        is_correct: isCorrect,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  return {
    checkAnswer,
    createUser,
    fetchQuestion,
    loginUser,
    submitAnswerLog,
  };
})();
