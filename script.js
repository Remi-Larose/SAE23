/**
 * Instant Weather V2 - Application météorologique moderne avec carte
 * Auteur: Larose Rémi
 * Technologies: JavaScript ES6+, API Géo Gouv, API Météo-Concept, Leaflet
 */

class InstantWeather {
    constructor() {
        // Configuration des APIs
        this.METEO_API_TOKEN = '58fd053fbc06c093bd1ca8b239d49f63ca1e352729b42aba4fe89af4431ffca1'; // À remplacer par votre token personnel
        this.GEO_API_BASE = 'https://geo.api.gouv.fr';
        this.METEO_API_BASE = 'https://api.meteo-concept.com/api';
        
        // Éléments DOM
        this.elements = {
            cityInput: document.getElementById('cityInput'),
            searchBtn: document.getElementById('searchBtn'),
            suggestions: document.getElementById('suggestions'),
            daysRange: document.getElementById('daysRange'),
            daysValue: document.getElementById('daysValue'),
            loadingSpinner: document.getElementById('loadingSpinner'),
            errorMessage: document.getElementById('errorMessage'),
            weatherResults: document.getElementById('weatherResults'),
            cityName: document.getElementById('cityName'),
            cityCoordinates: document.getElementById('cityCoordinates'),
            weatherCards: document.getElementById('weatherCards'),
            searchHistory: document.getElementById('searchHistory'),
            themeToggle: document.getElementById('themeToggle'),
            mapSection: document.getElementById('mapSection'),
            map: document.getElementById('map')
        };
        
        // État de l'application
        this.state = {
            currentCity: null,
            searchHistory: this.loadSearchHistory(),
            isDarkMode: this.loadThemePreference(),
            map: null,
            mapMarker: null
        };
        
        // Debounce timer pour les suggestions
        this.debounceTimer = null;
        
        this.init();
    }
    
