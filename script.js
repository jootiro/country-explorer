/* ── Country Explorer — script.js ── */

const searchForm     = document.getElementById('search-form');
const searchInput    = document.getElementById('search-input');
const homeView       = document.getElementById('home-view');
const resultsView    = document.getElementById('results-view');
const mainContent    = document.getElementById('main-content');
const weatherSidebar = document.getElementById('weather-sidebar');
const errorBanner    = document.getElementById('error-banner');
const errorMessage   = document.getElementById('error-message');
const loadingOverlay = document.getElementById('loading-overlay');
const logoLink       = document.getElementById('logo-link');

/* ── Navigation helpers ── */
function showHome() {
  homeView.classList.add('active');
  homeView.classList.remove('hidden');
  resultsView.classList.add('hidden');
  resultsView.classList.remove('active');
  errorBanner.classList.add('hidden');
  searchInput.value = '';
}

function showResults() {
  homeView.classList.add('hidden');
  homeView.classList.remove('active');
  resultsView.classList.remove('hidden');
  resultsView.classList.add('active');
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

/* ── Logo → home ── */
logoLink.addEventListener('click', e => {
  e.preventDefault();
  showHome();
});

/* ── Example tags ── */
document.querySelectorAll('.example-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    searchInput.value = tag.dataset.country;
    runSearch(tag.dataset.country);
  });
});

/* ── Search handler ── */
searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;
  console.log('[Search] country query:', query);
  runSearch(query);
});

async function runSearch(countryName) {
  showLoading();
  hideError();
  showResults();
  mainContent.innerHTML = '';
  weatherSidebar.innerHTML = '<div class="sidebar-inner"><p class="sidebar-loading">Loading weather…</p></div>';

  try {
    const country = await fetchCountryData(countryName);
    renderFacts(country);
    fetchAndRenderWeather(country);
    fetchAndRenderImages(country);
  } catch (err) {
    showError(err.message || 'Could not find that country. Please check the spelling and try again.');
    mainContent.innerHTML = '';
    weatherSidebar.innerHTML = '';
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   FEATURE 2 — Country Facts via Wikidata
════════════════════════════════════════ */

function flagEmojiFromISO(code) {
  if (!code || code.length !== 2) return '🏳';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => c.charCodeAt(0) - 65 + 0x1F1E6)
  );
}

const COUNTRY_KEYWORDS = ['country', 'state', 'nation', 'republic', 'kingdom',
  'island', 'principality', 'emirate', 'sultanate', 'territory', 'duchy',
  'federation', 'commonwealth', 'archipelago'];

