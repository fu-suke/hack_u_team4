const LinuxVirusTimer = (() => {
  let lastFlipDigits = "";

  function updateFlipTimer(timerText) {
    const match = timerText.match(/(\d+)s?$/);
    const totalSeconds = match ? parseInt(match[1], 10) : 0;
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
    }

    lastFlipDigits = digits;
  }

  return { updateFlipTimer };
})();
