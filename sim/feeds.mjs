// Illustrative sites. Points are not surveyed facilities.
// GeoJSON coordinates are [longitude, latitude].

export const ROUTE = {
  dispatch: [
    [36.8524, -1.3192],
    [36.9800, -1.3800],
    [37.1200, -1.4500],
    [37.2630, -1.5170]
  ]
};

const SITES = {
  clinic: [
    room("vaccine", "Vaccine cabinet", "Rural post", [34.7682, 0.5144], {
      script: "hold", band: [2, 8], temp: 4.6, rh: 48, watts: 72, runW: 80, volts: 232
    }),
    room("oxy", "Oxytocin cabinet", "Rural post", [34.7688, 0.5148], {
      script: "door", band: [2, 8], temp: 11.4, rh: 74, watts: 96, runW: 85, volts: 227,
      doorMs: 22 * 60000
    }),
    room("insulin", "Insulin box", "Rural post", [34.7676, 0.5140], {
      script: "freeze", band: [2, 8], temp: 1.1, rh: 45, watts: 3, runW: 70, volts: 231, freeze: 2
    })
  ],
  landing: [
    room("ice", "Ice hold", "Landing", [39.8491, -3.6362], {
      script: "hold", band: [-1, 2], temp: 0.4, rh: 88, watts: 180, runW: 220, volts: 228
    }),
    room("day", "Day catch", "Landing", [39.8502, -3.6354], {
      script: "door", band: [0, 4], temp: 7.8, rh: 80, watts: 240, runW: 200, volts: 226,
      doorMs: 35 * 60000
    }),
    room("blast", "Blast", "Landing", [39.8482, -3.6370], {
      script: "hold", band: [-22, -15], temp: -18.4, rh: 70, watts: 1320, runW: 1400, volts: 229
    })
  ],
  packhouse: [
    room("leaf", "Leafy room", "Packhouse", [36.4355, -0.7354], {
      script: "dry", band: [0, 2], temp: 1.1, rh: 61, watts: 310, runW: 400, volts: 230
    }),
    room("tomato", "Tomato room", "Packhouse", [36.4364, -0.7346], {
      script: "hold", band: [10, 13], temp: 11.6, rh: 86, watts: 260, runW: 380, volts: 231
    }),
    room("out", "Market cooler", "Packhouse", [36.4346, -0.7362], {
      script: "outage", band: [4, 8], temp: 6.4, rh: 78, watts: 0, runW: 350, volts: 0
    })
  ],
  dispatch: [
    room("hub", "Hub vaccines", "Dispatch hub", [36.8524, -1.3192], {
      script: "hold", band: [2, 8], temp: 5.1, rh: 52, watts: 110, runW: 120, volts: 230
    }),
    room("blood", "Blood bay", "Dispatch hub", [36.8532, -1.3186], {
      script: "door", band: [2, 6], temp: 8.6, rh: 70, watts: 140, runW: 130, volts: 227,
      doorMs: 16 * 60000
    }),
    room("route", "Route shipper", "Route 4 · passive", [36.9400, -1.3600], {
      script: "warm", band: [2, 8], temp: 13.2, rh: 58, watts: 0, volts: null,
      powerExpected: false, along: 0.18
    })
  ]
};

function room(id, name, place, coordinates, extra) {
  return Object.assign({
    id: id,
    name: name,
    place: place,
    coordinates: coordinates.slice(),
    door: extra.script === "door",
    doorMs: 0,
    wh: 0,
    hz: 50,
    powerExpected: true,
    along: 0
  }, extra);
}

export function createWorld() {
  const profiles = {};
  Object.keys(SITES).forEach(function (id) {
    profiles[id] = SITES[id].map(function (r) {
      const copy = Object.assign({}, r);
      copy.coordinates = r.coordinates.slice();
      return copy;
    });
  });
  return { profiles: profiles };
}

function pointOnLine(line, t) {
  const lens = [];
  let total = 0;
  let i;
  for (i = 1; i < line.length; i++) {
    const len = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    lens.push(len);
    total += len;
  }
  let dist = (t % 1) * total;
  for (i = 0; i < lens.length; i++) {
    if (dist <= lens[i] || i === lens.length - 1) {
      const u = lens[i] ? Math.min(1, dist / lens[i]) : 0;
      return [
        line[i][0] + (line[i + 1][0] - line[i][0]) * u,
        line[i][1] + (line[i + 1][1] - line[i][1]) * u
      ];
    }
    dist -= lens[i];
  }
  return line[line.length - 1];
}