async function fetchCountryData(name) {
  /* Step 1 — find Wikidata entity ID */
  const searchRes = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities` +
    `&search=${encodeURIComponent(name)}&language=en&type=item&limit=10&format=json&origin=*`
  );
  if (!searchRes.ok) throw new Error('Wikidata search failed. Please try again.');
  const searchData = await searchRes.json();

  if (!searchData.search || searchData.search.length === 0) {
    throw new Error(`"${name}" not found. Check the spelling and try again.`);
  }

  // Prefer results whose description mentions country-like terms
  let entityId = null;
  for (const result of searchData.search) {
    const desc = (result.description || '').toLowerCase();
    if (COUNTRY_KEYWORDS.some(kw => desc.includes(kw))) {
      entityId = result.id;
      break;
    }
  }
  if (!entityId) entityId = searchData.search[0].id;

  /* Step 2 — SPARQL for structured facts */
  const sparql = `
    SELECT ?itemLabel ?officialLabel ?capitalLabel ?population ?area
      (GROUP_CONCAT(DISTINCT ?langLabel; separator=", ") AS ?languages)
      (GROUP_CONCAT(DISTINCT ?currLabel;  separator=", ") AS ?currencies)
      ?continentLabel ?iso2
    WHERE {
      VALUES ?item { wd:${entityId} }
      OPTIONAL { ?item wdt:P1448 ?official. }
      OPTIONAL { ?item wdt:P36  ?capital. }
      OPTIONAL { ?item wdt:P1082 ?population. }
      OPTIONAL { ?item wdt:P2046 ?area. }
      OPTIONAL { ?item wdt:P37  ?lang. }
      OPTIONAL { ?item wdt:P38  ?curr. }
      OPTIONAL { ?item wdt:P30  ?continent. }
      OPTIONAL { ?item wdt:P297 ?iso2. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?itemLabel ?officialLabel ?capitalLabel ?population ?area ?continentLabel ?iso2
    LIMIT 1
  `;

  const sparqlRes = await fetch(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`,
    { headers: { Accept: 'application/json' } }
  );
  if (!sparqlRes.ok) throw new Error('Failed to load country data. Please try again.');

  const sparqlData = await sparqlRes.json();
  const b = sparqlData.results?.bindings?.[0];
  if (!b) throw new Error(`No country data found for "${name}".`);

  const iso2 = b.iso2?.value || '';

  return {
    name:       b.itemLabel?.value    || name,
    official:   b.officialLabel?.value || b.itemLabel?.value || name,
    capital:    b.capitalLabel?.value  || 'N/A',
    population: b.population ? parseInt(b.population.value) : null,
    area:       b.area ? Math.round(parseFloat(b.area.value)) : null,
    languages:  b.languages?.value   || 'N/A',
    currencies: b.currencies?.value  || 'N/A',
    region:     b.continentLabel?.value || 'N/A',
    flag:       flagEmojiFromISO(iso2),
    iso2,
    entityId,
  };
}

function fmt(n) {
  if (n === null || n === undefined) return 'N/A';
  return n.toLocaleString();
}

function renderFacts(c) {
  mainContent.innerHTML = `
    <div class="facts-card">
      <div class="facts-hero">
        <div class="country-flag">${c.flag}</div>
        <div class="country-name-block">
          <h2>${c.name}</h2>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-top:4px;">${c.official}</p>
          <span class="region-tag">${c.region}</span>
        </div>
      </div>
      <div class="facts-grid">
        <div class="fact-cell">
          <div class="fact-label">Capital</div>
          <div class="fact-value">${c.capital}</div>
        </div>
        <div class="fact-cell">
          <div class="fact-label">Population</div>
          <div class="fact-value">${c.population ? fmt(c.population) : 'N/A'}</div>
        </div>
        <div class="fact-cell">
          <div class="fact-label">Area</div>
          <div class="fact-value">${c.area ? fmt(c.area) + ' km²' : 'N/A'}</div>
        </div>
        <div class="fact-cell">
          <div class="fact-label">Languages</div>
          <div class="fact-value">${c.languages}</div>
        </div>
        <div class="fact-cell" style="grid-column:span 2;">
          <div class="fact-label">Currency</div>
          <div class="fact-value">${c.currencies}</div>
        </div>
      </div>
      <div class="images-section">
        <h3>Famous Landmarks &amp; Destinations</h3>
        <div class="images-grid" id="images-grid">
          <div class="landmark-img-wrap"><div class="img-placeholder">Loading…</div></div>
          <div class="landmark-img-wrap"><div class="img-placeholder">Loading…</div></div>
        </div>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════
   FEATURE 3 — Weather Sidebar (Open-Meteo)
════════════════════════════════════════ */

const WMO = {
  0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
  45:'Fog', 48:'Icy fog',
  51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
  61:'Light rain', 63:'Rain', 65:'Heavy rain',
  71:'Light snow', 73:'Snow', 75:'Heavy snow',
  80:'Showers', 81:'Rain showers', 82:'Violent showers',
  95:'Thunderstorm', 96:'Thunderstorm w/ hail', 99:'Severe thunderstorm',
};

const WMO_ICON = {
  0:'☀️',1:'🌤',2:'⛅',3:'☁️',45:'🌫',48:'🌫',
  51:'🌦',53:'🌧',55:'🌧',61:'🌦',63:'🌧',65:'🌧',
  71:'🌨',73:'❄️',75:'❄️',80:'🌦',81:'🌧',82:'⛈',
  95:'⛈',96:'⛈',99:'⛈',
};

async function fetchAndRenderWeather(country) {
  const capital = country.capital;
  if (!capital || capital === 'N/A') {
    weatherSidebar.innerHTML = '<div class="sidebar-inner"><p class="sidebar-loading">No capital city data.</p></div>';
    return;
  }
  try {
    const geoRes  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(capital)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) throw new Error('City not found');

    const { latitude, longitude, name: cityName } = geoData.results[0];

    const wxRes  = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&timezone=auto&wind_speed_unit=kmh`
    );
    const wxData = await wxRes.json();
    const cur    = wxData.current;

    const temp      = Math.round(cur.temperature_2m);
    const code      = cur.weather_code;
    const condition = WMO[code] ?? 'Unknown';
    const icon      = WMO_ICON[code] ?? '🌡';
    const humidity  = cur.relative_humidity_2m;
    const wind      = Math.round(cur.wind_speed_10m);

    weatherSidebar.innerHTML = `
      <div class="sidebar-inner">
        <div class="weather-city">Live Weather</div>
        <div class="weather-label">${cityName}</div>
        <div class="temp-display">
          <div class="temp-big">${temp}°C</div>
          <div class="temp-condition">${icon} ${condition}</div>
        </div>
        <div class="weather-stats">
          <div class="weather-stat">
            <span class="stat-label">💧 Humidity</span>
            <span class="stat-value">${humidity}%</span>
          </div>
          <div class="weather-stat">
            <span class="stat-label">💨 Wind</span>
            <span class="stat-value">${wind} km/h</span>
          </div>
          <div class="weather-stat">
            <span class="stat-label">📍 City</span>
            <span class="stat-value">${capital}</span>
          </div>
        </div>
        <p class="weather-note">Current conditions for ${cityName} via Open-Meteo.</p>
      </div>
    `;
  } catch {
    weatherSidebar.innerHTML = `
      <div class="sidebar-inner">
        <p class="sidebar-loading">Weather unavailable for ${capital}.</p>
      </div>
    `;
  }
}

