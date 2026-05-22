const LinuxVirusUser = (() => {
  let currentUser = null;
  let isSubmitting = false;
  let ratingRequestId = 0;

  function currentUserId() {
    return currentUser ? currentUser.id : LinuxVirusConfig.get("defaultUserId", 0);
  }

  function updateBadge() {
    const badge = document.querySelector("#userBadge");
    if (!badge) return;

    badge.textContent = currentUser ? "✓" : "?";
    badge.className = currentUser
      ? "minimized__badge minimized__badge--logged-in"
      : "minimized__badge minimized__badge--logged-out";
  }

  async function renderUserScreen() {
    const input = document.querySelector("#userName");
    const label = document.querySelector("#currentUserLabel");
    const loginView = document.querySelector("#loginUserView");
    const loggedInView = document.querySelector("#loggedInUserView");
    if (input) input.value = "";
    if (label) label.textContent = currentUser ? `Logged in: ${currentUser.name}` : "Not logged in";
    clearMessage();
    updateBadge();

    if (loginView) loginView.hidden = Boolean(currentUser);
    if (loggedInView) loggedInView.hidden = !currentUser;

    if (currentUser) {
      await refreshRatingProfile();
    } else {
      renderRatingChart([]);
    }
  }

  function clearMessage() {
    const message = document.querySelector("#userMessage");
    if (!message) return;
    message.textContent = "";
    message.className = "user-message";
  }

  function showMessage(text, ok) {
    const message = document.querySelector("#userMessage");
    if (!message) return;
    message.textContent = text;
    message.className = ok ? "user-message user-message--success" : "user-message user-message--error";
  }

  function saveUser(user) {
    currentUser = {
      id: Number(user.id),
      name: String(user.name),
    };
    renderUserScreen();
  }

  function logout() {
    currentUser = null;
    ratingRequestId += 1;
    renderUserScreen();
  }

  function readName() {
    return document.querySelector("#userName").value.trim();
  }

  function ratingColor(rating) {
    if (rating >= 2800) return { name: "red", color: "#ff4b4b" };
    if (rating >= 2400) return { name: "orange", color: "#ff8c00" };
    if (rating >= 2000) return { name: "yellow", color: "#f6c915" };
    if (rating >= 1600) return { name: "blue", color: "#3078ff" };
    if (rating >= 1200) return { name: "cyan", color: "#22b8cf" };
    if (rating >= 800) return { name: "green", color: "#42b849" };
    if (rating >= 400) return { name: "brown", color: "#9a6a42" };
    return { name: "gray", color: "#9aa4ad" };
  }

  async function refreshRatingProfile() {
    const requestId = ratingRequestId + 1;
    ratingRequestId = requestId;

    const nameEl = document.querySelector("#profileUserName");
    const ratingEl = document.querySelector("#profileRating");
    if (nameEl) {
      nameEl.textContent = currentUser.name;
      nameEl.style.color = ratingColor(0).color;
    }
    if (ratingEl) ratingEl.textContent = "読み込み中";
    renderRatingChart([]);

    try {
      const [ratingData, historyData] = await Promise.all([
        LinuxVirusApi.fetchRating(currentUser.id),
        LinuxVirusApi.fetchRatingHistory(currentUser.id),
      ]);
      if (requestId !== ratingRequestId || !currentUser) return;

      const rating = Math.round(Number(ratingData.rating || 0));
      const color = ratingColor(rating);
      if (nameEl) {
        nameEl.textContent = currentUser.name;
        nameEl.style.color = color.color;
      }
      if (ratingEl) ratingEl.textContent = String(rating);
      renderRatingChart(historyData.ratings || []);
    } catch (error) {
      console.error("Failed to load rating", error);
      if (requestId !== ratingRequestId) return;
      if (ratingEl) ratingEl.textContent = "-";
      renderRatingChart([]);
    }
  }

  function renderRatingChart(rawPoints) {
    const svg = document.querySelector("#ratingChart");
    if (!svg) return;

    const width = 460;
    const height = 190;
    const pad = { top: 10, right: 18, bottom: 26, left: 38 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const maxRating = 3000;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const points = rawPoints
      .map((point) => ({
        date: parseDate(point.date),
        rating: Math.max(0, Math.min(maxRating, Math.round(Number(point.rating || 0)))),
      }))
      .filter((point) => point.date)
      .sort((a, b) => a.date - b.date);

    const xForDate = (date) => {
      const dayMs = 24 * 60 * 60 * 1000;
      const offset = Math.max(0, Math.min(29, Math.round((date - start) / dayMs)));
      return pad.left + (offset / 29) * plotWidth;
    };
    const yForRating = (rating) => pad.top + plotHeight - (rating / maxRating) * plotHeight;

    const bands = [
      { y0: 0, y1: 400, fill: "#4a4f55" },
      { y0: 400, y1: 800, fill: "#79543a" },
      { y0: 800, y1: 1200, fill: "#296f3a" },
      { y0: 1200, y1: 1600, fill: "#146f7a" },
      { y0: 1600, y1: 2000, fill: "#1f4b9e" },
      { y0: 2000, y1: 2400, fill: "#8f7a12" },
      { y0: 2400, y1: 2800, fill: "#a65312" },
      { y0: 2800, y1: 3000, fill: "#9b252d" },
    ];
    const yTicks = [0, 400, 800, 1200, 1600, 2000, 2400, 2800];
    const monthLabels = [0, 10, 20, 29].map((offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      return { offset, text: `${date.getMonth() + 1}/${date.getDate()}` };
    });

    const line = points
      .map((point) => `${xForDate(point.date).toFixed(1)},${yForRating(point.rating).toFixed(1)}`)
      .join(" ");
    const circles = points
      .map((point) => {
        const color = ratingColor(point.rating).color;
        return `<circle cx="${xForDate(point.date).toFixed(1)}" cy="${yForRating(point.rating).toFixed(1)}" r="3.4" fill="${color}" stroke="#f4f7fb" stroke-width="0.8" />`;
      })
      .join("");

    svg.innerHTML = `
      ${bands
        .map((band) => {
          const y = yForRating(band.y1);
          const bandHeight = yForRating(band.y0) - y;
          return `<rect x="${pad.left}" y="${y.toFixed(1)}" width="${plotWidth}" height="${bandHeight.toFixed(1)}" fill="${band.fill}" opacity="0.45" />`;
        })
        .join("")}
      ${yTicks
        .map((tick) => {
          const y = yForRating(tick);
          return `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="#f4f7fb" stroke-opacity="0.18" /><text x="${pad.left - 7}" y="${(y + 4).toFixed(1)}" text-anchor="end">${tick}</text>`;
        })
        .join("")}
      ${monthLabels
        .map((label) => {
          const x = pad.left + (label.offset / 29) * plotWidth;
          return `<line x1="${x.toFixed(1)}" y1="${pad.top}" x2="${x.toFixed(1)}" y2="${height - pad.bottom}" stroke="#f4f7fb" stroke-opacity="0.14" /><text x="${x.toFixed(1)}" y="${height - 7}" text-anchor="middle">${label.text}</text>`;
        })
        .join("")}
      <rect x="${pad.left}" y="${pad.top}" width="${plotWidth}" height="${plotHeight}" fill="none" stroke="#f4f7fb" stroke-opacity="0.32" />
      ${
        points.length > 1
          ? `<polyline points="${line}" fill="none" stroke="#f4f7fb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />`
          : ""
      }
      ${circles}
      ${
        points.length === 0
          ? `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="rating-chart__empty">No rating data</text>`
          : ""
      }
    `;
  }

  function parseDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  async function login() {
    await submitUserAction("ログインしました", "ログインに失敗しました", LinuxVirusApi.loginUser);
  }

  async function create() {
    await submitUserAction("登録しました", "登録に失敗しました", LinuxVirusApi.createUser);
  }

  async function submitUserAction(successText, failureText, action) {
    if (isSubmitting) return;
    const name = readName();
    if (!name) {
      showMessage("ユーザー名を入力してください", false);
      return;
    }

    isSubmitting = true;
    setUserButtonsDisabled(true);
    showMessage("送信中…", true);
    try {
      const user = await action(name);
      saveUser(user);
      showMessage(successText, true);
    } catch (error) {
      console.error(failureText, error);
      const detail = error && error.isNetwork ? "（バックエンドに接続できません）" : "";
      showMessage(`${failureText}${detail}`, false);
    } finally {
      isSubmitting = false;
      setUserButtonsDisabled(false);
    }
  }

  function setUserButtonsDisabled(disabled) {
    for (const action of ["loginUser", "createUser"]) {
      const btn = document.querySelector(`[data-action="${action}"]`);
      if (btn) btn.disabled = disabled;
    }
  }

  return {
    create,
    currentUserId,
    login,
    logout,
    renderUserScreen,
    updateBadge,
  };
})();
