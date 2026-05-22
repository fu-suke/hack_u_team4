const LinuxVirusDrag = (() => {
  let didDrag = false;
  let isActive = false;
  let activeDrag = null;
  let suppressTokenClickUntil = 0;
  let installed = false;

  function isDragging() {
    return isActive;
  }

  function isClickSuppressed() {
    return didDrag || Date.now() < suppressTokenClickUntil;
  }

  function answerDropIndex(event) {
    const targetToken = event.target.closest("#answer .token");
    if (!targetToken) return LinuxVirusQuiz.selectedLength();
    const rect = targetToken.getBoundingClientRect();
    const index = Number(targetToken.dataset.index);
    const afterTarget = event.clientX > rect.left + rect.width / 2;
    return index + (afterTarget ? 1 : 0);
  }

  function getDragPayload(event) {
    if (activeDrag) return activeDrag;
    try {
      return JSON.parse(event.dataTransfer.getData("application/x-linux-virus-choice"));
    } catch (_) {
      return null;
    }
  }

  function clearDragState(suppressClick = true) {
    for (const token of document.querySelectorAll(".token--dragging")) {
      token.classList.remove("token--dragging");
    }
    for (const dropZone of document.querySelectorAll(".dragover")) {
      dropZone.classList.remove("dragover");
    }

    activeDrag = null;
    isActive = false;

    if (!suppressClick) return;
    didDrag = true;
    suppressTokenClickUntil = Date.now() + 300;
    window.setTimeout(() => {
      if (Date.now() >= suppressTokenClickUntil) didDrag = false;
    }, 300);
  }

  function install() {
    if (installed) return;
    installed = true;
    document.addEventListener("dragstart", (event) => {
      const token = event.target.closest(".token");
      if (!token) return;
      if (LinuxVirusQuiz.isInteractionLocked()) {
        event.preventDefault();
        return;
      }

      didDrag = true;
      isActive = true;
      activeDrag = {
        choice: LinuxVirusQuiz.choiceFromDataset(token.dataset),
        sourceAction: token.dataset.action,
        sourceIndex: Number(token.dataset.index),
      };
      event.dataTransfer.clearData();
      event.dataTransfer.setData("text/plain", "");
      event.dataTransfer.setData(
        "application/x-linux-virus-choice",
        JSON.stringify(activeDrag),
      );
      event.dataTransfer.effectAllowed = "move";
      token.classList.add("token--dragging");
    });

    document.addEventListener("dragend", () => {
      clearDragState();
      LinuxVirusQuiz.renderQuiz(true);
    });

    document.addEventListener("dragover", (event) => {
      const dropZone = event.target.closest("#answer, #tokens");
      if (LinuxVirusQuiz.isInteractionLocked()) return;
      if (!activeDrag) return;

      event.preventDefault();
      if (!dropZone) return;
      event.dataTransfer.dropEffect = "move";
      dropZone.classList.add("dragover");
    });

    document.addEventListener("dragleave", (event) => {
      const dropZone = event.target.closest("#answer, #tokens");
      if (!dropZone || (event.relatedTarget && dropZone.contains(event.relatedTarget))) return;
      dropZone.classList.remove("dragover");
    });

    document.addEventListener("drop", (event) => {
      if (activeDrag) event.preventDefault();
      if (LinuxVirusQuiz.isInteractionLocked()) {
        clearDragState();
        return;
      }
      const answer = event.target.closest("#answer");
      const tokens = event.target.closest("#tokens");
      if (!answer && !tokens) {
        clearDragState();
        return;
      }

      const payload = getDragPayload(event);
      const dropIndex = answer ? answerDropIndex(event) : LinuxVirusQuiz.selectedLength();
      clearDragState();
      if (!payload) return;
      if (!LinuxVirusQuiz.hasChoiceId(payload.choice.id)) {
        LinuxVirusQuiz.renderQuiz(true);
        return;
      }

      if (answer && payload.sourceAction === "selectToken") {
        LinuxVirusQuiz.moveTokenToAnswer(payload.choice, dropIndex);
        return;
      }
      if (answer && payload.sourceAction === "unselectToken") {
        LinuxVirusQuiz.reorderAnswerToken(payload.sourceIndex, dropIndex);
        return;
      }
      if (tokens && payload.sourceAction === "unselectToken") {
        LinuxVirusQuiz.removeTokenFromAnswer(payload.choice, payload.sourceIndex);
      }
    });
  }

  return {
    install,
    isClickSuppressed,
    isDragging,
  };
})();
