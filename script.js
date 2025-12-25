const STORAGE_KEY = 'weather_app_state';

const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

let state = {
  current: null,
  cities: []
};

let searchTimeout = null;

const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  addCityBtn: document.getElementById('addCityBtn'),
  cityInput: document.getElementById('cityInput'),
  suggestions: document.getElementById('suggestions'),
  cityError: document.getElementById('cityError'),
  addCitySection: document.getElementById('addCitySection'),
  currentWeather: document.getElementById('currentWeather'),
  citiesList: document.getElementById('citiesList'),
  loader: document.getElementById('loader'),
  globalError: document.getElementById('globalError')
};

function init() {
  loadStateFromStorage();
  setupEventListeners();
  
  if (state.current || state.cities.length > 0) {
    renderAll();
  } else {
    showAddCitySection();
    requestGeolocation();
  }
}

function loadStateFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch (error) {
      console.error('Ошибка загрузки данных из localStorage:', error);
      state = { current: null, cities: [] };
    }
  }
}

function saveStateToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Ошибка сохранения данных в localStorage:', error);
  }
}

function setupEventListeners() {
  elements.refreshBtn.addEventListener('click', handleRefresh);
  elements.addCityBtn.addEventListener('click', handleAddCity);
  elements.cityInput.addEventListener('input', handleCityInput);
}

function requestGeolocation() {
  if (!navigator.geolocation) {
    showAddCitySection();
    showError('Геолокация не поддерживается вашим браузером');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    handleGeolocationSuccess,
    handleGeolocationError
  );
}

function handleGeolocationSuccess(position) {
  state.current = {
    name: 'Текущее местоположение',
    lat: position.coords.latitude,
    lon: position.coords.longitude
  };
  saveStateToStorage();
  renderAll();
}

function handleGeolocationError() {
  showAddCitySection();
  showError('Не удалось получить геолокацию. Пожалуйста, добавьте город вручную.');
}

function showAddCitySection() {
  elements.addCitySection.classList.add('active');
}

function handleRefresh() {
  clearError();
  renderAll();
}

async function handleCityInput(event) {
  const query = event.target.value.trim();
  
  clearTimeout(searchTimeout);
  elements.suggestions.classList.remove('active');
  clearSuggestions();
  
  if (query.length < 2) {
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    await searchCities(query);
  }, 300);
}

