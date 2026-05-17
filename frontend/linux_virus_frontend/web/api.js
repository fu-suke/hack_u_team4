const LinuxVirusApi = (() => {
  const BASE_URL = "http://127.0.0.1:8000";
  const DEFAULT_USER_ID = 0;

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

  async function submitAnswerLog(questionId, isCorrect) {
    const response = await fetch(`${BASE_URL}/answer_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: DEFAULT_USER_ID,
        question_id: questionId,
        is_correct: isCorrect,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }

  return {
    checkAnswer,
    fetchQuestion,
    submitAnswerLog,
  };
})();
