const ui = {
  container: document.getElementById("weatherContainer"),
  input: document.getElementById("cityInput"),
  refresh: document.getElementById("refresh"),
  error: document.getElementById("error"),
  hints: document.getElementById("suggestions")
};

let cityList = [];

window.onload = () => {
  const savedCities = localStorage.getItem("weather_cities");
  if (savedCities) {
    cityList = JSON.parse(savedCities);
    updateWeather();
  } else {
    detectLocation();
  }
};

function detectLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      cityList = [{
        name: "Моё местоположение",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      }];
      save();
      updateWeather();
    },
    () => ui.error.textContent = "Геолокация недоступна"
  );
}

ui.input.addEventListener("input", async () => {
  const query = ui.input.value.trim();
  ui.hints.innerHTML = "";

  if (!query) return hideHints();

  const cities = await searchCity(query);
  if (!cities.length) {
    ui.error.textContent = "Город не найден";
    return hideHints();
  }

  ui.error.textContent = "";

  cities.forEach(c => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = c.name;
    item.onclick = () => selectCity(c);
    ui.hints.appendChild(item);
  });

  ui.hints.style.display = "block";
});

ui.refresh.onclick = updateWeather;

function selectCity(city) {
  if (!cityList.find(c => c.name === city.name)) {
    cityList.push(city);
    save();
    updateWeather();
  }
  ui.input.value = "";
  hideHints();
}

function hideHints() {
  ui.hints.style.display = "none";
}

function save() {
  localStorage.setItem("weather_cities", JSON.stringify(cityList));
}

async function updateWeather() {
  ui.container.innerHTML = "";
  for (const city of cityList) {
    try {
      const data = await fetchWeather(city);
      ui.container.appendChild(buildCard(city, data));
    } catch {
      ui.container.innerHTML += `<div class="weather-card">${city.name}: ошибка</div>`;
    }
  }
}

async function searchCity(name) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${name}&count=5&language=ru`
  );
  const json = await res.json();
  return json.results
    ? json.results.map(r => ({ name: r.name, lat: r.latitude, lon: r.longitude }))
    : [];
}

async function fetchWeather(city) {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max` +
    `&timezone=auto&start_date=${today}&end_date=${end}`
  );
  return res.json();
}

const codes = {
  0: "Ясно", 1: "Почти ясно", 2: "Малооблачно", 3: "Облачно",
  61: "Дождь", 71: "Снег", 95: "Гроза"
};

function buildCard(city, data) {
  const card = document.createElement("div");
  card.className = "weather-card";

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.textContent = "Убрать";
  del.onclick = () => {
    cityList = cityList.filter(c => c.name !== city.name);
    save();
    updateWeather();
  };

  card.innerHTML = `<h2>${city.name}</h2>`;
  card.appendChild(del);

  data.daily.time.forEach((t, i) => {
    const d = new Date(t);
    const day = document.createElement("div");
    day.className = "day-forecast";
    day.innerHTML = `
      <strong>${d.toLocaleDateString("ru-RU", { weekday: "long" })}</strong>
      🌡 ${Math.round(data.daily.temperature_2m_max[i])}° /
      ${Math.round(data.daily.temperature_2m_min[i])}°
      ☁ ${codes[data.daily.weathercode[i]] || "—"}
    `;
    card.appendChild(day);
  });

  return card;
}

document.addEventListener("click", e => {
  if (!ui.hints.contains(e.target) && e.target !== ui.input) hideHints();
});
