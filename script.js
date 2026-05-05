"use strict";

/**
 * Smart Productivity Dashboard
 * Modular, reusable logic with localStorage persistence.
 */

const STORAGE_KEYS = {
  theme: "spd_theme",
  todos: "spd_todos",
  planner: "spd_planner",
  city: "spd_weather_city",
};

const APP = {
  todos: [],
  todoFilter: "all",
  timer: {
    focusDuration: 25 * 60,
    breakDuration: 5 * 60,
    remaining: 25 * 60,
    isRunning: false,
    isFocus: true,
    sessionCount: 1,
    intervalId: null,
  },
  planner: {
    morning: "",
    afternoon: "",
    evening: "",
  },
};

const QUOTES = [
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "Small progress is still progress.", author: "Unknown" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
];

const OPEN_WEATHER_API_KEY = "YOUR_OPENWEATHER_API_KEY";

const el = {
  themeToggle: document.getElementById("themeToggle"),
  themeLabel: document.getElementById("themeLabel"),
  liveClock: document.getElementById("liveClock"),

  todoForm: document.getElementById("todoForm"),
  todoInput: document.getElementById("todoInput"),
  todoList: document.getElementById("todoList"),
  todoFilters: document.getElementById("todoFilters"),
  todoTemplate: document.getElementById("todoItemTemplate"),

  timerValue: document.getElementById("timerValue"),
  ringProgress: document.getElementById("ringProgress"),
  startPauseBtn: document.getElementById("startPauseBtn"),
  resetTimerBtn: document.getElementById("resetTimerBtn"),
  sessionType: document.getElementById("sessionType"),
  sessionCount: document.getElementById("sessionCount"),

  weatherForm: document.getElementById("weatherForm"),
  cityInput: document.getElementById("cityInput"),
  autoDetectWeatherBtn: document.getElementById("autoDetectWeatherBtn"),
  weatherContent: document.getElementById("weatherContent"),

  quoteText: document.getElementById("quoteText"),
  quoteAuthor: document.getElementById("quoteAuthor"),
  newQuoteBtn: document.getElementById("newQuoteBtn"),

  morningPlan: document.getElementById("morningPlan"),
  afternoonPlan: document.getElementById("afternoonPlan"),
  eveningPlan: document.getElementById("eveningPlan"),
};

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadStorage(key, fallback) {
  return safeParse(localStorage.getItem(key), fallback);
}

function initTheme() {
  const savedTheme = loadStorage(STORAGE_KEYS.theme, "dark");
  document.body.setAttribute("data-theme", savedTheme);
  el.themeLabel.textContent = savedTheme === "dark" ? "Light Mode" : "Dark Mode";

  el.themeToggle.addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    saveStorage(STORAGE_KEYS.theme, next);
    el.themeLabel.textContent = next === "dark" ? "Light Mode" : "Dark Mode";
  });
}

function startClock() {
  const render = () => {
    const now = new Date();
    el.liveClock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };
  render();
  setInterval(render, 1000);
}

function initTodos() {
  APP.todos = loadStorage(STORAGE_KEYS.todos, []);
  renderTodos();

  el.todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = el.todoInput.value.trim();
    if (!title) return;

    APP.todos.unshift({
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: Date.now(),
    });

    saveStorage(STORAGE_KEYS.todos, APP.todos);
    el.todoInput.value = "";
    renderTodos();
  });

  el.todoFilters.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-filter]");
    if (!btn) return;
    APP.todoFilter = btn.dataset.filter;

    [...el.todoFilters.children].forEach((child) => child.classList.remove("active"));
    btn.classList.add("active");
    renderTodos();
  });

  el.todoList.addEventListener("click", (event) => {
    const taskRow = event.target.closest(".todo-item");
    if (!taskRow) return;
    const taskId = taskRow.dataset.id;

    if (event.target.classList.contains("icon-btn")) {
      APP.todos = APP.todos.filter((task) => task.id !== taskId);
      saveStorage(STORAGE_KEYS.todos, APP.todos);
      renderTodos();
      return;
    }
  });

  el.todoList.addEventListener("change", (event) => {
    if (!event.target.classList.contains("todo-check")) return;
    const taskRow = event.target.closest(".todo-item");
    if (!taskRow) return;
    const taskId = taskRow.dataset.id;
    const task = APP.todos.find((item) => item.id === taskId);
    if (!task) return;
    task.completed = event.target.checked;
    saveStorage(STORAGE_KEYS.todos, APP.todos);
    renderTodos();
  });
}