    /**
     * Initialisation de l'application
     */
    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.displaySearchHistory();
        this.checkAPIToken();
        this.initMap();
    }
    
    /**
     * Initialisation de la carte
     */
    initMap() {
        // Initialiser la carte avec une vue par défaut sur la France
        this.state.map = L.map('map').setView([46.603354, 1.888334], 6);
        
        // Ajouter les tuiles de carte
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
        
        tileLayer.addTo(this.state.map);
        
        // Adapter les couleurs en fonction du thème
        this.updateMapTheme();
    }
    
    /**
     * Mise à jour du thème de la carte
     */
    updateMapTheme() {
        if (!this.state.map) return;
        
        // En mode sombre, utiliser des tuiles plus sombres
        if (this.state.isDarkMode) {
            // Retirer les anciennes tuiles
            this.state.map.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) {
                    this.state.map.removeLayer(layer);
                }
            });
            
            // Ajouter les tuiles sombres
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
            }).addTo(this.state.map);
        } else {
            // Retirer les anciennes tuiles
            this.state.map.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) {
                    this.state.map.removeLayer(layer);
                }
            });
            
            // Ajouter les tuiles claires
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.state.map);
        }
    }
    
    /**
     * Affichage de la ville sur la carte
     */
    showCityOnMap(city) {
        if (!this.state.map) return;
        
        const lat = city.centre.coordinates[1];
        const lon = city.centre.coordinates[0];
        
        // Supprimer le marqueur précédent s'il existe
        if (this.state.mapMarker) {
            this.state.map.removeLayer(this.state.mapMarker);
        }
        
        // Créer un marqueur personnalisé
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: '<i class="fas fa-map-marker-alt" style="color: white; font-size: 18px; margin: 3px 0 0 1px;"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });
        
        // Ajouter le nouveau marqueur
        this.state.mapMarker = L.marker([lat, lon], { icon: customIcon })
            .addTo(this.state.map)
            .bindPopup(`
                <div style="text-align: center; font-family: Inter;">
                    <strong style="font-size: 16px;">${city.nom}</strong><br>
                    ${city.codesPostaux?.[0] ? `<span style="color: #666;">${city.codesPostaux[0]}</span><br>` : ''}
                    <small style="color: #888;">
                        ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E
                    </small>
                </div>
            `)
            .openPopup();
        
        // Centrer la carte sur la ville avec un zoom approprié
        this.state.map.setView([lat, lon], 12);
        
        // Afficher la section carte
        this.elements.mapSection.style.display = 'block';
        
        // Forcer le redimensionnement de la carte après affichage
        setTimeout(() => {
            this.state.map.invalidateSize();
        }, 100);
    }
    
    /**
     * Vérification du token API
     */
    checkAPIToken() {
        if (this.METEO_API_TOKEN === '58fd053fbc06c093bd1ca8b239d49f63ca1e352729b42aba4fe89af4431ffca1') {
            this.showError('Veuillez configurer votre token API Météo-Concept dans le fichier script.js');
        }
    }
    
    /**
     * Configuration des écouteurs d'événements
     */
    setupEventListeners() {
        // Recherche
        this.elements.cityInput.addEventListener('input', this.handleCityInput.bind(this));
        this.elements.cityInput.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.elements.searchBtn.addEventListener('click', this.handleSearch.bind(this));
        
        // Gestion des suggestions
        this.elements.suggestions.addEventListener('click', this.handleSuggestionClick.bind(this));
        
        // Slider des jours
        this.elements.daysRange.addEventListener('input', this.handleDaysChange.bind(this));
        
        // Bouton thème
        this.elements.themeToggle.addEventListener('click', this.toggleTheme.bind(this));
        
        // Clic en dehors des suggestions
        document.addEventListener('click', this.handleOutsideClick.bind(this));
        
        // Gestion du responsive
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    /**
     * Gestion de la saisie dans le champ ville
     */
    handleCityInput(event) {
        const query = event.target.value.trim();
        
        // Debounce pour éviter trop de requêtes
        clearTimeout(this.debounceTimer);
        
        // Commencer la recherche dès 2 caractères pour les noms, 
        // ou dès 2 chiffres pour les codes postaux
        if (query.length >= 2) {
            this.debounceTimer = setTimeout(() => {
                this.fetchCitySuggestions(query);
            }, 300);
        } else {
            this.hideSuggestions();
        }
    }
    
    /**
     * Gestion des touches clavier
     */
    handleKeyDown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.handleSearch();
        } else if (event.key === 'Escape') {
            this.hideSuggestions();
        }
    }
    
    /**
     * Gestion de la recherche
     */
    async handleSearch() {
        const cityName = this.elements.cityInput.value.trim();
        if (!cityName) {
            this.showError('Veuillez saisir le nom d\'une commune');
            return;
        }
        
        try {
            this.showLoading();
            this.hideSuggestions();
            
            // Recherche de la commune
            const cities = await this.searchCities(cityName);
            if (cities.length === 0) {
                throw new Error('Aucune commune trouvée');
            }
            
            // Prendre la première commune trouvée
            const city = cities[0];
            await this.fetchWeatherData(city);
            
            // Afficher la ville sur la carte
            this.showCityOnMap(city);
            
            // Ajouter à l'historique
            this.addToSearchHistory(city);
            
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Recherche de communes via l'API Géo
     */
    async searchCities(query) {
        try {
            let cities = [];
            
            // Vérifier si la requête est un code postal (5 chiffres)
            const isPostalCode = /^\d{5}$/.test(query);
            
            if (isPostalCode) {
                // Recherche par code postal
                const response = await fetch(
                    `${this.GEO_API_BASE}/communes?codePostal=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,centre,population&format=json&geometry=centre`
                );
                
                if (response.ok) {
                    cities = await response.json();
                }
            } else {
                // Recherche par nom de commune
                const response = await fetch(
                    `${this.GEO_API_BASE}/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,centre,population&format=json&geometry=centre`
                );
                
                if (response.ok) {
                    cities = await response.json();
                }
                
                // Si peu de résultats par nom, essayer aussi une recherche par code postal partiel
                if (cities.length < 3 && /^\d{2,4}$/.test(query)) {
                    try {
                        const postalResponse = await fetch(
                            `${this.GEO_API_BASE}/communes?codePostal=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,centre,population&format=json&geometry=centre`
                        );
                        
                        if (postalResponse.ok) {
                            const postalCities = await postalResponse.json();
                            // Fusionner les résultats en évitant les doublons
                            const existingCodes = new Set(cities.map(city => city.code));
                            postalCities.forEach(city => {
                                if (!existingCodes.has(city.code)) {
                                    cities.push(city);
                                }
                            });
                        }
                    } catch (postalError) {
                        console.warn('Erreur recherche par code postal partiel:', postalError);
                    }
                }
            }
            
            // Trier les résultats par population (décroissant) pour mettre en avant les villes principales
            cities.sort((a, b) => (b.population || 0) - (a.population || 0));
            
            return cities;
            
        } catch (error) {
            console.error('Erreur API Géo:', error);
            throw new Error('Impossible de rechercher les communes');
        }
    }
    
    /**
     * Récupération des suggestions de villes
     */
    async fetchCitySuggestions(query) {
        try {
            const cities = await this.searchCities(query);
            // Augmenter le nombre de suggestions pour les codes postaux
            const maxSuggestions = /^\d{2,5}$/.test(query) ? 10 : 5;
            this.displaySuggestions(cities.slice(0, maxSuggestions));
        } catch (error) {
            console.error('Erreur suggestions:', error);
        }
    }
    
    /**
     * Affichage des suggestions
     */
    displaySuggestions(cities) {
        if (cities.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        const suggestionsHTML = cities.map(city => {
            const postalCodes = city.codesPostaux || [];
            const mainPostalCode = postalCodes[0] || '';
            const additionalCodes = postalCodes.length > 1 ? ` (+${postalCodes.length - 1})` : '';
            
            return `
                <div class="suggestion-item" 
                     data-city='${JSON.stringify(city)}'
                     role="option"
                     tabindex="0">
                    <div class="suggestion-main">
                        <strong>${city.nom}</strong>
                        ${mainPostalCode ? `<span class="postal-code">${mainPostalCode}${additionalCodes}</span>` : ''}
                    </div>
                    <div class="suggestion-details">
                        ${city.population ? `<span class="population">${city.population.toLocaleString()} hab.</span>` : ''}
                        ${postalCodes.length > 1 ? `<span class="multiple-codes">Codes: ${postalCodes.slice(0, 3).join(', ')}${postalCodes.length > 3 ? '...' : ''}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        this.elements.suggestions.innerHTML = suggestionsHTML;
        this.elements.suggestions.style.display = 'block';
        this.elements.suggestions.setAttribute('aria-hidden', 'false');
    }
    
    /**
     * Masquer les suggestions
     */
    hideSuggestions() {
        this.elements.suggestions.style.display = 'none';
        this.elements.suggestions.setAttribute('aria-hidden', 'true');
    }
    
    /**
     * Gestion du clic sur une suggestion
     */
    handleSuggestionClick(event) {
        const suggestionItem = event.target.closest('.suggestion-item');
        if (suggestionItem) {
            const city = JSON.parse(suggestionItem.dataset.city);
            this.elements.cityInput.value = city.nom;
            this.hideSuggestions();
            this.fetchWeatherData(city);
            this.showCityOnMap(city);
            this.addToSearchHistory(city);
        }
    }
    
    /**
     * Gestion du clic en dehors des suggestions
     */
    handleOutsideClick(event) {
        if (!this.elements.suggestions.contains(event.target) && 
            !this.elements.cityInput.contains(event.target)) {
            this.hideSuggestions();
        }
    }
    
    /**
     * Gestion du changement de nombre de jours
     */
    handleDaysChange(event) {
        const days = event.target.value;
        this.elements.daysValue.textContent = days;
        
        // Si une ville est sélectionnée, recharger les données
        if (this.state.currentCity) {
            this.fetchWeatherData(this.state.currentCity);
        }
    }
    
    /**
     * Récupération des données météo
     */
    async fetchWeatherData(city) {
        try {
            this.showLoading();
            this.state.currentCity = city;
            
            const days = parseInt(this.elements.daysRange.value);
            const lat = city.centre.coordinates[1];
            const lon = city.centre.coordinates[0];
            
            // Simulation des données météo pour la démo
            // Dans un vrai projet, décommentez la partie ci-dessous et ajoutez votre token API
            
            /*
            // Appel à l'API Météo-Concept
            const response = await fetch(
                `${this.METEO_API_BASE}/forecast/daily?token=${this.METEO_API_TOKEN}&latlng=${lat},${lon}&hours=false`
            );
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Token API invalide. Vérifiez votre configuration.');
                }
                throw new Error('Erreur lors de la récupération des données météo');
            }
            
            const data = await response.json();
            */
            
            // Données simulées pour la démo
            const data = {
                forecast: this.generateMockWeatherData(days)
            };
            
            if (!data.forecast || data.forecast.length === 0) {
                throw new Error('Aucune donnée météo disponible');
            }
            
            // Limiter aux jours demandés
            const forecastData = data.forecast.slice(0, days);
            
            this.displayWeatherData(city, forecastData);
            
        } catch (error) {
            console.error('Erreur météo:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    /**
     * Génération de données météo simulées pour la démo
     */
    generateMockWeatherData(days) {
        const mockData = [];
        const today = new Date();
        
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            
            mockData.push({
                datetime: date.toISOString().split('T')[0],
                tmax: Math.round(15 + Math.random() * 15),
                tmin: Math.round(5 + Math.random() * 10),
                weather: Math.floor(Math.random() * 10),
                probarain: Math.round(Math.random() * 100),
                sun_hours: Math.round(3 + Math.random() * 8),
                rr10: Math.round(Math.random() * 10),
                wind10m: Math.round(5 + Math.random() * 25),
                dirwind10m: Math.round(Math.random() * 360)
            });
        }
        
        return mockData;
    }
    
    /**
     * Affichage des données météo
     */
    displayWeatherData(city, forecast) {
        // Informations de la ville
        this.elements.cityName.textContent = city.nom;
        
        // Coordonnées (si demandées)
        const additionalInfo = this.getSelectedAdditionalInfo();
        let coordinatesHTML = '';
        
        if (additionalInfo.includes('latitude') || additionalInfo.includes('longitude')) {
            const lat = city.centre.coordinates[1].toFixed(6);
            const lon = city.centre.coordinates[0].toFixed(6);
            coordinatesHTML = `
                ${additionalInfo.includes('latitude') ? `<span><i class="fas fa-map-marker-alt"></i> Lat: ${lat}</span>` : ''}
                ${additionalInfo.includes('longitude') ? `<span><i class="fas fa-map-marker-alt"></i> Lon: ${lon}</span>` : ''}
            `;
        }
        
        this.elements.cityCoordinates.innerHTML = coordinatesHTML;
        
        // Cartes météo
        const cardsHTML = forecast.map((day, index) => {
            return this.createWeatherCard(day, index);
        }).join('');
        
        this.elements.weatherCards.innerHTML = cardsHTML;
        this.elements.weatherResults.style.display = 'block';
    }
    
    /**
     * Création d'une carte météo
     */
    createWeatherCard(dayData, index) {
        const date = new Date(dayData.datetime);
        const dateStr = date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        
        const weatherIcon = this.getWeatherIcon(dayData.weather);
        const additionalInfo = this.getSelectedAdditionalInfo();
        
        // Détails supplémentaires
        let detailsHTML = '';
        
        if (additionalInfo.includes('rain')) {
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-value">${dayData.rr10 || 0}</span>
                    <span class="detail-label">Pluie (mm)</span>
                </div>
            `;
        }
        
        if (additionalInfo.includes('wind')) {
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-value">${dayData.wind10m || 0}</span>
                    <span class="detail-label">Vent (km/h)</span>
                </div>
            `;
        }
        
        if (additionalInfo.includes('windDirection')) {
            detailsHTML += `
                <div class="detail-item">
                    <span class="detail-value">${dayData.dirwind10m || 0}°</span>
                    <span class="detail-label">Direction</span>
                </div>
            `;
        }
        
        return `
            <div class="weather-card" style="animation-delay: ${index * 0.1}s">
                <div class="weather-card-header">
                    <div class="weather-date">${dateStr}</div>
                    <div class="weather-icon">${weatherIcon}</div>
                </div>
                <div class="weather-temps">
                    <span class="temp-max">${dayData.tmax}°C</span>
                    <span class="temp-min">${dayData.tmin}°C</span>
                </div>
                <div class="weather-details">
                    <div class="detail-item">
                        <span class="detail-value">${dayData.probarain}%</span>
                        <span class="detail-label">Probabilité pluie</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-value">${dayData.sun_hours || 0}h</span>
                        <span class="detail-label">Ensoleillement</span>
                    </div>
                    ${detailsHTML}
                </div>
            </div>
        `;
    }
    
    /**
     * Obtention de l'icône météo
     */
    getWeatherIcon(weather) {
        const weatherIcons = {
            0: '☀️', // Soleil
            1: '🌤️', // Peu nuageux
            2: '⛅', // Ciel voilé
            3: '☁️', // Nuageux
            4: '☁️', // Très nuageux
            5: '🌫️', // Brouillard
            6: '🌦️', // Pluie faible
            7: '🌧️', // Pluie modérée
            8: '🌧️', // Pluie forte
            9: '⛈️', // Orage
            10: '🌨️', // Neige faible
            11: '❄️', // Neige modérée
            12: '❄️', // Neige forte
            13: '🌨️', // Pluie et neige
            14: '🌨️', // Pluie verglaçante
            15: '❄️', // Neige et vent
            16: '⛈️'  // Orage et grêle
        };
        
        return weatherIcons[weather] || '🌤️';
    }
    
    /**
     * Récupération des informations supplémentaires sélectionnées
     */
    getSelectedAdditionalInfo() {
        const checkboxes = document.querySelectorAll('input[name="additionalInfo"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    /**
     * Gestion du thème
     */
    setupTheme() {
        document.documentElement.setAttribute('data-theme', this.state.isDarkMode ? 'dark' : 'light');
        this.updateThemeIcon();
        this.updateMapTheme();
    }
    
    /**
     * Basculement du thème
     */
    toggleTheme() {
        this.state.isDarkMode = !this.state.isDarkMode;
        document.documentElement.setAttribute('data-theme', this.state.isDarkMode ? 'dark' : 'light');
        this.updateThemeIcon();
        this.updateMapTheme();
        this.saveThemePreference();
    }
    
    /**
     * Mise à jour de l'icône du thème
     */
    updateThemeIcon() {
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = this.state.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    /**
     * Gestion de l'historique des recherches
     */
    addToSearchHistory(city) {
        // Éviter les doublons
        const existingIndex = this.state.searchHistory.findIndex(item => item.code === city.code);
        if (existingIndex !== -1) {
            this.state.searchHistory.splice(existingIndex, 1);
        }
        
        // Ajouter en début de liste
        this.state.searchHistory.unshift({
            nom: city.nom,
            code: city.code,
            centre: city.centre,
            codesPostaux: city.codesPostaux
        });
        
        // Limiter à 10 éléments
        this.state.searchHistory = this.state.searchHistory.slice(0, 10);
        
        this.saveSearchHistory();
        this.displaySearchHistory();
    }
    
    /**
     * Affichage de l'historique
     */
    displaySearchHistory() {
        if (this.state.searchHistory.length === 0) {
            this.elements.searchHistory.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Aucune recherche récente</p>';
            return;
        }
        
        const historyHTML = this.state.searchHistory.map(city => `
            <div class="history-item" 
                 data-city='${JSON.stringify(city)}'
                 role="button"
                 tabindex="0">
                ${city.nom}
            </div>
        `).join('');
        
        this.elements.searchHistory.innerHTML = historyHTML;
        
        // Ajouter les écouteurs d'événements
        this.elements.searchHistory.addEventListener('click', this.handleHistoryClick.bind(this));
    }
    
    /**
     * Gestion du clic sur l'historique
     */
    handleHistoryClick(event) {
        const historyItem = event.target.closest('.history-item');
        if (historyItem) {
            const city = JSON.parse(historyItem.dataset.city);
            this.elements.cityInput.value = city.nom;
            this.fetchWeatherData(city);
            this.showCityOnMap(city);
        }
    }
    
    /**
     * Affichage du spinner de chargement
     */
    showLoading() {
        this.elements.loadingSpinner.style.display = 'block';
        this.elements.errorMessage.style.display = 'none';
        this.elements.weatherResults.style.display = 'none';
    }
    
    /**
     * Masquer le spinner de chargement
     */
    hideLoading() {
        this.elements.loadingSpinner.style.display = 'none';
    }
    
    /**
     * Affichage des erreurs
     */
    showError(message) {
        this.elements.errorMessage.querySelector('p').textContent = message;
        this.elements.errorMessage.style.display = 'flex';
        this.elements.weatherResults.style.display = 'none';
    }
    
    /**
     * Gestion du redimensionnement
     */
    handleResize() {
        // Masquer les suggestions lors du redimensionnement
        this.hideSuggestions();
        
        // Redimensionner la carte si elle existe
        if (this.state.map) {
            setTimeout(() => {
                this.state.map.invalidateSize();
            }, 100);
        }
    }
    
    /**
     * Sauvegarde de l'historique dans le localStorage
     */
    saveSearchHistory() {
        try {
            if (typeof Storage !== 'undefined') {
                localStorage.setItem('instant-weather-history', JSON.stringify(this.state.searchHistory));
            }
        } catch (error) {
            console.warn('Impossible de sauvegarder l\'historique:', error);
        }
    }
    
    /**
     * Chargement de l'historique depuis le localStorage
     */
    loadSearchHistory() {
        try {
            if (typeof Storage !== 'undefined') {
                const saved = localStorage.getItem('instant-weather-history');
                return saved ? JSON.parse(saved) : [];
            }
        } catch (error) {
            console.warn('Impossible de charger l\'historique:', error);
        }
        return [];
    }
    
    /**
     * Sauvegarde des préférences de thème
     */
    saveThemePreference() {
        try {
            if (typeof Storage !== 'undefined') {
                localStorage.setItem('instant-weather-theme', this.state.isDarkMode ? 'dark' : 'light');
            }
        } catch (error) {
            console.warn('Impossible de sauvegarder le thème:', error);
        }
    }
    
    /**
     * Chargement des préférences de thème
     */
    loadThemePreference() {
        try {
            if (typeof Storage !== 'undefined') {
                const saved = localStorage.getItem('instant-weather-theme');
                if (saved) {
                    return saved === 'dark';
                }
            }
        } catch (error) {
            console.warn('Impossible de charger le thème:', error);
        }
        
        // Détecter la préférence système par défaut
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
}

// Initialisation de l'application au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    new InstantWeather();
});

// Gestion des erreurs globales
window.addEventListener('error', (event) => {
    console.error('Erreur globale:', event.error);
});

// Service Worker pour le cache (optionnel pour une PWA future)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Navigator service worker registration code would go here
        console.log('Service Worker support détecté');
    });
}