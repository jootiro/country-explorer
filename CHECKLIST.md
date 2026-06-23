# Country Explorer — Feature Checklist

**Goal:** A web app where users type any country name and instantly see key facts, two landmark images, and live weather data for that country.

## Features

| Status | Feature | Requirement (what "done" looks like) |
|--------|---------|--------------------------------------|
| TRUE   | Search Bar Scaffold | Open `index.html` in a browser; a styled search bar appears centered near the top; typing a country name and pressing Enter logs the trimmed input to the console without page reload; a home/landing state is visible before any search |
| TRUE   | Country Facts Display | After pressing Enter with a valid country name, the main area shows: country flag, official name, capital, population (formatted), area (km²), spoken languages, currency, and region; an error message appears for unrecognised country names |
| TRUE   | Weather Sidebar | A sidebar renders alongside the facts showing current temperature (°C), a weather condition label, humidity (%), and wind speed (km/h) for the country's capital city — data is fetched live from Open-Meteo and updates on each new search |
| TRUE   | Tourist Destination Images | Two images of the country's most famous tourist landmarks appear in the results view with descriptive captions; images are sourced from the Wikipedia API using a landmark search for the country |
| TRUE   | Modern UI & UX Polish | The app uses a modern dark-mode aesthetic with a gradient background; results fade in smoothly; the search bar is visible and usable from both the home screen and the results screen; layout is clean and readable on screens 900px and wider |
