const LinuxVirusSound = (() => {
  const BASE = "../sound/";
  const SOURCES = {
    click: "click.mp3",
    cancel: "cancel.mp3",
    correct: "correct.mp3",
    incorrect: "incorrect.mp3",
    normalQuestion: "normal_question.mp3",
    virusQuestion: "virus_question.mp3",
  };

  const cache = {};
  for (const [name, file] of Object.entries(SOURCES)) {
    const audio = new Audio(BASE + file);
    audio.preload = "auto";
    cache[name] = audio;
  }

  function play(name) {
    const audio = cache[name];
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const result = audio.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch (_err) {
      // autoplay restrictions etc. — silently ignore
    }
  }

  return { play };
})();