function getFilteredTodos() {
  if (APP.todoFilter === "active") {
    return APP.todos.filter((task) => !task.completed);
  }
  if (APP.todoFilter === "completed") {
    return APP.todos.filter((task) => task.completed);
  }
  return APP.todos;
}

function renderTodos() {
  const filtered = getFilteredTodos();
  el.todoList.innerHTML = "";

  if (!filtered.length) {
    el.todoList.innerHTML = '<li class="muted">No tasks in this view.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((task) => {
    const node = el.todoTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;

    const checkbox = node.querySelector(".todo-check");
    const title = node.querySelector(".todo-title");
    checkbox.checked = task.completed;
    title.textContent = task.title;
    title.classList.toggle("completed", task.completed);

    fragment.appendChild(node);
  });

  el.todoList.appendChild(fragment);
}

function initPomodoro() {
  renderTimer();

  el.startPauseBtn.addEventListener("click", () => {
    APP.timer.isRunning ? pauseTimer() : startTimer();
  });

  el.resetTimerBtn.addEventListener("click", resetTimer);
}

function startTimer() {
  APP.timer.isRunning = true;
  el.startPauseBtn.textContent = "Pause";
  APP.timer.intervalId = setInterval(() => {
    APP.timer.remaining -= 1;
    if (APP.timer.remaining <= 0) {
      onSessionEnd();
      return;
    }
    renderTimer();
  }, 1000);
}

function pauseTimer() {
  APP.timer.isRunning = false;
  el.startPauseBtn.textContent = "Start";
  clearInterval(APP.timer.intervalId);
}

function resetTimer() {
  pauseTimer();
  APP.timer.isFocus = true;
  APP.timer.sessionCount = 1;
  APP.timer.remaining = APP.timer.focusDuration;
  renderTimer();
}

function onSessionEnd() {
  pauseTimer();

  const endedType = APP.timer.isFocus ? "Focus" : "Break";
  showNotification(`${endedType} session complete!`);

  if (APP.timer.isFocus) {
    APP.timer.isFocus = false;
    APP.timer.remaining = APP.timer.breakDuration;
  } else {
    APP.timer.isFocus = true;
    APP.timer.sessionCount += 1;
    APP.timer.remaining = APP.timer.focusDuration;
  }

  renderTimer();
}

function formatSeconds(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function renderTimer() {
  const total = APP.timer.isFocus ? APP.timer.focusDuration : APP.timer.breakDuration;
  const percent = APP.timer.remaining / total;
  const circumference = 2 * Math.PI * 96;
  const dashOffset = circumference * (1 - percent);

  el.timerValue.textContent = formatSeconds(APP.timer.remaining);
  el.ringProgress.style.strokeDasharray = String(circumference);
  el.ringProgress.style.strokeDashoffset = String(dashOffset);
  el.sessionType.textContent = APP.timer.isFocus ? "Focus Session" : "Break Session";
  el.sessionCount.textContent = `Session #${APP.timer.sessionCount}`;
}

function showNotification(message) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(message);
    return;
  }

  if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(message);
      }
    });
  }
}

