const LinuxVirusTimer = (() => {
  let lastFlipDigits = "";

  function updateFlipTimer(timerText, timerMode = "idle") {
    const timer = document.querySelector("#flipTimer");
    const mascot = document.querySelector("#minimizedMascot");
    const isSleeping = timerMode === "sleep";
    if (timer) timer.hidden = !isSleeping;
    if (mascot) mascot.hidden = isSleeping;
    if (!isSleeping) {
      lastFlipDigits = "";
      return;
    }

    const safeText = typeof timerText === "string" ? timerText : "";
    const match = safeText.match(/(\d+)\s*s?\b/);
    const parsed = match ? parseInt(match[1], 10) : NaN;
    const totalSeconds = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    const digits = mm + ss;

    for (let i = 0; i < 4; i++) {
      const card = document.querySelector(`#fd${i}`);
      if (!card) continue;
      const newDigit = digits[i];
      if (lastFlipDigits && lastFlipDigits[i] !== newDigit) {
        card.classList.remove("flipping");
        void card.offsetWidth;
        card.classList.add("flipping");
      }
      card.textContent = newDigit;
      card.classList.toggle("flip-card--sleep", true);
    }

    lastFlipDigits = digits;
  }

  return { updateFlipTimer };
})();
