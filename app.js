const STORAGE_KEY = "beach-event-checklist-v1";

function getCheckboxes() {
  return Array.from(document.querySelectorAll('input[type="checkbox"][id]'));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateCheckboxes() {
  const state = loadState();
  getCheckboxes().forEach((checkbox) => {
    checkbox.checked = Boolean(state[checkbox.id]);
  });
}

function bindCheckboxPersistence() {
  const state = loadState();
  getCheckboxes().forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state[checkbox.id] = checkbox.checked;
      saveState(state);
    });
  });
}

function bindResetButton() {
  const resetButton = document.getElementById("reset-checklist");
  if (!resetButton) {
    return;
  }

  resetButton.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    getCheckboxes().forEach((checkbox) => {
      checkbox.checked = false;
    });
  });
}

hydrateCheckboxes();
bindCheckboxPersistence();
bindResetButton();
