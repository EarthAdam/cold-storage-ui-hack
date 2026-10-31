# Hold

One screen for a cold room. The board keeps the sensors and the relay. This page only listens.

Global Energy Hackathon, 30 Oct – 1 Nov 2026. The clinic fridge (2–8 °C) is the case. The same screen also runs a fish landing and a packhouse.

Glenn, Ademola, Bonheur, Sam, Ursy, Adam.

## Open

```bash
python3 -m http.server 8731
```

Then open `http://127.0.0.1:8731/`.

The header switch changes °C and °F on screen. Messages stay in Celsius (`temperature_C`).

## Trades

- **Clinic** — vaccines, oxytocin, insulin. Freeze is as bad as heat. Cutaway of the building.
- **Landing** — ice, the day's catch, a blast freezer. Map of the creek.
- **Packhouse** — greens, tomatoes, a cooler that loses power. View of the farms.

A clock sits to the right of the scene. The day starts at 06:00, runs fast until 10:00, then slows. A warm or open clinic cabinet shows one sentence in the corner. Prices on the page are estimates, not quotes.

## MQTT

The message shape is [schema.html](schema.html).

Broker `public.cloud.shiftr.io`, user `public`, password `public`.

- `openami/<deviceId>/subpanel_ENV` — temperature, humidity, door
- `openami/<deviceId>/subpanel_3Ph` — watts, volts, energy

A temperature and humidity of `0` / `0` means the probe is not live. The desk does not send commands.

Simulated rooms:

```bash
node sim/publish.mjs
```

## License

AGPL-3.0. Copyright (C) 2026 Overview Solutions. See `LICENSE`.

You may sell a copy. If you change this desk and serve that change on a network, offer the source. Public source: [github.com/EarthAdam/cold-storage-ui-hack](https://github.com/EarthAdam/cold-storage-ui-hack).

Other libraries: `THIRD_PARTY_NOTICES.md`. Prior work vs this weekend: `DISCLOSURE.md`.
