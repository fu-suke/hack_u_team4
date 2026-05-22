const LinuxVirusStorage = (() => {
  const SETTINGS_KEY = "linuxVirus.settings";
  const USER_KEY = "linuxVirus.user";
  const VACCINE_KEY = "linuxVirus.vaccine";
  const DAILY_VACCINE_COUNT = 3;
  const RESET_HOUR = 4;

  function readJson(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Failed to read local storage: ${key}`, error);
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to write local storage: ${key}`, error);
    }
  }

  function remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove local storage: ${key}`, error);
    }
  }

  function currentVaccinePeriodKey(now = new Date()) {
    const period = new Date(now);
    if (period.getHours() < RESET_HOUR) {
      period.setDate(period.getDate() - 1);
    }
    period.setHours(0, 0, 0, 0);
    const year = period.getFullYear();
    const month = String(period.getMonth() + 1).padStart(2, "0");
    const day = String(period.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function normalizeVaccineState(raw = readJson(VACCINE_KEY, null)) {
    const periodKey = currentVaccinePeriodKey();
    if (!raw || raw.periodKey !== periodKey) {
      return { periodKey, remaining: DAILY_VACCINE_COUNT };
    }
    const remaining = Math.max(0, Math.min(DAILY_VACCINE_COUNT, Number(raw.remaining) || 0));
    return { periodKey, remaining };
  }

  function readVaccineState() {
    const state = normalizeVaccineState();
    writeJson(VACCINE_KEY, state);
    return state;
  }

  function useVaccine() {
    const state = readVaccineState();
    if (state.remaining <= 0) return { ...state, used: false };
    const next = { periodKey: state.periodKey, remaining: state.remaining - 1 };
    writeJson(VACCINE_KEY, next);
    return { ...next, used: true };
  }

  function resetVaccines() {
    const next = {
      periodKey: currentVaccinePeriodKey(),
      remaining: DAILY_VACCINE_COUNT,
    };
    writeJson(VACCINE_KEY, next);
    return next;
  }

  function readSettings() {
    return readJson(SETTINGS_KEY, null);
  }

  function saveSettings(settings) {
    writeJson(SETTINGS_KEY, settings);
  }

  function readUser() {
    return readJson(USER_KEY, null);
  }

  function saveUser(user) {
    writeJson(USER_KEY, user);
  }

  function clearUser() {
    remove(USER_KEY);
  }

  return {
    readSettings,
    readUser,
    readVaccineState,
    saveSettings,
    saveUser,
    clearUser,
    useVaccine,
    resetVaccines,
  };
})();