function clampRh(n) {
  return Math.max(5, Math.min(99, n));
}

export function step(world, dt) {
  Object.keys(world.profiles).forEach(function (profileId) {
    world.profiles[profileId].forEach(function (room) {
      stepRoom(profileId, room, dt);
    });
  });
}

function stepRoom(profileId, room, dt) {
  const n = (Math.random() - 0.5) * 0.08;
  const mid = (room.band[0] + room.band[1]) / 2;
  if (room.script === "hold") {
    room.door = false;
    const cooling = room.temp > mid + 0.25;
    room.volts = room.band[0] < -10 ? 229 : 231;
    room.watts = cooling ? room.runW : Math.round(room.runW * 0.08);
    room.temp += ((cooling ? -0.04 : 0.02) + n) * dt;
    room.rh = clampRh(room.rh + (Math.random() - 0.5) * 0.3 * dt);
  } else if (room.script === "door") {
    room.door = true;
    room.volts = 226;
    room.watts = room.runW;
    const goal = room.band[1] + 3.5;
    room.temp += ((goal - room.temp) * 0.04 + n) * dt;
    room.rh = clampRh(Math.min(94, room.rh + 0.08 * dt));
  } else if (room.script === "freeze") {
    room.door = false;
    room.volts = 231;
    room.watts = 3;
    const pin = (room.freeze != null ? room.freeze : room.band[0]) - 0.9;
    room.temp += ((pin - room.temp) * 0.15 + n * 0.3) * dt;
    room.rh = clampRh(room.rh + n * dt);
  } else if (room.script === "dry") {
    room.door = false;
    room.volts = 230;
    room.watts = Math.round(room.runW * 0.55);
    room.temp += ((mid - room.temp) * 0.08 + n) * dt;
    room.rh += (61 - room.rh) * 0.08 * dt;
  } else if (room.script === "outage") {
    room.door = false;
    room.volts = 0;
    room.watts = 0;
    room.temp += (0.012 + Math.abs(n) * 0.05) * dt;
  } else if (room.script === "warm") {
    room.door = false;
    room.volts = null;
    room.watts = 0;
    const goal = room.band[1] + 5;
    room.temp += (goal - room.temp) * 0.03 * dt;
    const line = ROUTE[profileId];
    if (line) {
      room.along = (room.along + dt / 200) % 1;
      room.coordinates = pointOnLine(line, room.along);
    }
  }
  if (room.powerExpected !== false) room.wh += (room.watts || 0) * dt / 3600;
  if (room.door) room.doorMs += dt * 1000;
  else room.doorMs = 0;
}

function round(n, places) {
  if (n == null || Number.isNaN(n)) return undefined;
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

function feature(profileId, room, time) {
  const lng = round(room.coordinates[0], 5);
  const lat = round(room.coordinates[1], 5);
  const props = {
    profile: profileId,
    room: room.id,
    name: room.name,
    place: room.place,
    deviceId: "sim-" + profileId + "-" + room.id,
    illustrative: true,
    time: time,
    temperature_C: round(room.temp, 2),
    humidity_percent: round(room.rh, 1),
    door_open: !!room.door,
    door_open_duration_ms: Math.round(room.doorMs || 0),
    power_expected: room.powerExpected !== false,
    band_min_C: room.band[0],
    band_max_C: room.band[1]
  };
  if (room.powerExpected !== false) {
    props.WphA = round(room.watts || 0, 1);
    props.WphB = 0;
    props.WphC = 0;
    props.PhVphA = room.volts == null ? 0 : round(room.volts, 1);
    props.PhVphB = 0;
    props.PhVphC = 0;
    props.Hz = room.hz;
    props.TotWhImport = round(room.wh, 3);
  }
  return {
    type: "Feature",
    id: profileId + ":" + room.id,
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: props
  };
}

export function collection(world, profileId, time) {
  const features = world.profiles[profileId].map(function (room) {
    return feature(profileId, room, time);
  });
  const line = ROUTE[profileId];
  if (line) {
    features.push({
      type: "Feature",
      id: profileId + ":route",
      geometry: { type: "LineString", coordinates: line },
      properties: {
        profile: profileId,
        kind: "route",
        name: "Route 4",
        illustrative: true,
        time: time
      }
    });
  }
  return {
    type: "FeatureCollection",
    profile: profileId,
    illustrative: true,
    features: features
  };
}

export const PROFILE_IDS = Object.keys(SITES);