function initWeather() {
  const savedCity = loadStorage(STORAGE_KEYS.city, "");
  if (savedCity) {
    el.cityInput.value = savedCity;
    fetchWeatherByCity(savedCity);
  }

  el.weatherForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const city = el.cityInput.value.trim();
    if (!city) return;
    saveStorage(STORAGE_KEYS.city, city);
    fetchWeatherByCity(city);
  });

  el.autoDetectWeatherBtn.addEventListener("click", autoDetectWeather);
}

async function fetchWeatherByCity(city) {
  setWeatherLoading(`Loading weather for ${city}...`);

  try {
    if (OPEN_WEATHER_API_KEY === "YOUR_OPENWEATHER_API_KEY") {
      throw new Error("Set your OpenWeather API key in script.js to enable weather.");
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
      )}&appid=${OPEN_WEATHER_API_KEY}&units=metric`
    );
    if (!response.ok) throw new Error("City not found or weather API unavailable.");
    const data = await response.json();
    renderWeatherData(data);
  } catch (error) {
    renderWeatherError(error.message);
  }
}

function autoDetectWeather() {
  setWeatherLoading("Detecting your location...");

  if (!navigator.geolocation) {
    renderWeatherError("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      await fetchWeatherByCoords(latitude, longitude);
    },
    () => {
      renderWeatherError("Location access denied. Please search by city.");
    },
    { timeout: 10000 }
  );
}

async function fetchWeatherByCoords(latitude, longitude) {
  try {
    if (OPEN_WEATHER_API_KEY === "YOUR_OPENWEATHER_API_KEY") {
      throw new Error("Set your OpenWeather API key in script.js to enable weather.");
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPEN_WEATHER_API_KEY}&units=metric`
    );
    if (!response.ok) throw new Error("Weather service is unavailable right now.");
    const data = await response.json();
    renderWeatherData(data);
  } catch (error) {
    renderWeatherError(error.message);
  }
}

function renderWeatherData(data) {
  const city = data.name || "Unknown City";
  const temp = Math.round(data.main?.temp);
  const condition = data.weather?.[0]?.main || "Unknown";
  const iconCode = data.weather?.[0]?.icon || "01d";
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;

  el.weatherContent.innerHTML = `
    <div class="weather-row">
      <div>
        <h3>${city}</h3>
        <p class="muted">${condition}</p>
      </div>
      <div class="weather-temp">${Number.isFinite(temp) ? temp : "--"}&deg;C</div>
      <img src="${iconUrl}" alt="${condition} icon" width="64" height="64" />
    </div>
  `;
}

function setWeatherLoading(message) {
  el.weatherContent.innerHTML = `<p class="muted">${message}</p>`;
}

function renderWeatherError(message) {
  el.weatherContent.innerHTML = `<p class="muted">Could not load weather: ${message}</p>`;
}

function initQuotes() {
  setRandomQuote();
  el.newQuoteBtn.addEventListener("click", setRandomQuote);
}

function setRandomQuote() {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  el.quoteText.textContent = `"${quote.text}"`;
  el.quoteAuthor.textContent = `- ${quote.author}`;
}

function initPlanner() {
  APP.planner = loadStorage(STORAGE_KEYS.planner, APP.planner);
  el.morningPlan.value = APP.planner.morning || "";
  el.afternoonPlan.value = APP.planner.afternoon || "";
  el.eveningPlan.value = APP.planner.evening || "";

  const savePlanner = () => {
    APP.planner.morning = el.morningPlan.value;
    APP.planner.afternoon = el.afternoonPlan.value;
    APP.planner.evening = el.eveningPlan.value;
    saveStorage(STORAGE_KEYS.planner, APP.planner);
  };

  [el.morningPlan, el.afternoonPlan, el.eveningPlan].forEach((node) => {
    node.addEventListener("input", savePlanner);
  });
}

function initApp() {
  initTheme();
  startClock();
  initTodos();
  initPomodoro();
  initWeather();
  initQuotes();
  initPlanner();
}

document.addEventListener("DOMContentLoaded", initApp);
