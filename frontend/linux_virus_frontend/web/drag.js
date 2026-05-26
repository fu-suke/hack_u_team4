const LinuxVirusDrag = (() => {
  let isActive = false;
  let activeDrag = null;
  let installed = false;

  function isDragging() {
    return isActive;
  }

  function tokensDropIndex(event) {
    const targetToken = event.target.closest("#tokens .token");
    if (!targetToken) return LinuxVirusQuiz.choiceCount();
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

  function clearDragState() {
    for (const token of document.querySelectorAll(".token--dragging")) {
      token.classList.remove("token--dragging");
    }
    for (const dropZone of document.querySelectorAll(".dragover")) {
      dropZone.classList.remove("dragover");
    }

    activeDrag = null;
    isActive = false;
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

      isActive = true;
      activeDrag = {
        choice: LinuxVirusQuiz.choiceFromDataset(token.dataset),
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
      const dropZone = event.target.closest("#tokens");
      if (LinuxVirusQuiz.isInteractionLocked()) return;
      if (!activeDrag) return;

      event.preventDefault();
      if (!dropZone) return;
      event.dataTransfer.dropEffect = "move";
      dropZone.classList.add("dragover");
    });

    document.addEventListener("dragleave", (event) => {
      const dropZone = event.target.closest("#tokens");
      if (!dropZone || (event.relatedTarget && dropZone.contains(event.relatedTarget))) return;
      dropZone.classList.remove("dragover");
    });

    document.addEventListener("drop", (event) => {
      if (activeDrag) event.preventDefault();
      if (LinuxVirusQuiz.isInteractionLocked()) {
        clearDragState();
        return;
      }
      const tokens = event.target.closest("#tokens");
      if (!tokens) {
        clearDragState();
        return;
      }

      const payload = getDragPayload(event);
      const dropIndex = tokensDropIndex(event);
      clearDragState();
      if (!payload) return;
      if (!LinuxVirusQuiz.hasChoiceId(payload.choice.id)) {
        LinuxVirusQuiz.renderQuiz(true);
        return;
      }
      LinuxVirusQuiz.reorderChoice(payload.sourceIndex, dropIndex);
    });
  }

  return {
    install,
    isDragging,
  };
})();
