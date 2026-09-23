Module.register('MMM-YrNow', {
	defaults: {
        lat: null,               // Decimal degrees, e.g. 63.4305
        lon: null,               // Decimal degrees, e.g. 10.3951
        contact: null,           // Your e-mail or site, added to the User-Agent MET sees
        showWeatherForecast: true,
        updateInterval: 5 * 60 * 1000
	},

    getTranslations: function() {
        return {
            no: "translations/no.json",
        }
    },

    getScripts: function() {
        return [
            'printf.js'
        ];
    },

    getStyles: function() {
		return ['mmm-yrnow.css'];
	},

	start: function() {
		this.precipitation = [];
		this.loaded = false;
        this.getForecast();
        var self = this;

        setInterval(function() {
            self.updateDom(1000);
        }, 60000);
	},

    socketNotificationReceived: function(notification, payload) {
		if(notification === 'YR_FORECAST_DATA') {
            if(payload.precipitation != null) {
                this.precipitation = payload.precipitation;
                this.loaded = true;
            }
            if(payload.symbolCode != null) this.weatherSymbol = payload.symbolCode;
            if(Number.isFinite(payload.temperature)) this.temperature = payload.temperature;
            this.updateDom(1000);
		}
	},

    getForecast: function() {
        this.sendSocketNotification('GET_YR_FORECAST', {
            config: this.config
        });
    },

    getNextPrecipStart: function() {
        return this.precipitation.find((item) =>
            item.intensity > 0 && Date.parse(item.time) >= new Date().valueOf());
    },

    // The first dry point *after* precipitation starts, so a dry slot earlier in
    // the series cannot be reported as the moment the rain stops.
    getNextPrecipStop: function(start) {
        const from = start ? Date.parse(start.time) : new Date().valueOf();
        return this.precipitation.find((item) =>
            item.intensity === 0 && Date.parse(item.time) > from);
    },

    getMinutesTill: function(nextItemTime) {
        return Math.abs(Date.parse(nextItemTime) - new Date().valueOf()) / (1000 * 60);
    },

	getDom: function() {
		var wrapper = document.createElement('div');
        var animationWrapper = document.createElement('div');
        animationWrapper.className = 'animation';

		if (!this.loaded) {
			wrapper.innerHTML = this.translate('loading');
			wrapper.className = 'dimmed light small';
			return wrapper;
	    }
        var nowCast = this.translate('no_precip_next_90');
        var precipitationStart = this.getNextPrecipStart();
        var precipitationStop = this.getNextPrecipStop(precipitationStart);
        var forecast = document.createElement('div');
        forecast.className = 'forecast';

        if(precipitationStart != null) {
            //Precip some time during the next 90 minutes
            var precipitationStartsIn = this.getMinutesTill(precipitationStart.time);
            forecast.appendChild(animationWrapper);
                
            //Precip now
            if(precipitationStartsIn < 7) {
                this.createAnimation(animationWrapper);
                forecast.appendChild(this.getUmbrella());            
                if(precipitationStop) {
                    const precipitationStopsIn = this.getMinutesTill(precipitationStop.time);
                    nowCast = printf(this.translate("precipitation_ends"), precipitationStopsIn.toFixed(0));
                }
                else
                    nowCast = this.translate("precip_next_90");
            }
            else {
                //Precip in n minutes
                forecast.appendChild(this.getUmbrella());
                nowCast = printf(this.translate("precip_in"), precipitationStartsIn.toFixed(0));
            }
        }

        if(nowCast == this.translate('no_precip_next_90') && this.config.showWeatherForecast && this.weatherSymbol) {
            forecast.appendChild(this.getWeatherSymbol());
        }
        wrapper.appendChild(forecast);
        if (Number.isFinite(this.temperature)) {
            wrapper.appendChild(this.getTemperature());
        }
        wrapper.appendChild(this.createNowcastText(nowCast));
    	return wrapper;
	},

    createNowcastText: function(nowCast) {
        var nowCastText = document.createElement('p');   
        nowCastText.className = 'medium precipText';
        nowCastText.innerHTML = nowCast;
        return nowCastText
    }, 

    createAnimation: function(testElement) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                testElement.appendChild(xhr.responseXML.documentElement);
            }
        };
        xhr.open('GET', this.file('images/rain.svg'), true);
        xhr.send('');
    },

    getUmbrella: function() {
        var umbrella = document.createElement('img');
        umbrella.className = 'umbrella';
        umbrella.src = this.file('images/umbrella.svg');
        return umbrella;
    },

    getWeatherSymbol: function() {
        var symbol = document.createElement('img');
        symbol.className = 'weatherSymbol';
        symbol.src = this.file(printf('images/symbols/%s.svg', this.weatherSymbol));
        // If MET ever returns a symbol_code we have no icon for, drop the image
        // rather than showing a broken one.
        symbol.onerror = function() { symbol.remove(); };
        return symbol;
    },

    getTemperature: function() {
        var temp = document.createElement('div');
        temp.className = 'temperature light large bright';
        temp.innerHTML = printf('%s°', Math.round(this.temperature));
        return temp;
    },



});