async function searchCities(query) {
  try {
    const url = `${GEOCODING_API}?name=${encodeURIComponent(query)}&count=10&language=ru&format=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Ошибка поиска городов');
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      displaySuggestions(data.results);
    }
  } catch (error) {
    console.error('Ошибка поиска городов:', error);
  }
}

function displaySuggestions(cities) {
  clearSuggestions();
  
  cities.forEach(city => {
    const li = document.createElement('li');
    
    const cityName = document.createTextNode(
      `${city.name}${city.admin1 ? ', ' + city.admin1 : ''}${city.country ? ', ' + city.country : ''}`
    );
    
    li.appendChild(cityName);
    li.dataset.lat = city.latitude;
    li.dataset.lon = city.longitude;
    li.dataset.name = city.name;
    
    li.addEventListener('click', () => handleSuggestionClick(city));
    
    elements.suggestions.appendChild(li);
  });
  
  elements.suggestions.classList.add('active');
}

function handleSuggestionClick(city) {
  elements.cityInput.value = city.name;
  elements.cityInput.dataset.lat = city.latitude;
  elements.cityInput.dataset.lon = city.longitude;
  elements.cityInput.dataset.selectedName = city.name;
  
  clearSuggestions();
  elements.suggestions.classList.remove('active');
}

function clearSuggestions() {
  while (elements.suggestions.firstChild) {
    elements.suggestions.removeChild(elements.suggestions.firstChild);
  }
}

function handleAddCity() {
  clearCityError();
  
  const cityName = elements.cityInput.value.trim();
  
  if (!cityName) {
    showCityError('Введите название города');
    return;
  }
  
  if (!elements.cityInput.dataset.lat || !elements.cityInput.dataset.lon) {
    showCityError('Выберите город из списка');
    return;
  }
  
  const newCity = {
    name: elements.cityInput.dataset.selectedName || cityName,
    lat: parseFloat(elements.cityInput.dataset.lat),
    lon: parseFloat(elements.cityInput.dataset.lon)
  };
  
  const isDuplicate = state.cities.some(
    city => city.lat === newCity.lat && city.lon === newCity.lon
  );
  
  if (isDuplicate) {
    showCityError('Этот город уже добавлен');
    return;
  }
  
  if (state.current && 
      state.current.lat === newCity.lat && 
      state.current.lon === newCity.lon) {
    showCityError('Этот город уже добавлен как текущее местоположение');
    return;
  }
  
  state.cities.push(newCity);
  saveStateToStorage();
  
  elements.cityInput.value = '';
  delete elements.cityInput.dataset.lat;
  delete elements.cityInput.dataset.lon;
  delete elements.cityInput.dataset.selectedName;
  
  renderAll();
}

function showCityError(message) {
  elements.cityError.textContent = message;
  elements.cityError.classList.add('active');
}

function clearCityError() {
  elements.cityError.textContent = '';
  elements.cityError.classList.remove('active');
}

function showError(message) {
  elements.globalError.textContent = message;
  elements.globalError.classList.add('active');
}

function clearError() {
  elements.globalError.textContent = '';
  elements.globalError.classList.remove('active');
}

function showLoader() {
  elements.loader.classList.add('active');
}

function hideLoader() {
  elements.loader.classList.remove('active');
}

async function renderAll() {
  clearError();
  clearCitiesList();
  
  if (state.current) {
    await renderCurrentWeather();
  }
  
  if (state.cities.length > 0) {
    await renderCities();
  }
  
  if (!state.current && state.cities.length === 0) {
    showAddCitySection();
  }
}

async function renderCurrentWeather() {
  clearWeatherSection(elements.currentWeather);
  
  const header = createWeatherHeader('Текущее местоположение', true);
  elements.currentWeather.appendChild(header);
  
  const weatherContainer = document.createElement('div');
  elements.currentWeather.appendChild(weatherContainer);
  
  elements.currentWeather.classList.add('active');
  
  await loadAndDisplayWeather(
    state.current.lat,
    state.current.lon,
    weatherContainer
  );
}

async function renderCities() {
  for (let i = 0; i < state.cities.length; i++) {
    const city = state.cities[i];
    await renderCityWeather(city, i);
  }
}

async function renderCityWeather(city, index) {
  const section = document.createElement('div');
  section.className = 'weather-section active';
  
  const header = createWeatherHeader(city.name, false, index);
  section.appendChild(header);
  
  const weatherContainer = document.createElement('div');
  section.appendChild(weatherContainer);
  
  elements.citiesList.appendChild(section);
  
  await loadAndDisplayWeather(city.lat, city.lon, weatherContainer);
}

function createWeatherHeader(locationName, isCurrent, cityIndex = null) {
  const header = document.createElement('div');
  header.className = 'weather-header';
  
  const titleContainer = document.createElement('div');
  titleContainer.className = 'weather-title';
  
  const icon = document.createElement('span');
  icon.className = 'location-icon';
  icon.textContent = isCurrent ? '📍' : '🌍';
  titleContainer.appendChild(icon);
  
  const title = document.createElement('h3');
  title.textContent = locationName;
  titleContainer.appendChild(title);
  
  header.appendChild(titleContainer);
  
  if (!isCurrent && cityIndex !== null) {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '❌ Удалить';
    deleteBtn.addEventListener('click', () => removeCity(cityIndex));
    header.appendChild(deleteBtn);
  }
  
  return header;
}

function removeCity(index) {
  state.cities.splice(index, 1);
  saveStateToStorage();
  renderAll();
}

function clearWeatherSection(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

function clearCitiesList() {
  while (elements.citiesList.firstChild) {
    elements.citiesList.removeChild(elements.citiesList.firstChild);
  }
}

async function loadAndDisplayWeather(lat, lon, container) {
  showLoader();
  
  try {
    const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max&timezone=auto&forecast_days=7`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Ошибка загрузки данных о погоде');
    }
    
    const data = await response.json();
    
    displayWeatherData(data.daily, container);
  } catch (error) {
    showError(error.message);
    displayErrorInContainer(container, 'Не удалось загрузить данные о погоде');
  } finally {
    hideLoader();
  }
}

