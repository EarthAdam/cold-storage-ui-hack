# Hold

Global Energy Hackathon, 30 Oct – 1 Nov 2026. The team is Glenn, Bonheur, Ella, Ademola, Adam, and Sam.

This repo is the open screen for that entry. The case is a packhouse on a weak three-phase supply. Phase B drops. The market cooler is a single-phase circuit, so Street-EMS opens it off B and closes it onto phase A. Hold draws that move. It does not command the contactors. The clinic and the fish landing are still on the switch. They are not the opening view.

## Open

```bash
python3 -m http.server 8731
```

Then open `http://127.0.0.1:8731/`.

The header switch changes °C and °F on screen. Messages stay in Celsius (`temperature_C`).

## Trades

- **Packhouse** — the opening view. The farm scene shows the three-phase yard, the fault on phase B, and the Street-EMS box on the pole moving the market cooler onto phase A. The contactors are simulated.
- **Clinic** — vaccines, oxytocin, insulin. Freeze is as bad as heat. Cutaway of the building.
- **Landing** — ice, the day's catch, a blast freezer. Map of the creek.

A clock sits to the right of the scene. The day starts at 06:00, runs fast until 10:00, then slows. The phase fault waits for that slow stretch. Drag the hour hand to rewind into it. Phase B falls, Street-EMS opens the market cooler off B, then closes it onto A. A battery charges while the sun is up and discharges after. The same level is on the clock. A corner sentence names who should act. Prices on the page are estimates, not quotes.

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

## Board desk

Clinic, Landing, and Packhouse are the demo. [board.html](board.html) is the live publish path. It does not simulate a room.

```bash
node log/record.mjs
```

That process subscribes on its own and writes `log/hold.sqlite`. The site can be closed. The board page draws every saved row on a log-time axis, newest at the right, so you can see what is there before you ask for a slice. Query without opening the site:

```bash
node log/record.mjs --query --device StreetPoleEMS_abc --kind env --since 2026-10-31
node log/record.mjs --verify
```

Each row hashes the row before it. `--verify` says if a row was edited. The VillageGrid notes looked at Chainlink as a feed for energy credits. This log keeps the readings on this machine. It does not put them on a chain, and it does not send a command.

## License

AGPL-3.0. Copyright (C) 2026 Overview Solutions. See `LICENSE`.

You may sell a copy. If you change this desk and serve that change on a network, offer the source. Public source: [github.com/EarthAdam/cold-storage-ui-hack](https://github.com/EarthAdam/cold-storage-ui-hack).

Other libraries: `THIRD_PARTY_NOTICES.md`. Prior work vs this weekend: `DISCLOSURE.md`.
