# MagicMirror² Module: YrNow

> **This is a fork** of [YR/MMM-YrNow](https://github.com/YR/MMM-YrNow),
> maintained at [ottopaulsen/MMM-YrNow](https://github.com/ottopaulsen/MMM-YrNow).
> The upstream repository has had no commits since January 2023 and carries no
> licence file, so this fork exists for personal use rather than redistribution.
>
> Changes in this fork:
>
> - **Uses MET Norway's open API** (`nowcast/2.0` and `locationforecast/2.0`)
>   instead of yr.no's undocumented internal `v0` endpoint. The open API is
>   documented, openly licensed and stable; the old one offered no guarantees.
>   This changes the configuration: `lat`/`lon` replace `locationId`.
> - Weather symbols now come from MET's own
>   [weathericons](https://github.com/metno/weathericons) set (MIT licensed) in
>   `images/symbols/`, named by `symbol_code`. The artwork is the same as before
>   — the icons this module shipped were these icons renamed to legacy ids — but
>   now they are properly licensed and need no mapping table.
> - Uses the built-in `fetch` instead of the deprecated `request` package, so the
>   module has no external dependencies at all.
> - The poll loop reschedules even when a request fails or times out. Previously
>   the next poll was scheduled inside the response callback, so a request that
>   never came back stopped all updates until MagicMirror was restarted.
> - Requests time out after 15 seconds, and the update interval taken from the
>   `cache-control` header is clamped to sane bounds.
> - A missing `cache-control` header no longer throws.
> - A browser refresh no longer starts a second, parallel poll loop.
> - Fixed `NaN°` being shown as the temperature when `showWeatherForecast` is
>   `false`.
> - Removed `readTextFile.js`, dead code that did a synchronous XHR and then
>   called `alert()`.


<img src="/images/screenshot.png" align="right"/>A nowcast module for [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror), showing precipitation for the next 90 minutes. This is a personal fork and is not maintained or endorsed by Yr or MET Norway.

The data comes from [MET Norway's open API](https://api.met.no/), the Norwegian Meteorological Institute — the same institute behind [Yr](https://www.yr.no/), which it runs together with NRK. So the forecast is the same one Yr shows, taken from the documented public API rather than Yr's internal one.
Nowcast data is only available for some Norwegian locations covered by the Norwegian weather radars. See [Explanation (in Norwegian)](https://yrkundesenter.zendesk.com/hc/no/articles/209295525-N%C3%A5varsel-Pr%C3%B8v-v%C3%A5rt-nye-nedb%C3%B8rvarsel-)!
 Sometimes the Nowcast will tell you "no precipitation next 90 minutes", while the weather symbol contains rain or snow. This is expected, since the weather symbol is based on a weather model and Nowcast is based on radar observations.

The temperature value is fetched from the current hour in the weather forecast for your location.

## How to install

Remote into your Magic Mirror box using a terminal software and go to the modules folder:

    cd ~/MagicMirror/modules

Clone the repository:

	git clone https://github.com/ottopaulsen/MMM-YrNow

There are no dependencies to install.

Add the module to the modules array in the config/config.js file by adding the following section. You can change this configuration later when you see this works:

	{
		module: 'MMM-YrNow',
		position: 'top_right',
		config: {
			lat: 63.4305,
			lon: 10.3951,
			contact: 'you@example.com',
			showWeatherForecast: true
		}
	},

## Configuration options

| Option                | Default | Comment                                                                                                                                                                       |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lat`                 | –       | Latitude in decimal degrees. Required. Nowcast only covers the Nordics.                                                                                                        |
| `lon`                 | –       | Longitude in decimal degrees. Required.                                                                                                                                        |
| `contact`             | –       | Your e-mail address or site. MET requires a `User-Agent` that identifies the software *and* lets them reach the operator, and blocks generic ones. Strongly recommended.        |
| `showWeatherForecast` | `true`  | If there is no precipitation in the nowcast, show the weather symbol for the next period.                                                                                      |
| `updateInterval`      | 5 min   | Starting poll interval. Replaced by the `cache-control` value MET returns, clamped to between 1 and 60 minutes.                                                                |

Find your coordinates from the URL of your location on [Yr](https://www.yr.no/),
or from any map.

## Attribution

Weather data from [MET Norway](https://api.met.no/), used under
[NLOD](https://data.norge.no/nlod/en/2.0) / CC BY 4.0. Weather symbols from
[metno/weathericons](https://github.com/metno/weathericons), MIT licensed — see
`images/symbols/LICENSE`.
