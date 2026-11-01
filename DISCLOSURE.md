# Disclosure

Global Energy Hackathon, 30 Oct – 1 Nov 2026. Team brief: Nigerian packhouse cold rooms. Track 1, new tech and hardware, non-residential.

This file is the public split between what existed before the weekend and what this repository added. It is not a bill of materials and it is not a measured uptime claim.

## Before the event

The MeshEMS board already published `openami/<deviceId>/subpanel_ENV` and `openami/<deviceId>/subpanel_3Ph`. Temperature on that wire is Celsius. The desk listens. It does not command the relay. That firmware is not in this repository.

Private cold-ems work, leakage sensing, and hardware design stay in their own trees. They are named here so the prior work is disclosed. Their source is not part of this public desk.

## Built in this repository during the weekend

Tag `geh-2026-desk` marks this tree.

An operator desk for the packhouse, plus Clinic and Landing on the same switch. The packhouse is the scored story: a simulated phase-B fault, a break-before-make onto phase A, and a leakage block. Desk is the live monitor-only feeder. The page listens. It does not command a contactor.

The desk shows a simulated day, a round clock, a clinic cutaway, a farm, and a landing map. A call-to-action bar reads a proposed `maintenance.message` when a payload carries it. On the illustrative clinic day, the same bar speaks the sentence a phone would carry. A live board message replaces that sentence. An empty message clears it.

## License

GNU Affero General Public License v3.0. Copyright (C) 2026 Overview Solutions. The Circaevum graphics library uses the same license. Locus does not. Three.js, MapLibre GL, and MQTT.js stay on their own licenses.

## Tools and data

Cursor agents wrote and revised this desk during the weekend, including Grok. OpenStreetMap data is drawn through OpenFreeMap and MapLibre. Sun times are computed in the page for the site date. Sites, boats, crops, people, and the clinic day are illustrative. They are not a survey, a vessel log, or a measured fridge-year.

## Not in this file

Days held at 2–8 °C, doses protected, unit cost, and who pays after the warranty. Those numbers are not measured here. They belong on the one-page impact estimate, with empty cells left empty.
