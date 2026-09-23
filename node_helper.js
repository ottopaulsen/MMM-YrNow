const NodeHelper = require("node_helper");

// MET Norway's open API. Documented, openly licensed, and coordinate based:
//   https://api.met.no/weatherapi/nowcast/2.0/documentation
//   https://api.met.no/weatherapi/locationforecast/2.0/documentation
//
// Nowcast is radar based and only covers the Nordics, which is the same
// limitation the old yr.no v0 endpoint had.
const NOWCAST_URL = "https://api.met.no/weatherapi/nowcast/2.0/complete";
const FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

// MET blocks generic user agents and expects to be able to reach whoever is
// running the client. The repository identifies the software; the operator adds
// their own address through the `contact` config option, so a published fork
// never carries someone else's email.
const MODULE_VERSION = "2.0.0";
const MODULE_URL = "https://github.com/ottopaulsen/MMM-YrNow";

// The cache-control header tells us when the next value is due. Clamp it: a
// missing or silly value must not turn the poll loop into a busy loop, or
// stall it for hours.
const MIN_UPDATE_INTERVAL = 60 * 1000;
const MAX_UPDATE_INTERVAL = 60 * 60 * 1000;
const FALLBACK_UPDATE_INTERVAL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 15 * 1000;

module.exports = NodeHelper.create({
  start () {
    console.log(`Starting node helper for: ${this.name}`);
    this.config = null;
    this.updateTimer = null;
  },

  stop () {
    clearTimeout(this.updateTimer);
    this.updateTimer = null;
  },

  socketNotificationReceived (notification, payload) {
    if (notification !== "GET_YR_FORECAST") return;

    this.config = payload.config;

    // The frontend asks again on every browser refresh. Without this, each
    // request would start its own poll loop and they would pile up.
    clearTimeout(this.updateTimer);
    this.updateTimer = null;

    if (!Number.isFinite(Number(this.config.lat)) || !Number.isFinite(Number(this.config.lon))) {
      console.error(`${this.name}: config needs numeric lat and lon. See the README.`);
      return;
    }

    this.getForecast();
  },

  userAgent () {
    const contact = this.config?.contact;
    return contact
      ? `MMM-YrNow/${MODULE_VERSION} (+${MODULE_URL}; ${contact})`
      : `MMM-YrNow/${MODULE_VERSION} (+${MODULE_URL})`;
  },

  async fetchJson (baseUrl) {
    // MET asks for coordinates truncated to 4 decimals; more precision is
    // rejected, since it defeats their caching.
    const url = new URL(baseUrl);
    url.searchParams.set("lat", Number(this.config.lat).toFixed(4));
    url.searchParams.set("lon", Number(this.config.lon).toFixed(4));

    const response = await fetch(url, {
      headers: { "User-Agent": this.userAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });
    if (!response.ok) {
      throw new Error(`${baseUrl} returned HTTP ${response.status}`);
    }
    return { body: await response.json(), headers: response.headers };
  },

  async getForecast () {
    try {
      const nowcast = await this.fetchJson(NOWCAST_URL);
      this.setNextUpdate(nowcast.headers);

      const data = { precipitation: this.readPrecipitation(nowcast.body) };

      // Only the nowcast is essential; a failing forecast should not stop the
      // precipitation display from updating.
      if (this.config.showWeatherForecast) {
        try {
          const forecast = await this.fetchJson(FORECAST_URL);
          Object.assign(data, this.readForecast(forecast.body));
        } catch (error) {
          console.error(`${this.name}: could not read the forecast: ${error.message}`);
        }
      }

      this.sendSocketNotification("YR_FORECAST_DATA", data);
    } catch (error) {
      console.error(`${this.name}: could not read the nowcast: ${error.message}`);
    } finally {
      // Always reschedule. The old version scheduled inside the response
      // callback, so a request that never came back stopped updates for good.
      this.scheduleNextUpdate();
    }
  },

  // [{ time, intensity }], oldest first — the shape the frontend walks through
  // to find when precipitation starts and stops.
  readPrecipitation (body) {
    const series = body?.properties?.timeseries ?? [];
    return series
      .map((point) => ({
        time: point.time,
        intensity: point?.data?.instant?.details?.precipitation_rate
      }))
      .filter((point) => Number.isFinite(point.intensity));
  },

  readForecast (body) {
    const first = body?.properties?.timeseries?.[0];
    return {
      symbolCode: first?.data?.next_1_hours?.summary?.symbol_code
        ?? first?.data?.next_6_hours?.summary?.symbol_code,
      temperature: first?.data?.instant?.details?.air_temperature
    };
  },

  scheduleNextUpdate () {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => this.getForecast(), this.updateInterval());
  },

  updateInterval () {
    const interval = Number(this.config?.updateInterval);
    if (!Number.isFinite(interval) || interval <= 0) return FALLBACK_UPDATE_INTERVAL;
    return Math.min(Math.max(interval, MIN_UPDATE_INTERVAL), MAX_UPDATE_INTERVAL);
  },

  setNextUpdate (headers) {
    const cacheControl = headers.get("cache-control");
    const maxAge = cacheControl && /max-age\s*=\s*(\d+)/i.exec(cacheControl);
    if (!maxAge) return; // keep whatever interval we already had
    this.config.updateInterval = Number(maxAge[1]) * 1000;
  }
});
