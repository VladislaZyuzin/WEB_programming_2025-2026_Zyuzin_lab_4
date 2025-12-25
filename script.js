const weatherContainer = document.getElementById("weatherContainer");
const loader = document.getElementById("loader");
const globalError = document.getElementById("globalError");

const addCitySection = document.getElementById("addCitySection");
const cityInput = document.getElementById("cityInput");
const cityError = document.getElementById("cityError");
const suggestions = document.getElementById("suggestions");
const citiesList = document.getElementById("citiesList");

const refreshBtn = document.getElementById("refreshBtn");

const STORAGE_KEY = "weatherAppData";

const CITIES = [
  { name: "Москва", lat: 55.75, lon: 37.61 },
  { name: "Санкт-Петербург", lat: 59.93, lon: 30.31 },
  { name: "Казань", lat: 55.79, lon: 49.12 },
  { name: "Новосибирск", lat: 55.03, lon: 82.92 },
  { name: "Екатеринбург", lat: 56.84, lon: 60.61 }
];

let state = {
  current: null,
  cities: []
};

init();

function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    state = JSON.parse(saved);
    renderAll();
  } else {
    requestGeolocation();
  }
}

function requestGeolocation() {
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.current = {
        name: "Текущее местоположение",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      };
      saveState();
      renderAll();
    },
    () => {
      addCitySection.classList.remove("hidden");
    }
  );
}

async function loadWeather(lat, lon, container) {
  loader.classList.remove("hidden");
  container.innerHTML = "";

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    if (!res.ok) throw new Error("Ошибка загрузки");

    const data = await res.json();
    renderWeather(data.daily, container);
  } catch (e) {
    globalError.textContent = e.message;
  } finally {
    loader.classList.add("hidden");
  }
}

function renderWeather(daily, container) {
  const grid = document.createElement("div");
  grid.className = "weather-grid";

  for (let i = 0; i < 3; i++) {
    const card = document.createElement("div");
    card.className = "weather-card";
    card.innerHTML = `
      <strong>${daily.time[i]}</strong>
      <div>🌡 ${daily.temperature_2m_min[i]}° / ${daily.temperature_2m_max[i]}°</div>
    `;
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function renderAll() {
  weatherContainer.innerHTML = "";
  if (state.current) {
    loadWeather(state.current.lat, state.current.lon, weatherContainer);
  }

  citiesList.innerHTML = "";
  state.cities.forEach(city => {
    const div = document.createElement("div");
    div.innerHTML = `<h4>${city.name}</h4>`;
    const cont = document.createElement("div");
    div.appendChild(cont);
    citiesList.appendChild(div);
    loadWeather(city.lat, city.lon, cont);
  });
}

cityInput.addEventListener("input", () => {
  suggestions.innerHTML = "";
  const value = cityInput.value.toLowerCase();

  CITIES.filter(c => c.name.toLowerCase().includes(value))
    .forEach(city => {
      const li = document.createElement("li");
      li.textContent = city.name;
      li.onclick = () => {
        cityInput.value = city.name;
        suggestions.innerHTML = "";
      };
      suggestions.appendChild(li);
    });
});

document.getElementById("addCityBtn").onclick = () => {
  cityError.textContent = "";
  const city = CITIES.find(c => c.name === cityInput.value);

  if (!city) {
    cityError.textContent = "Такого города нет";
    return;
  }

  state.cities.push(city);
  saveState();
  renderAll();
  cityInput.value = "";
};

refreshBtn.onclick = () => {
  renderAll();
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
