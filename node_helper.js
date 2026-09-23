const NodeHelper = require("node_helper");

// The nowcast response carries a cache-control header telling us when the next
// value is due. Clamp it: a missing or silly value must not turn the poll loop
// into a busy loop, or stall it for hours.
const MIN_UPDATE_INTERVAL = 60 * 1000;
const MAX_UPDATE_INTERVAL = 60 * 60 * 1000;
const FALLBACK_UPDATE_INTERVAL = 5 * 60 * 1000;
const REQUEST_TIMEOUT = 15 * 1000;

const USER_AGENT = "MMM-YrNow (https://github.com/ottopaulsen/MMM-YrNow)";

module.exports = NodeHelper.create({
  start () {
    console.log(`Starting node helper for: ${this.name}`);
    this.config = null;
    this.forecastUrl = "";
    this.updateTimer = null;
  },

  stop () {
    clearTimeout(this.updateTimer);
    this.updateTimer = null;
  },

  socketNotificationReceived (notification, payload) {
    if (notification !== "GET_YR_FORECAST") return;

    this.config = payload.config;
    this.forecastUrl = payload.forecastUrl;

    // The frontend asks again on every browser refresh. Without this, each
    // request would start its own poll loop and they would pile up.
    clearTimeout(this.updateTimer);
    this.updateTimer = null;

    this.getForecast();
  },

  async fetchJson (url) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });
    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }
    return { body: await response.json(), headers: response.headers };
  },

  async getForecast () {
    try {
      const nowcast = await this.fetchJson(`${this.forecastUrl}/now`);
      this.setNextUpdate(nowcast.headers);

      const locationData = { nowcast: nowcast.body };

      // Only the nowcast is essential; a failing forecast should not stop the
      // precipitation display from updating.
      try {
        const forecast = await this.fetchJson(this.forecastUrl);
        locationData.forecast = forecast.body;
      } catch (error) {
        console.error(`${this.name}: could not read the forecast: ${error.message}`);
      }

      this.sendSocketNotification("YR_FORECAST_DATA", locationData);
    } catch (error) {
      console.error(`${this.name}: could not read the nowcast: ${error.message}`);
    } finally {
      // Always reschedule. The old version scheduled inside the response
      // callback, so a request that never came back stopped updates for good.
      this.scheduleNextUpdate();
    }
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