/* ════════════════════════════════════════
   FEATURE 4 — Tourist Images (Wikipedia)
════════════════════════════════════════ */

async function fetchWikiImage(searchTerm) {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(searchTerm)}&gsrlimit=8` +
    `&prop=pageimages&format=json&pithumbsize=800&origin=*`
  );
  const data = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});

  // skip generic/flag images; prefer photos
  const skipPatterns = [/flag/i, /coat.of.arms/i, /emblem/i, /seal/i, /blank/i, /map/i, /locator/i];

  for (const page of pages) {
    const src = page.thumbnail?.source || '';
    if (src && !skipPatterns.some(p => p.test(src)) && !skipPatterns.some(p => p.test(page.title))) {
      return { url: src, title: page.title };
    }
  }
  // fallback: any page with a thumbnail
  const fallback = pages.find(p => p.thumbnail?.source);
  return fallback ? { url: fallback.thumbnail.source, title: fallback.title } : null;
}

async function fetchAndRenderImages(country) {
  const name    = country.name;
  const capital = country.capital !== 'N/A' ? country.capital : name;

  const queries = [
    `${name} famous landmark tourist`,
    `${capital} landmark attraction`,
  ];

  const [img1, img2] = await Promise.all(queries.map(q => fetchWikiImage(q).catch(() => null)));

  const grid = document.getElementById('images-grid');
  if (!grid) return;
  grid.innerHTML = '';

  [img1, img2].forEach((result, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'landmark-img-wrap';

    if (result?.url) {
      const img = document.createElement('img');
      img.src  = result.url;
      img.alt  = result.title;
      img.loading = 'lazy';
      img.onerror = () => { wrap.innerHTML = '<div class="img-placeholder">Image unavailable</div>'; };

      const cap = document.createElement('div');
      cap.className   = 'landmark-caption';
      cap.textContent = result.title;

      wrap.appendChild(img);
      wrap.appendChild(cap);
    } else {
      const label = i === 0 ? `${name} Landmark` : capital;
      wrap.innerHTML = `<div class="img-placeholder">${label} — image unavailable</div>`;
    }

    grid.appendChild(wrap);
  });
}