function displayWeatherData(daily, container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  const grid = document.createElement('div');
  grid.className = 'weather-grid';
  
  const daysToShow = Math.min(3, daily.time.length);
  
  for (let i = 0; i < daysToShow; i++) {
    const card = createWeatherCard(daily, i);
    grid.appendChild(card);
  }
  
  container.appendChild(grid);
}

function createWeatherCard(daily, index) {
  const card = document.createElement('div');
  card.className = 'weather-card';
  
  const date = document.createElement('div');
  date.className = 'weather-card-date';
  date.textContent = formatDate(daily.time[index]);
  card.appendChild(date);
  
  const tempContainer = document.createElement('div');
  tempContainer.className = 'weather-card-temp';
  
  const tempMin = Math.round(daily.temperature_2m_min[index]);
  const tempMax = Math.round(daily.temperature_2m_max[index]);
  
  tempContainer.textContent = `${tempMin}° / ${tempMax}°`;
  card.appendChild(tempContainer);
  
  const details = document.createElement('div');
  details.className = 'weather-card-details';
  
  const weatherDesc = getWeatherDescription(daily.weathercode[index]);
  details.appendChild(createWeatherDetail('☁️', weatherDesc));
  
  if (daily.precipitation_sum && daily.precipitation_sum[index] !== undefined) {
    const precip = daily.precipitation_sum[index];
    details.appendChild(createWeatherDetail('💧', `Осадки: ${precip} мм`));
  }
  
  if (daily.windspeed_10m_max && daily.windspeed_10m_max[index] !== undefined) {
    const wind = Math.round(daily.windspeed_10m_max[index]);
    details.appendChild(createWeatherDetail('💨', `Ветер: ${wind} км/ч`));
  }
  
  card.appendChild(details);
  
  return card;
}

function createWeatherDetail(icon, text) {
  const detail = document.createElement('div');
  detail.className = 'weather-detail';
  
  const iconSpan = document.createElement('span');
  iconSpan.className = 'weather-icon';
  iconSpan.textContent = icon;
  detail.appendChild(iconSpan);
  
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  detail.appendChild(textSpan);
  
  return detail;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Сегодня';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Завтра';
  }
  
  const options = { day: 'numeric', month: 'long', weekday: 'short' };
  return date.toLocaleDateString('ru-RU', options);
}

function getWeatherDescription(code) {
  const weatherCodes = {
    0: 'Ясно',
    1: 'Преимущественно ясно',
    2: 'Переменная облачность',
    3: 'Пасмурно',
    45: 'Туман',
    48: 'Изморозь',
    51: 'Легкая морось',
    53: 'Морось',
    55: 'Сильная морось',
    61: 'Небольшой дождь',
    63: 'Дождь',
    65: 'Сильный дождь',
    71: 'Небольшой снег',
    73: 'Снег',
    75: 'Сильный снег',
    77: 'Снежная крупа',
    80: 'Небольшие ливни',
    81: 'Ливни',
    82: 'Сильные ливни',
    85: 'Небольшой снегопад',
    86: 'Снегопад',
    95: 'Гроза',
    96: 'Гроза с градом',
    99: 'Гроза с сильным градом'
  };
  
  return weatherCodes[code] || 'Неизвестно';
}

function displayErrorInContainer(container, message) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.style.padding = '20px';
  errorDiv.style.textAlign = 'center';
  errorDiv.style.color = '#ff3b30';
  errorDiv.textContent = message;
  
  container.appendChild(errorDiv);
}

init();
