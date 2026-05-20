const LinuxVirusUser = (() => {
  let currentUser = null;
  let isSubmitting = false;

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

  function renderUserScreen() {
    const input = document.querySelector("#userName");
    const label = document.querySelector("#currentUserLabel");
    if (input) input.value = "";
    if (label) label.textContent = currentUser ? `Logged in: ${currentUser.name}` : "Not logged in";
    clearMessage();
    updateBadge();
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

  function readName() {
    return document.querySelector("#userName").value.trim();
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
      window.setTimeout(() => {
        window.webkit.messageHandlers.resident.postMessage({ action: "minimize" });
      }, 1000);
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
    renderUserScreen,
    updateBadge,
  };
})();
