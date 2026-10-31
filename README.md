# Hold

Operator desk for a cold-storage business. One screen, three trades. The MeshEMS board in Nairobi keeps the sensors, the relay, and the setpoint. This page only listens.

Global Energy Hackathon, 30 Oct – 1 Nov 2026. Brief 01 is the clinic case (2–8 °C, freeze as damaging as heat, uptime after the installers leave). The same desk also runs a landing and a packhouse. Glenn, Ademola, Bonheur, Sam, Ursy, Adam.

## Open

Double-click `index.html` for the simulated floor.

The desk shows Celsius or Fahrenheit. The header switch changes every temperature on the screen: the big number, the band, the plan, the room list, and the temperature timeline. Storage and MQTT stay in Celsius (`temperature_C`).

Live MQTT from a browser needs a normal page origin. From this folder:

```bash
python3 -m http.server 8731
```

Then open `http://127.0.0.1:8731/`.

## What the operator sees

The top line is the business: rooms that need a person, illustrative stock at risk, share of time inside the band since the desk was opened, and kilowatt-hours counted here.

Clinic opens on a Three.js cutaway of the post: reception, waiting, lunch, dry storage, and the cold room. Drag to look, click a cabinet. The map for that trade is a short strip under the day face. The other trades still open on a live OpenStreetMap of the real place. Each trade opens on its supply chain. Landing shows the creek: OpenStreetMap piers, Kilifi Market, and kitchens on land, plus simulated boats and fish grounds in the water. Clinic shows the markets and the school, with a simulated boda. The packhouse shows the fields and the kitchens, with a simulated truck. The map is the OpenFreeMap dark style. Movers are icons with a trail behind them. From zoom 14 the buildings stand up. Under the map, a 24-hour face has noon at the top, midnight at the bottom, clockwise. The light is computed for the site in East Africa Time. Each view opens at 06:00 and runs fast to 10:00, then slows. Boats, the boda, and the truck follow that clock. Simulated rooms follow it too. A live board is left on its own clock. © OpenStreetMap contributors.

The list is every room, worst first. The paper panel is the room you are standing in: temperature, the band on a ruler, humidity, door, power, holdover, and one plain action.

Prices and loss clocks are operator estimates so the floor can be judged. They are not quotes or lab results.

Trades:

| Trade | What changes |
| --- | --- |
| Clinic | 2–8 °C vaccine, oxytocin, insulin. Freeze is an emergency. |
| Landing | Ice hold, the day's catch, blast freezer. |
| Packhouse | Leafy greens (humidity), tomatoes, a market cooler that loses power. |

## MQTT

The topic and JSON contract for every trade is [schema.html](schema.html). Firmware already publishes this shape (`meshems-openami-metering`):

- Broker `public.cloud.shiftr.io:1883`, user `public`, password `public`
- `openami/<deviceId>/subpanel_ENV`
- `openami/<deviceId>/subpanel_3Ph`

ENV fields used: `temperature_C`, `humidity_percent`, `door_open`, `door_open_duration_ms`, `location_text`. A `0` / `0` pair is treated as "probe not live" and does not overwrite a room. `North_Pole` is the firmware placeholder and is ignored.

3Ph fields used: `WphA` `WphB` `WphC` (watts), `PhVphA` `PhVphB` `PhVphC` (volts), `Hz`, `TotWhImport` (watt-hours since the meter started; the desk shows the delta after connect).

`meter_N` topics are ignored. The room total is `subpanel_3Ph`.

Simulated trades publish GeoJSON on the same broker:

```bash
node sim/publish.mjs --dump
node sim/publish.mjs
```

`--dump` writes `sim/geojson/<trade>.geojson` and exits. With no flag, the process publishes every 2 seconds to `openami/geojson/clinic`, `landing`, and `packhouse`.

Each payload is a GeoJSON FeatureCollection. A room is a Point. Coordinates are `[longitude, latitude]`. Properties carry the MeshEMS fields (`temperature_C`, `humidity_percent`, `door_open`, `WphA`, `PhVphA`, `Hz`, `TotWhImport`) plus `profile`, `room`, and `deviceId` (`sim-<trade>-<room>`). Sites are illustrative, not surveyed facilities.

Link the desk, leave the topic prefix on `openami`, and the open trade fills from that collection. A real `StreetPoleEMS_…` id on a room keeps the board and ignores the sim point for that room. The other trades stay in the inbox until you switch to them.

The browser connects with WebSocket to `wss://public.cloud.shiftr.io` (same host, not port 1883). The broker password stays in this browser's local storage.

The desk does not publish to `…/cmd`. The simulator publishes only the GeoJSON collections.

## License

MIT. Copyright (c) 2026 Overview Solutions. See `LICENSE`.

## Another trade

Add an object on `PROFILES` in `hold.js`. Each room needs a band, a scale for the ruler, a stock line, and a `script` of `hold`, `door`, `freeze`, `dry`, `outage`, or `warm`. Copy the `lines` block and rewrite the actions in the words that trade uses. No layout change.
