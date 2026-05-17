const LinuxVirusUser = (() => {
  const DEFAULT_USER_ID = 0;

  let currentUser = null;

  function currentUserId() {
    return currentUser ? currentUser.id : DEFAULT_USER_ID;
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
    const name = readName();
    if (!name) {
      showMessage("ユーザー名を入力してください", false);
      return;
    }

    try {
      const user = await action(name);
      saveUser(user);
      showMessage(successText, true);
      window.setTimeout(() => {
        window.webkit.messageHandlers.resident.postMessage({ action: "minimize" });
      }, 1000);
    } catch (error) {
      console.error(failureText, error);
      const input = document.querySelector("#userName");
      if (input) input.value = "";
      showMessage(failureText, false);
      window.setTimeout(clearMessage, 1000);
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
