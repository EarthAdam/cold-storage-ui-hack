/* Hold — operator desk for a cold room.
   Listens to MeshEMS MQTT. Does not command the relay.
   Topics (firmware include/core/config.h + mqtt_client.cpp):
     openami/<deviceId>/subpanel_ENV
     openami/<deviceId>/subpanel_3Ph
   Simulated trades (sim/publish.mjs), GeoJSON FeatureCollection:
     openami/geojson/<profile>
   ENV: temperature_C, humidity_percent, door_open, door_open_duration_ms, location_text
   3Ph: WphA/B/C in watts, PhVphA/B/C in volts, Hz, TotWhImport in watt-hours
   GeoJSON: Point coordinates [lng, lat], same fields on properties.
*/

const PLACES = {
  vaccine: [34.7682, 0.5144], oxy: [34.7688, 0.5148], insulin: [34.7676, 0.5140],
  ice: [39.84915, -3.63400], day: [39.84975, -3.63405], blast: [39.84855, -3.63408],
  leaf: [36.4355, -0.7354], tomato: [36.4364, -0.7346], out: [36.4346, -0.7362]
};

const STORE = "hold.geh.v1";

const PROFILES = {
  clinic: {
    label: "Clinic",
    blurb: "{band}. Freeze ruins stock the same as heat. Uptime is the job.",
    speakBand: [2, 8],
    currency: "USD",
    lines: {
      ok: "In band. Leave the lid shut.",
      freeze: "Too cold. Stop cooling. Freezing ruins these vaccines the same as heat. If it does not rise, call the person who repairs this cabinet.",
      doorHot: "The lid is open and the cabinet is warm. Close it. Stay until the temperature is back inside {band}.",
      outHot: "Power is gone and the cabinet is leaving the band. Keep the lid shut. Do not move stock to a kerosene fridge. Call the person who holds the repair.",
      hot: "Above the band. Check the lid, the ventilation, and whether the compressor is actually drawing power.",
      cold: "Under the band, not yet freezing. Watch it. Do not add extra ice against the vials.",
      outageSoon: "Power is out and holdover is short. Lid stays shut. Call repair before the clock ends.",
      outage: "Power is out. Stock is still inside the holdover window. Lid stays shut.",
      dry: "Air is drier than this room wants.",
      wet: "Air is wetter than this room wants. A stuck lid or a warm gasket does this.",
      door: "Lid is open. Close it. Every minute open spends holdover.",
      silent: "This board stopped reporting. Check the node before you trust the last temperature.",
      noprobe: "The board is on the topic, but temperature and humidity are still {zero} and 0 %. The probe is not live yet."
    },
    rooms: [
      roomSpec({
        id: "vaccine", name: "Vaccine cabinet", place: "Rural post",
        stock: "measles vaccines", qty: 800, unit: "doses", unitValue: 1.2,
        band: [2, 8], freeze: 2, freezeRuins: true, scale: [-2, 16],
        rh: 48, temp: 4.6, watts: 72, runW: 80, volts: 232,
        script: "hold", autonomyMin: 79 * 60, spoilMin: 40
      }),
      roomSpec({
        id: "oxy", name: "Oxytocin cabinet", place: "Rural post",
        stock: "oxytocin vials", qty: 120, unit: "vials", unitValue: 8,
        band: [2, 8], freeze: 2, freezeRuins: true, scale: [-2, 16],
        rh: 74, temp: 11.4, watts: 96, runW: 85, volts: 227,
        script: "door", excursionMin: 22, spoilMin: 40, autonomyMin: 79 * 60
      }),
      roomSpec({
        id: "insulin", name: "Insulin box", place: "Rural post",
        stock: "insulin vials", qty: 40, unit: "vials", unitValue: 14,
        band: [2, 8], freeze: 2, freezeRuins: true, scale: [-2, 16],
        rh: 45, temp: 1.1, watts: 3, runW: 70, volts: 231,
        script: "freeze", spoilMin: 20, autonomyMin: 79 * 60
      })
    ]
  },
  landing: {
    label: "Landing",
    blurb: "Ice, the day’s catch, and the blast. Heat is money leaving the hold.",
    currency: "KES",
    lines: {
      ok: "In band. Keep the hold closed between boats.",
      freeze: "Colder than this hold is meant to run.",
      doorHot: "The hatch is open and the catch is warming. Close it. Land the next boat into the ice hold, not this room.",
      outHot: "Power is gone and the hold is warming. Keep it sealed. Move nothing until ice or power is back.",
      hot: "Above the band. The catch is losing time. Check ice, hatch, and compressor load.",
      cold: "Colder than the band. Fine for a short spell on ice. Do not let fresh fish harden unless this is the blast.",
      outageSoon: "Power is out and the ice will not last. Seal the hatch and get ice or a generator on this room.",
      outage: "Power is out. Ice is still holding. Hatch stays shut.",
      dry: "Drier than this room wants.",
      wet: "Wetter than this room wants.",
      door: "Hatch is open. Close it between landings.",
      silent: "This board stopped reporting. Check it before you trust the hold.",
      noprobe: "Board is publishing, probe still reads {zero} and 0 %. Sensor is not live."
    },
    rooms: [
      roomSpec({
        id: "ice", name: "Ice hold", place: "Landing",
        stock: "fish on ice", qty: 600, unit: "kg", unitValue: 400,
        band: [-1, 2], freeze: null, scale: [-6, 12],
        rh: 88, temp: 0.4, watts: 180, runW: 220, volts: 228,
        script: "hold", autonomyMin: 180, spoilMin: 120,
        aside: "Boats land into this hold."
      }),
      roomSpec({
        id: "day", name: "Day catch", place: "Landing",
        stock: "today’s catch", qty: 180, unit: "kg", unitValue: 400,
        band: [0, 4], freeze: null, scale: [-2, 16],
        rh: 80, temp: 7.8, watts: 240, runW: 200, volts: 226,
        script: "door", excursionMin: 35, spoilMin: 90, autonomyMin: 90,
        aside: "Two boats are waiting on this room."
      }),
      roomSpec({
        id: "blast", name: "Blast", place: "Landing",
        stock: "frozen catch", qty: 90, unit: "kg", unitValue: 500,
        band: [-22, -15], freeze: null, scale: [-30, -8],
        rh: 70, temp: -18.4, watts: 1320, runW: 1400, volts: 229,
        script: "hold", autonomyMin: 240, spoilMin: 60
      })
    ]
  },
  packhouse: {
    label: "Packhouse",
    blurb: "Each crop has a band. Dry air wilts leaf. Power loss stalls the market run.",
    currency: "KES",
    lines: {
      ok: "In band. Leave the door shut between pallets.",
      freeze: "Too cold for this crop. Chill injury starts here.",
      doorHot: "Door is open and the room is warm. Close it. This crop does not get the next hour back.",
      outHot: "Power is gone and the room is leaving the band. Keep the door shut. The market run waits on this room.",
      hot: "Above the band. Check the door, the evaporator, and the load on this feeder.",
      cold: "Under the band. Too cold marks this crop.",
      outageSoon: "Power is out and holdover is short. Door stays shut. Sort what must leave for market first.",
      outage: "Power is out. The room is still in band. Door stays shut.",
      dry: "Air is too dry. Leaf wilts before the temperature moves. Check the door gasket and the humidifier.",
      wet: "Air is too wet for this crop. Condensation on the crates.",
      door: "Door is open. Close it between pallet moves.",
      silent: "This board stopped reporting. Check the node before you ship from this room.",
      noprobe: "Board is publishing, probe still reads 0. Do not ship on this reading."
    },
    rooms: [
      roomSpec({
        id: "leaf", name: "Leafy room", place: "Packhouse",
        stock: "leafy greens", qty: 80, unit: "crates", unitValue: 900,
        band: [0, 2], freeze: 0, freezeRuins: false, rhBand: [90, 98], scale: [-2, 12],
        rh: 61, temp: 1.1, watts: 310, runW: 400, volts: 230,
        script: "dry", dryMin: 50, spoilMin: 120, autonomyMin: 150
      }),
      roomSpec({
        id: "tomato", name: "Tomato room", place: "Packhouse",
        stock: "tomatoes", qty: 140, unit: "crates", unitValue: 700,
        band: [10, 13], freeze: null, rhBand: [80, 95], scale: [0, 20],
        rh: 86, temp: 11.6, watts: 260, runW: 380, volts: 231,
        script: "hold", autonomyMin: 180, spoilMin: 180
      }),
      roomSpec({
        id: "out", name: "Market cooler", place: "Packhouse",
        stock: "market load", qty: 40, unit: "crates", unitValue: 1100,
        band: [4, 8], freeze: null, scale: [0, 18],
        rh: 78, temp: 6.4, watts: 0, runW: 350, volts: 0,
        script: "outage", autonomyMin: 240, autonomyLeft: 26, spoilMin: 90,
        aside: "This load is the morning run."
      })
    ]
  }
};

function roomSpec(s) {
  return Object.assign({
    freeze: null,
    freezeRuins: false,
    rhBand: null,
    powerExpected: true,
    excursionMin: 0,
    dryMin: 0,
    autonomyLeft: null,
    aside: "",
    door: false
  }, s);
}

const state = {
  profileId: "clinic",
  rooms: [],
  selected: null,
  feed: [],
  unassigned: new Map(),
  lastRaw: "",
  mqtt: "off",
  client: null,
  inbox: {},
  inboxNoted: {},
  route: null,
  unit: "C"
};

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; }
  catch (e) { return {}; }
}
function saveStore() {
  const prev = loadStore();
  const binds = prev.binds || {};
  state.rooms.forEach(function (r) {
    binds[state.profileId + ":" + r.id] = r.deviceId || "";
  });
  const broker = {
    url: val("broker-url"),
    user: val("broker-user"),
    pass: val("broker-pass"),
    prefix: val("broker-prefix")
  };
  localStorage.setItem(STORE, JSON.stringify({
    profileId: state.profileId,
    selected: state.selected,
    binds: binds,
    broker: broker,
    unit: state.unit
  }));
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function buildRooms(profileId) {
  const store = loadStore();
  const binds = store.binds || {};
  return PROFILES[profileId].rooms.map(function (spec) {
    const room = {
      id: spec.id,
      name: spec.name,
      place: spec.place,
      stock: spec.stock,
      qty: spec.qty,
      unit: spec.unit,
      unitValue: spec.unitValue,
      band: { min: spec.band[0], max: spec.band[1] },
      freeze: spec.freeze,
      freezeRuins: spec.freezeRuins,
      rhBand: spec.rhBand ? { min: spec.rhBand[0], max: spec.rhBand[1] } : null,
      scale: { min: spec.scale[0], max: spec.scale[1] },
      rh: spec.rh,
      temp: spec.temp,
      watts: spec.watts,
      phases: [spec.watts || 0, 0, 0],
      runW: spec.runW,
      volts: spec.volts,
      hz: 50,
      script: spec.script,
      powerExpected: spec.powerExpected !== false,
      powerKnown: spec.powerExpected !== false,
      powerLive: false,
      envLive: false,
      excursionMin: spec.excursionMin || 0,
      dryMin: spec.dryMin || 0,
      autonomyMin: spec.autonomyMin,
      autonomyLeft: spec.autonomyLeft == null ? spec.autonomyMin : spec.autonomyLeft,
      spoilMin: spec.spoilMin,
      aside: spec.aside || "",
      door: spec.script === "door",
      doorSince: spec.script === "door" ? Date.now() : 0,
      lastOpenMs: 0,
      lng: PLACES[spec.id] ? PLACES[spec.id][0] : null,
      lat: PLACES[spec.id] ? PLACES[spec.id][1] : null,
      along: spec.id === "route" ? 0.18 : 0,
      source: "sim",
      probe: true,
      deviceId: binds[profileId + ":" + spec.id] || "",
      lastSeen: 0,
      wh: 0,
      whBase: null,
      inBand: 0,
      samplesN: 0,
      spark: []
    };
    room.spark.push(sampleNow(room));
    room.spark.push(sampleNow(room));
    return room;
  });
}

function profile() { return PROFILES[state.profileId]; }

function selectedRoom() {
  return state.rooms.filter(function (r) { return r.id === state.selected; })[0] || state.rooms[0];
}

function judge(room) {
  if (room.temp == null || Number.isNaN(room.temp)) {
    return { level: "watch", key: "noprobe" };
  }
  const frozen = room.freeze != null && room.temp < room.freeze;
  const hot = room.temp > room.band.max;
  const cold = room.temp < room.band.min && !frozen;
  const powerOut = room.powerExpected && room.powerKnown && room.volts != null && room.volts < 40;
  const heard = room.envLive || room.powerLive;
  const silent = heard && room.lastSeen && (Date.now() - room.lastSeen > 120000);
  const dry = room.rhBand && room.rh < room.rhBand.min;
  const wet = room.rhBand && room.rh > room.rhBand.max;
  const doorMin = room.doorSince ? (Date.now() - room.doorSince) / 60000 : 0;
  if (silent) return { level: "act", key: "silent" };
  if (room.envLive && !room.probe) return { level: "watch", key: "noprobe" };
  if (frozen) return { level: "act", key: "freeze" };
  if (hot && room.door) return { level: "act", key: "doorHot" };
  if (hot && powerOut) return { level: "act", key: "outHot" };
  if (hot) return { level: "act", key: "hot" };
  if (cold) return { level: "watch", key: "cold" };
  if (powerOut && room.autonomyLeft <= 30) return { level: "act", key: "outageSoon" };
  if (powerOut) return { level: "watch", key: "outage" };
  if (dry) return { level: "watch", key: "dry" };
  if (wet) return { level: "watch", key: "wet" };
  if (room.door && doorMin >= 2) return { level: "watch", key: "door" };
  return { level: "safe", key: "ok" };
}

function riskFraction(room, sit) {
  if (sit.key === "silent" || sit.key === "noprobe") return 0;
  if (sit.key === "freeze") return room.freezeRuins ? 1 : 0.35;
  if (room.temp > room.band.max) return Math.min(1, room.excursionMin / room.spoilMin);
  if (sit.key === "dry") return Math.min(0.6, room.dryMin / room.spoilMin);
  if ((sit.key === "outage" || sit.key === "outageSoon") && room.autonomyLeft <= 0) {
    return Math.min(1, Math.max(room.excursionMin, 1) / room.spoilMin);
  }
  return 0;
}

function money(amount) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: profile().currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch (e) {
    return profile().currency + " " + Math.round(amount);
  }
}

function toDisplay(c) {
  if (c == null || Number.isNaN(c)) return null;
  return state.unit === "F" ? (c * 9 / 5) + 32 : c;
}

function unitSuffix() {
  return state.unit === "F" ? "°F" : "°C";
}

function deg(n) {
  const v = toDisplay(n);
  if (v == null) return "—";
  return v.toFixed(1) + unitSuffix();
}

function bandPhrase(min, max) {
  const a = toDisplay(min);
  const b = toDisplay(max);
  if (a == null || b == null) return "—";
  return a.toFixed(1) + "–" + b.toFixed(1) + unitSuffix();
}

function fill(text, room) {
  const span = room ? [room.band.min, room.band.max] : profile().speakBand;
  return String(text)
    .replaceAll("{band}", span ? bandPhrase(span[0], span[1]) : "")
    .replaceAll("{zero}", deg(0));
}

function mins(m) {
  if (m == null || Number.isNaN(m)) return "—";
  if (m < 1) return Math.max(0, Math.round(m * 60)) + " s";
  if (m < 90) return Math.round(m) + " min";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h + " h " + r + " min";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function note(text) {
  state.feed.unshift({ t: Date.now(), text: text });
  if (state.feed.length > 6) state.feed.length = 6;
}

function setSimPower(room, volts, watts) {
  if (room.powerLive) return;
  room.volts = volts;
  room.watts = watts;
  room.phases = [watts || 0, 0, 0];
  room.powerKnown = room.powerExpected && volts != null;
  if (room.powerExpected) room.hz = volts != null && volts > 40 ? 50 : 0;
}

var CLINIC_DOORS = {
  front: [8.05, 8.70, 9.40, 10.15, 11.00, 11.80, 12.55, 13.40, 14.20, 15.00, 15.75, 16.45],
  vaccine: [8.35, 9.90, 11.40, 13.90, 15.40, 16.85],
  oxy: [9.10, 10.55, 12.20, 14.60, 16.10]
};
window.CLINIC_DOORS = CLINIC_DOORS;
var simPrev = 6;

function sun01(h) {
  const x = Math.sin(((h - 6) / 12) * Math.PI);
  return x > 0 ? x : 0;
}

function onSpan(h, from, to) {
  const len = (to - from + 24) % 24;
  const at = (h - from + 24) % 24;
  return at <= len + 1e-6;
}

function spanFrac(h, from, to) {
  const len = (to - from + 24) % 24;
  if (!len) return null;
  const at = (h - from + 24) % 24;
  if (at > len) return null;
  return at / len;
}

function markIn(prev, h, marks) {
  return marks.some(function (at) {
    if (h >= prev) return at > prev && at <= h;
    return at > prev || at <= h;
  });
}

function ease(current, goal, simMin, tau) {
  if (goal == null || Number.isNaN(goal)) return current;
  if (current == null || Number.isNaN(current)) return goal;
  const k = 1 - Math.exp(-Math.max(0, simMin) / tau);
  return current + (goal - current) * k;
}

function lidOpen(h, marks) {
  return marks.some(function (at) {
    return ((h - at + 24) % 24) <= 0.18;
  });
}

function setClinicCall(room, h, night) {
  room.callMessage = "";
  room.callWho = "";
  if (room.id === "insulin") return;
  const out = room.temp != null && (room.temp > room.band.max || room.temp < room.band.min);
  if (night && out) {
    room.callWho = "Nurse";
    room.callMessage = "Move the vaccines now.";
    return;
  }
  if (room.door) {
    room.callWho = "Staff";
    room.callMessage = room.id === "oxy" ? "Close the oxytocin lid." : "Close the vaccine lid.";
    return;
  }
  if (out) {
    room.callWho = "Technician";
    room.callMessage = "Cabinet left the safe band. Check it in daylight.";
  }
}

function applyDay(room, prev, h, simMin) {
  const step = simMin == null ? 1 : simMin;
  const sun = sun01(h);
  const night = sun < 0.08;
  const id = state.profileId;
  const rise = 22;
  const fall = 48;
  if (id === "clinic") {
    const marks = room.id === "vaccine" ? CLINIC_DOORS.vaccine : room.id === "oxy" ? CLINIC_DOORS.oxy : null;
    const open = marks ? lidOpen(h, marks) : false;
    if (room.id === "insulin") {
      room.door = false;
      room.temp = 1.05 + sun * 0.35;
      room.rh = 46;
      setSimPower(room, night ? 208 : 230, night ? 22 : 8);
    } else {
      const mid = (room.band.min + room.band.max) / 2;
      const shut = mid - 0.2 + sun * 0.8;
      const hot = room.id === "oxy" ? 11.2 : 7.4;
      room.door = open;
      room.temp = ease(room.temp, open ? hot : shut, step, open ? rise : fall);
      room.rh = ease(room.rh, open ? 76 : 50, step, open ? rise : fall);
      setSimPower(room, night ? 208 : 230, open || sun > 0.45 ? room.runW : Math.round(room.runW * 0.12));
    }
    room.autonomyLeft = room.autonomyMin;
    if (!room.callLive) setClinicCall(room, h, night);
    return;
  }
  if (id === "landing") {
    const off = onSpan(h, 5.5, 7.2) || onSpan(h, 10.2, 11.6);
    if (room.id === "ice") {
      room.door = off;
      room.temp = ease(room.temp, off ? 1.6 : 0.3, step, off ? rise : fall);
      room.rh = 88;
      setSimPower(room, night ? 210 : 229, off || sun > 0.3 ? room.runW : Math.round(room.runW * 0.2));
    } else if (room.id === "day") {
      room.door = off;
      room.temp = ease(room.temp, off ? 7.6 : 1.4, step, off ? rise : fall);
      room.rh = ease(room.rh, off ? 86 : 78, step, off ? rise : fall);
      setSimPower(room, night ? 210 : 228, off ? room.runW : Math.round(room.runW * 0.25));
    } else {
      room.door = false;
      room.temp = -18.6 + sun * 0.5;
      room.rh = 70;
      setSimPower(room, night ? 212 : 229, night ? Math.round(room.runW * 0.45) : room.runW);
    }
    room.autonomyLeft = room.autonomyMin;
    return;
  }
  if (id === "packhouse") {
    if (room.id === "leaf") {
      const open = onSpan(h, 7, 9);
      const base = 0.6 + sun * 1.5;
      room.door = open;
      room.temp = ease(room.temp, open ? base + 4.2 : base, step, open ? rise : fall);
      const wet = onSpan(h, 10, 16) ? 58 : (onSpan(h, 6, 10) ? 74 : 82);
      room.rh = ease(room.rh, wet, step, 40);
      setSimPower(room, night ? 210 : 230, sun > 0.25 ? room.runW : Math.round(room.runW * 0.3));
      room.autonomyLeft = room.autonomyMin;
    } else if (room.id === "tomato") {
      room.door = false;
      room.temp = 11.1 + sun * 1.5;
      room.rh = 90 - sun * 8;
      setSimPower(room, night ? 210 : 231, sun > 0.25 ? room.runW : Math.round(room.runW * 0.22));
      room.autonomyLeft = room.autonomyMin;
    } else {
      const lost = onSpan(h, 12, 16);
      const truck = onSpan(h, 14, 18.5);
      const f = spanFrac(h, 12, 16);
      room.door = truck;
      var goal;
      if (lost) {
        setSimPower(room, 0, 0);
        room.autonomyLeft = Math.max(0, room.autonomyMin * (1 - f));
        goal = 6.2 + f * 6;
      } else {
        setSimPower(room, 230, truck ? room.runW : Math.round(room.runW * 0.3));
        room.autonomyLeft = room.autonomyMin;
        goal = truck ? 8.4 : 6.1;
      }
      room.temp = ease(room.temp, goal, step, truck || lost ? rise : fall);
      room.rh = 78;
    }
  }
}

var curvePack = null;
var curveKey = "";

function dayCurve(room) {
  var ghost = {
    id: room.id,
    band: room.band,
    runW: room.runW,
    autonomyMin: room.autonomyMin,
    powerExpected: room.powerExpected,
    temp: null,
    rh: null
  };
  var i;
  var h;
  var prev;
  for (i = 0; i < 96; i++) {
    h = (i / 96) * 24;
    prev = (h - 0.25 + 24) % 24;
    applyDay(ghost, prev, h, 15);
  }
  var pts = [];
  for (i = 0; i < 96; i++) {
    h = (i / 96) * 24;
    prev = (h - 0.25 + 24) % 24;
    applyDay(ghost, prev, h, 15);
    pts.push({
      h: h,
      temp: ghost.temp,
      rh: ghost.rh,
      w: room.powerExpected ? (ghost.watts || 0) : null,
      v: room.powerExpected ? ghost.volts : null,
      door: ghost.door ? 1 : 0
    });
  }
  return pts;
}

window.HoldCurves = function () {
  var key = state.profileId;
  if (!curvePack || curveKey !== key) {
    curveKey = key;
    curvePack = {
      profile: state.profileId,
      rooms: state.rooms.map(function (room) {
        return { id: room.id, name: room.name, pts: dayCurve(room) };
      })
    };
  }
  var room = selectedRoom();
  curvePack.selected = room ? room.id : "";
  curvePack.unit = state.unit;
  return curvePack;
};

function tickRoom(room, prev, h, simMin) {
  const live = room.envLive || room.powerLive;
  if (!live) applyDay(room, prev, h, simMin);
  else if (state.profileId === "clinic" && !room.callLive) {
    const realBoard = room.deviceId && room.deviceId.indexOf("sim-") !== 0;
    if (!realBoard) setClinicCall(room, h, sun01(h) < 0.08);
  }
  age(room, live ? 1 / 60 : simMin, live);
  pushSample(room);
}

function age(room, simMin, live) {
  const dt = simMin;
  const outside = room.temp != null && (room.temp > room.band.max || room.temp < room.band.min);
  if (outside) room.excursionMin += dt;
  else room.excursionMin = 0;
  if (room.rhBand && room.rh < room.rhBand.min) room.dryMin += dt;
  else room.dryMin = 0;
  const powerOut = room.powerExpected && room.powerKnown && room.volts != null && room.volts < 40;
  if (live && powerOut) room.autonomyLeft = Math.max(0, room.autonomyLeft - dt);
  if (!room.powerLive && room.powerExpected) room.wh += (room.watts || 0) * (dt * 60) / 3600;
  if (room.door) {
    if (!room.doorSince) room.doorSince = Date.now();
  } else {
    room.doorSince = 0;
  }
  if (room.rh != null) room.rh = Math.max(5, Math.min(99, room.rh));
}

function sampleNow(room) {
  const sit = judge(room);
  const inBandNow = room.temp != null && room.temp >= room.band.min && room.temp <= room.band.max ? 1 : 0;
  return {
    temp: room.temp,
    rh: room.rh,
    door: room.door ? 1 : 0,
    w: room.powerExpected ? (room.watts || 0) : null,
    v: room.powerExpected ? room.volts : null,
    hz: room.powerExpected ? room.hz : null,
    wh: room.powerExpected ? (room.wh || 0) : null,
    band: inBandNow,
    risk: room.qty * room.unitValue * riskFraction(room, sit),
    hold: room.powerExpected ? room.autonomyLeft : null
  };
}

function pushSample(room) {
  room.spark.push(sampleNow(room));
  if (room.spark.length > 120) room.spark.shift();
  if (room.temp == null) return;
  room.samplesN += 1;
  const ok = room.temp >= room.band.min && room.temp <= room.band.max;
  if (ok) room.inBand += 1;
}

function bandPct(room) {
  if (!room.samplesN) return null;
  return Math.round(100 * room.inBand / room.samplesN);
}

function supplyLine(room) {
  if (!room.powerExpected) return "No mains on this leg";
  if (!room.powerKnown) return "Waiting for subpanel_3Ph";
  if (room.volts != null && room.volts < 40) return "Supply lost";
  if ((room.watts || 0) >= 25) return "Compressor drawing";
  return "Idle, supply present";
}

function pct(n, span, value) {
  return Math.max(0, Math.min(100, ((value - n) / span) * 100));
}

function ruler(room) {
  const span = room.scale.max - room.scale.min || 1;
  const bandL = pct(room.scale.min, span, room.band.min);
  const bandR = pct(room.scale.min, span, room.band.max);
  const mark = pct(room.scale.min, span, room.temp == null ? room.band.min : room.temp);
  let freeze = "";
  if (room.freeze != null && room.freeze > room.scale.min) {
    const w = pct(room.scale.min, span, room.freeze);
    freeze = '<div class="freeze" style="width:' + w.toFixed(1) + '%"></div>';
  }
  return (
    '<div class="ruler" aria-hidden="true">' +
      freeze +
      '<div class="zone" style="left:' + bandL.toFixed(1) + '%;width:' + Math.max(0, bandR - bandL).toFixed(1) + '%"></div>' +
      '<div class="mark" style="left:calc(' + mark.toFixed(1) + '% - 2px)"></div>' +
    '</div>' +
    '<div class="caps"><span>' + esc(deg(room.scale.min)) + '</span><span>' +
      esc(bandPhrase(room.band.min, room.band.max)) + '</span><span>' + esc(deg(room.scale.max)) + '</span></div>'
  );
}

function chart(samples, spec) {
  const W = 640;
  const H = 52;
  const L = 4;
  const R = 4;
  const T = 5;
  const B = 5;
  const n = 120;
  const span = (spec.max - spec.min) || 1;
  const yOf = function (v) { return T + (1 - (v - spec.min) / span) * (H - T - B); };
  const xOf = function (i) {
    const slot = n - samples.length + i;
    return L + (slot / (n - 1)) * (W - L - R);
  };
  let inner = "";
  if (spec.band) {
    const hi = Math.min(spec.max, spec.band[1]);
    const lo = Math.max(spec.min, spec.band[0]);
    const yTop = yOf(hi);
    const yBot = yOf(lo);
    inner += '<rect class="tl-band" x="' + L + '" y="' + yTop.toFixed(1) + '" width="' + (W - L - R) + '" height="' + Math.max(0, yBot - yTop).toFixed(1) + '"/>';
  }
  if (spec.step) {
    const slotW = (W - L - R) / (n - 1);
    samples.forEach(function (s, i) {
      const v = s[spec.key];
      if (v == null || Number.isNaN(v) || v <= spec.min) return;
      const yy = yOf(Math.min(spec.max, v));
      const y0 = yOf(spec.min);
      inner += '<rect class="tl-step" x="' + (xOf(i) - slotW / 2).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + Math.max(1.2, slotW).toFixed(1) + '" height="' + Math.max(0, y0 - yy).toFixed(1) + '"/>';
    });
  } else {
    let seg = [];
    function flush() {
      if (seg.length > 1) inner += '<polyline class="tl-line" points="' + seg.join(" ") + '" style="stroke:' + spec.stroke + '"/>';
      seg = [];
    }
    samples.forEach(function (s, i) {
      const v = s[spec.key];
      if (v == null || Number.isNaN(v)) flush();
      else seg.push(xOf(i).toFixed(1) + "," + yOf(Math.max(spec.min, Math.min(spec.max, v))).toFixed(1));
    });
    flush();
  }
  return '<figure class="tl"><figcaption><span>' + esc(spec.label) + '</span><b>' + esc(spec.now) + '</b></figcaption><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + inner + '</svg></figure>';
}

function renderTimelines() {
  const host = document.getElementById("timelines");
  const head = document.getElementById("tl-head");
  if (!host) return;
  const room = selectedRoom();
  const samples = room.spark;
  const last = samples[samples.length - 1] || {};
  const power = room.powerExpected;
  const specs = [
    { key: "temp", label: "Temperature " + unitSuffix(), min: room.scale.min, max: room.scale.max, band: [room.band.min, room.band.max], now: deg(room.temp), stroke: "#7dcea0" },
    { key: "rh", label: "Humidity", min: 0, max: 100, band: room.rhBand ? [room.rhBand.min, room.rhBand.max] : null, now: room.rh == null ? "—" : Math.round(room.rh) + "%", stroke: "#7eb0c8" },
    { key: "door", label: "Door", min: 0, max: 1, step: true, now: room.door ? "Open" : "Shut", stroke: "#d5ddd6" },
    { key: "w", label: "Power", min: 0, max: Math.max(room.runW * 1.5, 80), power: true, now: power && room.watts != null ? Math.round(room.watts) + " W" : "No mains", stroke: "#e0a84a" },
    { key: "v", label: "Volts", min: 0, max: 260, band: power ? [200, 250] : null, power: true, now: power && room.volts != null ? Math.round(room.volts) + " V" : "No mains", stroke: "#e0a84a" },
    { key: "hz", label: "Frequency", min: 45, max: 65, power: true, now: power && room.hz ? room.hz.toFixed(1) + " Hz" : "No mains", stroke: "#93a399" },
    { key: "wh", label: "Energy", min: 0, max: Math.max(1, last.wh || 0, room.wh || 0), power: true, now: power ? (room.wh || 0).toFixed(2) + " Wh" : "No mains", stroke: "#e0a84a" },
    { key: "band", label: "In band", min: 0, max: 1, step: true, now: last.band ? "Yes" : "No", stroke: "#7dcea0" },
    { key: "hold", label: "Holdover", min: 0, max: Math.max(room.autonomyMin || 1, 1), power: true, now: power ? mins(room.autonomyLeft) : "Passive", stroke: "#7eb0c8" },
    { key: "risk", label: "Stock at risk", min: 0, max: Math.max(room.qty * room.unitValue, 1), now: money(last.risk || 0), stroke: "#e36b52" }
  ];
  if (head) {
    head.textContent = room.name + (room.envLive ? " · last two minutes" : " · fast 06:00–10:00, then slow") +
      " · band drawn where a safe range exists";
  }
  host.innerHTML = specs.map(function (spec) {
    if (spec.power && !power) {
      return '<figure class="tl"><figcaption><span>' + esc(spec.label) + '</span><b>' + esc(spec.now) + '</b></figcaption><p class="tl-empty">No mains on this leg.</p></figure>';
    }
    return chart(samples, spec);
  }).join("");
}

function planFill(room) {
  if (room.temp == null) return "#24302a";
  if (room.freeze != null && room.temp < room.freeze) return "#2a3a4e";
  const sit = judge(room);
  if (sit.level === "act") return "#4a2a24";
  if (sit.level === "watch") return "#3f341c";
  return "#1e3a30";
}

function fillFor(room) {
  if (room.temp == null) return "#e6e0d6";
  if (room.freeze != null && room.temp < room.freeze) return "#c5d4e8";
  const sit = judge(room);
  if (sit.level === "act") return "#f0b2a4";
  if (sit.level === "watch") return "#f3ddb0";
  return "#cfe3d6";
}

function dollRooms() {
  return state.rooms.map(function (room) {
    const rh = room.rh == null ? "—" : Math.round(room.rh) + "%";
    const w = room.powerExpected && room.watts != null ? Math.round(room.watts) + " W" : "passive";
    return {
      id: room.id,
      name: room.name,
      stock: room.stock,
      temp: deg(room.temp),
      sub: rh + " · " + w,
      fill: planFill(room),
      open: !!room.door,
      picked: room.id === state.selected,
      fan: !!(room.powerExpected && room.volts != null && room.volts > 40 && (room.watts || 0) >= 25),
      cold: !!(room.freeze != null && room.temp < room.freeze),
      hot: !!(room.temp != null && room.temp > room.band.max),
      live: !!(room.powerExpected && room.volts != null && room.volts > 40)
    };
  });
}

function paintPlan() {
  const host = document.getElementById("plan");
  if (!host || !window.HoldPlan) return;
  const world = state.profileId === "clinic" || state.profileId === "packhouse";
  if (world) {
    if (!window.HoldDoll) {
      if (host.getAttribute("data-profile") !== "world-wait") {
        host.setAttribute("data-profile", "world-wait");
        host.textContent = "";
        host.classList.add("doll-live");
      }
      return;
    }
    host.setAttribute("data-profile", state.profileId);
    window.HoldDoll.onPick = function (id) {
      state.selected = id;
      state.look = id;
      saveStore();
      render();
    };
    window.HoldDoll.sync(host, state.profileId, dollRooms());
    return;
  }
  if (window.HoldDoll) window.HoldDoll.stop();
  if (host.getAttribute("data-profile") !== state.profileId) {
    host.setAttribute("data-profile", state.profileId);
    host.innerHTML = window.HoldPlan.markup(state.profileId);
  }
  const anyLive = state.rooms.some(function (r) { return r.powerExpected && r.volts != null && r.volts > 40; });
  host.querySelectorAll(".bus").forEach(function (bus) {
    bus.classList.toggle("live", anyLive);
    bus.classList.toggle("dead", !anyLive);
  });
  state.rooms.forEach(function (room) {
    const g = host.querySelector('[data-room="' + room.id + '"]');
    if (!g) return;
    const powered = room.powerExpected && room.volts != null && room.volts > 40;
    g.classList.toggle("open", !!room.door);
    g.classList.toggle("picked", room.id === state.selected);
    g.classList.toggle("cold", room.freeze != null && room.temp < room.freeze);
    g.classList.toggle("hot", room.temp != null && room.temp > room.band.max);
    g.classList.toggle("dry", !!(room.rhBand && room.rh < room.rhBand.min));
    const fan = g.querySelector(".fan");
    if (fan) fan.classList.toggle("on", powered && (room.watts || 0) >= 25);
    const feeder = g.querySelector(".feeder");
    if (feeder) {
      feeder.classList.toggle("live", powered);
      feeder.classList.toggle("dead", room.powerExpected && !powered);
    }
    const fill = g.querySelector(".zone-fill");
    if (fill) fill.style.fill = planFill(room);
    const mist = g.querySelector(".mist");
    if (mist) mist.setAttribute("opacity", room.rh == null ? 0 : Math.max(0, Math.min(0.42, room.rh / 100 * 0.45)).toFixed(2));
    const readout = g.querySelector(".readout");
    if (readout) readout.textContent = deg(room.temp);
    const sub = g.querySelector(".subread");
    if (sub) {
      const rh = room.rh == null ? "—" : Math.round(room.rh) + "%";
      const w = room.powerExpected && room.watts != null ? Math.round(room.watts) + " W" : "passive";
      sub.textContent = rh + " · " + w;
    }
  });
  const dock = host.querySelector("#dock");
  const market = state.rooms.filter(function (r) { return r.id === "out"; })[0];
  if (dock && market) dock.classList.toggle("open", !!market.door || (market.temp != null && market.temp > market.band.max));
}

function fact(label, value) {
  return '<li><span class="lbl">' + esc(label) + '</span><strong>' + esc(value) + '</strong></li>';
}

function renderSwitch() {
  const host = document.getElementById("switch");
  host.innerHTML = Object.keys(PROFILES).map(function (id) {
    const on = id === state.profileId;
    return '<button type="button" data-profile="' + id + '" aria-pressed="' + on + '">' +
      esc(PROFILES[id].label) + '</button>';
  }).join("");
}

function renderUnit() {
  document.querySelectorAll("#unit [data-unit]").forEach(function (btn) {
    btn.setAttribute("aria-pressed", btn.getAttribute("data-unit") === state.unit ? "true" : "false");
  });
}

function feedName(room) {
  const live = room.envLive || room.powerLive;
  if (!live) return "sim";
  if (room.deviceId && room.deviceId.indexOf("sim-") === 0) return "geojson";
  if (room.envLive && room.powerLive) return "board";
  if (room.envLive) return "temp live";
  return "power live";
}

function coordText(room) {
  if (room.lng == null || room.lat == null) return "";
  const ns = room.lat >= 0 ? "N" : "S";
  const ew = room.lng >= 0 ? "E" : "W";
  return " · " + Math.abs(room.lat).toFixed(4) + "° " + ns + ", " + Math.abs(room.lng).toFixed(4) + "° " + ew;
}

function renderStrip() {
  let act = 0;
  let watch = 0;
  let risk = 0;
  let inB = 0;
  let n = 0;
  let wh = 0;
  state.rooms.forEach(function (room) {
    const sit = judge(room);
    if (sit.level === "act") act += 1;
    else if (sit.level === "watch") watch += 1;
    risk += room.qty * room.unitValue * riskFraction(room, sit);
    inB += room.inBand;
    n += room.samplesN;
    wh += room.wh || 0;
  });
  const uptime = n ? Math.round(100 * inB / n) + "% in band" : "in band —";
  const bits = [];
  bits.push(act ? act + (act === 1 ? " room needs a person" : " rooms need a person") : "No room needs a person");
  if (watch) bits.push(watch + " to watch");
  bits.push(money(risk) + " at risk");
  bits.push(uptime);
  bits.push((wh / 1000).toFixed(2) + " kWh on this desk");
  document.getElementById("strip").textContent = bits.join("  ·  ");
  document.getElementById("blurb").textContent = fill(profile().blurb, null);
}

function renderRooms() {
  const ranked = state.rooms.slice().sort(function (a, b) {
    const order = { act: 0, watch: 1, safe: 2 };
    const d = order[judge(a).level] - order[judge(b).level];
    if (d) return d;
    return a.name.localeCompare(b.name);
  });
  document.getElementById("rooms").innerHTML = ranked.map(function (room) {
    const sit = judge(room);
    const src = feedName(room);
    return '<button type="button" class="room ' + sit.level + '" data-room="' + esc(room.id) + '" aria-current="' +
      (room.id === state.selected) + '"><span class="lvl ' + sit.level + '">' + esc(sit.level) + ' · ' + esc(src) +
      '</span><span class="name">' + esc(room.name) + '</span><span class="meta">' + esc(deg(room.temp)) +
      ' · ' + esc(fill(profile().lines[sit.key], room).split(".")[0]) + '</span></button>';
  }).join("");

  const box = document.getElementById("unassigned");
  if (!state.unassigned.size) {
    box.innerHTML = "";
    return;
  }
  let html = "";
  state.unassigned.forEach(function (u, id) {
    const t = u.temp == null ? "probe not live" : deg(u.temp);
    html += '<button type="button" data-assign="' + esc(id) + '">Board ' + esc(id) + ' · ' + esc(t) +
      ' · assign to the open room</button>';
  });
  box.innerHTML = html;
}

function renderDetail() {
  const room = selectedRoom();
  const sit = judge(room);
  const doorMin = room.doorSince ? (Date.now() - room.doorSince) / 60000 : 0;
  let doorTxt = "Shut";
  if (room.door) doorTxt = "Open " + mins(doorMin);
  else if (room.lastOpenMs) doorTxt = "Shut · last open " + mins(room.lastOpenMs / 60000);
  const pctIn = bandPct(room);
  const risk = room.qty * room.unitValue * riskFraction(room, sit);
  const rhTxt = room.rh == null ? "—" : Math.round(room.rh) + "%";
  let hold = "—";
  if (room.powerExpected && room.powerKnown && room.volts != null && room.volts < 40) hold = mins(room.autonomyLeft) + " left";
  else if (room.powerExpected) hold = mins(room.autonomyMin) + " if power drops";
  else hold = "Passive";

  const phaseTxt = room.phases.map(function (w, i) {
    return "phase " + "ABC"[i] + " " + Math.round(w) + " W";
  }).join(" · ");

  document.getElementById("detail-body").innerHTML =
    '<p class="kicker ' + sit.level + '">' + esc(sit.level) + " · " + esc(sit.key) + '</p>' +
    '<h2>' + esc(room.name) + '</h2>' +
    '<p class="place">' + esc(room.place) + coordText(room) + (room.deviceId ? " · " + esc(room.deviceId) : " · no board bound") + '</p>' +
    '<p class="temp ' + sit.level + '">' + (toDisplay(room.temp) == null ? "—" : toDisplay(room.temp).toFixed(1)) + '<span class="unit">' + esc(unitSuffix()) + '</span></p>' +
    ruler(room) +
    '<p class="action">' + esc(fill(profile().lines[sit.key], room)) + '</p>' +
    '<ul class="facts">' +
      fact("Humidity", rhTxt) +
      fact("Door", doorTxt) +
      fact("Power", room.powerExpected && room.powerKnown && room.watts != null ? Math.round(room.watts) + " W" : "—") +
      fact("Supply", supplyLine(room)) +
      fact("Time in band", pctIn == null ? "—" : pctIn + "%") +
      fact("Stock at risk", money(risk)) +
      fact("Holdover", hold) +
      fact(room.stock, room.qty + " " + room.unit) +
    '</ul>' +
    (room.aside ? '<p class="aside">' + esc(room.aside) + '</p>' : "");

  const phases = document.getElementById("phases");
  if (phases) {
    phases.textContent = phaseTxt +
      (room.volts == null ? "" : " · " + Math.round(room.volts) + " V") +
      (room.hz ? " · " + room.hz.toFixed(1) + " Hz" : "");
  }
  const raw = document.getElementById("raw");
  if (raw) raw.textContent = state.lastRaw || "No MQTT payload yet. The floor is simulated.";
  const input = document.getElementById("bind");
  if (input && document.activeElement !== input) input.value = room.deviceId || "";
}

function renderFeed() {
  document.getElementById("feed").innerHTML = state.feed.map(function (item) {
    return "<li>" + esc(item.text) + "</li>";
  }).join("");
}

function renderCall() {
  const el = document.getElementById("call");
  if (!el) return;
  const rank = { Nurse: 0, Staff: 1, Technician: 2 };
  const rooms = state.rooms.filter(function (room) { return room.callMessage; });
  rooms.sort(function (a, b) {
    return (rank[a.callWho] == null ? 9 : rank[a.callWho]) - (rank[b.callWho] == null ? 9 : rank[b.callWho]);
  });
  const room = rooms[0];
  if (!room) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.querySelector(".call-who").textContent = room.callWho || "Act";
  el.querySelector(".call-msg").textContent = room.callMessage;
  const real = room.callLive && room.deviceId && room.deviceId.indexOf("sim-") !== 0;
  el.querySelector(".call-src").textContent = real
    ? room.name + " · from the board"
    : room.name + " · illustrative day · the phone would say this";
}

function renderChip() {
  const chip = document.getElementById("link-chip");
  const liveRooms = state.rooms.filter(function (r) { return r.envLive || r.powerLive; });
  const board = liveRooms.some(function (r) { return !r.deviceId || r.deviceId.indexOf("sim-") !== 0; });
  const geo = liveRooms.some(function (r) { return r.deviceId && r.deviceId.indexOf("sim-") === 0; });
  if (board && (state.mqtt === "on" || liveRooms.length)) chip.textContent = "Board live";
  else if (geo) chip.textContent = "GeoJSON live";
  else if (state.mqtt === "on") chip.textContent = "Broker connected";
  else if (state.mqtt === "try") chip.textContent = "Connecting";
  else chip.textContent = "Simulated floor";
}

function paintScene() {
  if (!window.HoldScene) return;
  HoldScene.sync({
    profileId: state.profileId,
    route: null,
    look: state.look || null,
    rooms: state.rooms.map(function (room) {
      return {
        id: room.id,
        name: room.name,
        lng: room.lng,
        lat: room.lat,
        fill: fillFor(room),
        text: deg(room.temp),
        selected: room.id === state.selected,
        door: !!room.door
      };
    })
  });
  state.look = null;
}

var stageWorld = null;

function placeStage(world) {
  if (stageWorld === world) return;
  stageWorld = world;
  var fit = document.getElementById("fit");
  var day = document.getElementById("day");
  var plan = document.getElementById("plan");
  var scene = document.querySelector(".scene-wrap");
  var detail = document.getElementById("detail");
  var body = document.getElementById("detail-body");
  if (!fit || !day || !plan || !scene || !detail) return;
  if (world) {
    fit.insertBefore(plan, day);
    if (body) detail.insertBefore(scene, body);
    else detail.appendChild(scene);
  } else {
    fit.insertBefore(scene, day);
    if (body) detail.insertBefore(plan, body);
    else detail.appendChild(plan);
  }
  requestAnimationFrame(function () { window.dispatchEvent(new Event("resize")); });
}

function render() {
  var detail = document.getElementById("detail");
  var world = state.profileId === "clinic" || state.profileId === "packhouse";
  if (detail) {
    detail.classList.toggle("in-clinic", state.profileId === "clinic");
    detail.classList.toggle("has-world", world);
  }
  placeStage(world);
  document.body.setAttribute("data-trade", state.profileId);
  renderStrip();
  renderUnit();
  paintPlan();
  renderRooms();
  renderDetail();
  renderTimelines();
  renderFeed();
  renderChip();
  renderCall();
  paintScene();
  if (window.HoldDay) HoldDay.paint(state.profileId);
}

function rememberLevel() {
  state.rooms.forEach(function (room) {
    const sit = judge(room);
    if (room._key && room._key !== sit.key) {
      note(room.name + " → " + sit.key.replace(/([A-Z])/g, " $1").toLowerCase());
    }
    room._key = sit.key;
  });
}

function findBound(deviceId) {
  return state.rooms.filter(function (r) { return r.deviceId === deviceId; })[0] || null;
}

function applyMaintenance(target, msg) {
  if (!msg || !Object.prototype.hasOwnProperty.call(msg, "maintenance")) return;
  const m = msg.maintenance;
  if (m == null || m.message == null || String(m.message).trim() === "") {
    target.callMessage = "";
    target.callWho = "";
    target.callLive = false;
    return;
  }
  target.callMessage = String(m.message).slice(0, 180);
  target.callWho = m.who ? String(m.who).slice(0, 40) : "";
  target.callLive = true;
}

function applyEnv(target, msg) {
  applyMaintenance(target, msg);
  const empty = Number(msg.temperature_C) === 0 && Number(msg.humidity_percent) === 0;
  target.lastSeen = Date.now();
  if (empty || msg.temperature_C == null) return;
  target.temp = Number(msg.temperature_C);
  target.rh = Number(msg.humidity_percent);
  target.probe = true;
  target.envLive = true;
  if ("door_open" in msg) {
    const open = !!msg.door_open;
    if (open && !target.door) target.doorSince = Date.now();
    if (!open) target.doorSince = 0;
    target.door = open;
  }
  if (msg.door_open_duration_ms != null) target.lastOpenMs = Number(msg.door_open_duration_ms);
  if (msg.location_text && msg.location_text !== "North_Pole" && msg.location_text !== "Unknown Location") {
    target.place = msg.location_text;
  }
}

function applyPower(target, msg) {
  const a = Number(msg.WphA) || 0;
  const b = Number(msg.WphB) || 0;
  const c = Number(msg.WphC) || 0;
  target.phases = [a, b, c];
  target.watts = a + b + c;
  const volts = [msg.PhVphA, msg.PhVphB, msg.PhVphC].map(Number).filter(function (v) { return !Number.isNaN(v); });
  if (volts.length) target.volts = volts.find(function (v) { return v > 40; }) || volts[0];
  if (msg.Hz != null) target.hz = Number(msg.Hz);
  if (msg.TotWhImport != null) {
    const tot = Number(msg.TotWhImport);
    if (target.whBase == null) target.whBase = tot;
    target.wh = Math.max(0, tot - target.whBase);
  }
  target.powerKnown = true;
  target.powerLive = true;
  target.lastSeen = Date.now();
}

function shadow() {
  return {
    temp: null, rh: null, door: false, watts: null, volts: null, phases: [0, 0, 0],
    probe: false, envLive: false, powerLive: false, place: "", lastSeen: 0,
    powerKnown: false, powerExpected: true, wh: 0, whBase: null,
    band: { min: 0, max: 0 }, freeze: null, autonomyLeft: 0, rhBand: null, doorSince: 0, lastOpenMs: 0,
    callMessage: "", callWho: "", callLive: false
  };
}

function applyGeoJSON(msg) {
  const features = msg.type === "Feature" ? [msg] : (msg.features || []);
  if (!features.length) return;
  const profileId = msg.profile || (features[0].properties && features[0].properties.profile);
  if (!profileId || !PROFILES[profileId]) return;
  state.inbox[profileId] = msg;
  if (profileId !== state.profileId) {
    if (!state.inboxNoted[profileId]) {
      state.inboxNoted[profileId] = true;
      note(PROFILES[profileId].label + " GeoJSON is on the broker.");
    }
    return;
  }
  features.forEach(function (f) {
    const p = f.properties || {};
    const geom = f.geometry || {};
    if (geom.type === "LineString") {
      state.route = { profile: profileId, coordinates: geom.coordinates };
      return;
    }
    if (geom.type !== "Point" || !p.room) return;
    const room = state.rooms.filter(function (r) { return r.id === p.room; })[0];
    if (!room) return;
    if (room.deviceId && room.deviceId.indexOf("sim-") !== 0 && (room.envLive || room.powerLive)) return;
    if (geom.coordinates && geom.coordinates.length >= 2) {
      room.lng = Number(geom.coordinates[0]);
      room.lat = Number(geom.coordinates[1]);
    }
    if (p.place) room.place = p.place;
    if (p.deviceId && (!room.deviceId || room.deviceId.indexOf("sim-") === 0)) room.deviceId = p.deviceId;
    if (p.power_expected === false) {
      room.powerExpected = false;
      room.powerLive = false;
      room.powerKnown = false;
      room.volts = null;
      room.watts = 0;
    } else if (p.WphA != null || p.watts != null) {
      room.powerExpected = true;
      applyPower(room, {
        WphA: p.WphA != null ? p.WphA : p.watts,
        WphB: p.WphB || 0,
        WphC: p.WphC || 0,
        PhVphA: p.PhVphA,
        PhVphB: p.PhVphB,
        PhVphC: p.PhVphC,
        Hz: p.Hz,
        TotWhImport: p.TotWhImport
      });
    }
    if (p.temperature_C != null) applyEnv(room, p);
    if (p.door_open && p.door_open_duration_ms) {
      room.doorSince = Date.now() - Number(p.door_open_duration_ms);
    }
  });
}

function ingest(topic, raw) {
  state.lastRaw = topic + "\n" + raw;
  let msg;
  try { msg = JSON.parse(raw); }
  catch (e) { note("Bad JSON on " + topic); return; }
  if (msg && (msg.type === "FeatureCollection" || msg.type === "Feature")) {
    applyGeoJSON(msg);
    render();
    return;
  }
  const parts = topic.split("/").filter(Boolean);
  const at = parts.indexOf("openami");
  const base = at >= 0 ? at : 0;
  if (parts.length < base + 3) return;
  const deviceId = parts[base + 1];
  const sub = parts[base + 2];
  if (sub !== "subpanel_ENV" && sub !== "subpanel_3Ph") return;
  let target = findBound(deviceId);
  let created = false;
  if (!target) {
    if (!state.unassigned.has(deviceId)) {
      state.unassigned.set(deviceId, shadow());
      created = true;
    }
    target = state.unassigned.get(deviceId);
  }
  if (sub === "subpanel_ENV") applyEnv(target, msg);
  else applyPower(target, msg);
  if (created) note("Board " + deviceId + " is publishing. Assign it to a room.");
  render();
}

function adopt(deviceId) {
  const room = selectedRoom();
  const u = state.unassigned.get(deviceId);
  state.rooms.forEach(function (r) {
    if (r !== room && r.deviceId === deviceId) r.deviceId = "";
  });
  room.deviceId = deviceId;
  if (u && u.envLive) {
    room.temp = u.temp;
    room.rh = u.rh;
    room.door = u.door;
    room.doorSince = u.doorSince;
    room.envLive = true;
    room.probe = true;
  }
  if (u && u.powerLive) {
    room.watts = u.watts;
    room.volts = u.volts;
    room.phases = u.phases.slice();
    room.powerKnown = true;
    room.powerLive = true;
    room.wh = u.wh || 0;
    room.whBase = u.whBase;
  }
  if (u && u.place) room.place = u.place;
  if (u && u.callLive) {
    room.callMessage = u.callMessage;
    room.callWho = u.callWho;
    room.callLive = true;
  }
  room.lastSeen = Date.now();
  state.unassigned.delete(deviceId);
  note(room.name + " bound to " + deviceId);
  saveStore();
  render();
}

function connectMqtt() {
  if (!window.mqtt) {
    document.getElementById("link-status").textContent = "MQTT library did not load. Open this folder over http, or stay on the simulated floor.";
    return;
  }
  disconnectMqtt(true);
  const url = val("broker-url");
  const prefix = val("broker-prefix") || "openami";
  state.mqtt = "try";
  renderChip();
  const client = window.mqtt.connect(url, {
    username: val("broker-user"),
    password: val("broker-pass"),
    clientId: "hold-" + Math.random().toString(16).slice(2, 8),
    reconnectPeriod: 4000,
    connectTimeout: 8000
  });
  state.client = client;
  client.on("connect", function () {
    state.mqtt = "on";
    client.subscribe(prefix.replace(/\/$/, "") + "/#");
    document.getElementById("link-status").textContent = "Connected. Subscribed to " + prefix + "/#";
    note("Broker connected.");
    saveStore();
    render();
  });
  client.on("message", function (topic, buf) {
    ingest(topic, buf.toString());
  });
  client.on("error", function (err) {
    document.getElementById("link-status").textContent = err && err.message ? err.message : "MQTT error";
  });
  client.on("close", function () {
    if (state.client === client && state.mqtt === "on") {
      state.mqtt = "off";
      renderChip();
    }
  });
}

function disconnectMqtt(quiet) {
  if (state.client) {
    try { state.client.end(true); } catch (e) { /* already closed */ }
    state.client = null;
  }
  state.mqtt = "off";
  if (!quiet) {
    document.getElementById("link-status").textContent = "Disconnected. Rooms without a live board fall back to the simulated floor.";
    render();
  }
}

function boot() {
  const store = loadStore();
  if (store.broker) {
    if (store.broker.url) document.getElementById("broker-url").value = store.broker.url;
    if (store.broker.user) document.getElementById("broker-user").value = store.broker.user;
    if (store.broker.pass) document.getElementById("broker-pass").value = store.broker.pass;
    if (store.broker.prefix) document.getElementById("broker-prefix").value = store.broker.prefix;
  }
  state.profileId = PROFILES[store.profileId] ? store.profileId : "clinic";
  state.unit = store.unit === "F" ? "F" : "C";
  state.rooms = buildRooms(state.profileId);
  state.selected = state.rooms.some(function (r) { return r.id === store.selected; }) ? store.selected : state.rooms[0].id;
  renderSwitch();
  if (window.HoldScene) {
    HoldScene.attach(
      document.getElementById("scene"),
      document.getElementById("scene-labels"),
      document.getElementById("scene-meta"),
      document.getElementById("scene-wide")
    );
    HoldScene.onPick = function (id) {
      state.selected = id;
      state.look = id;
      saveStore();
      render();
    };
  }
  note("Simulated floor. A MeshEMS board replaces a room when you bind its id.");
  rememberLevel();
  render();
  var detail = document.getElementById("detail");
  function showScene() {
    if (detail) detail.scrollTop = 0;
  }
  showScene();
  requestAnimationFrame(showScene);
  window.addEventListener("load", showScene);

  document.getElementById("unit").addEventListener("click", function (ev) {
    const btn = ev.target.closest("[data-unit]");
    if (!btn) return;
    state.unit = btn.getAttribute("data-unit") === "F" ? "F" : "C";
    saveStore();
    render();
  });

  document.getElementById("switch").addEventListener("click", function (ev) {
    const btn = ev.target.closest("[data-profile]");
    if (!btn) return;
    const next = btn.getAttribute("data-profile");
    if (next === state.profileId) return;
    state.profileId = next;
    if (window.HoldDay && HoldDay.restart) HoldDay.restart();
    simPrev = window.HoldDay ? HoldDay.hour() : 6;
    state.rooms = buildRooms(state.profileId);
    if (state.inbox[state.profileId]) applyGeoJSON(state.inbox[state.profileId]);
    state.selected = state.rooms[0].id;
    renderSwitch();
    note(profile().label + " floor.");
    rememberLevel();
    saveStore();
    render();
  });

  document.getElementById("rooms").addEventListener("click", function (ev) {
    const btn = ev.target.closest("[data-room]");
    if (!btn) return;
    state.selected = btn.getAttribute("data-room");
    state.look = state.selected;
    saveStore();
    render();
  });

  document.getElementById("plan").addEventListener("click", function (ev) {
    const zone = ev.target.closest("[data-room]");
    if (!zone) return;
    state.selected = zone.getAttribute("data-room");
    state.look = state.selected;
    saveStore();
    render();
  });

  document.getElementById("unassigned").addEventListener("click", function (ev) {
    const btn = ev.target.closest("[data-assign]");
    if (!btn) return;
    adopt(btn.getAttribute("data-assign"));
  });

  document.getElementById("bind-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const room = selectedRoom();
    const id = document.getElementById("bind").value.trim();
    state.rooms.forEach(function (r) {
      if (r !== room && r.deviceId === id) r.deviceId = "";
    });
    room.deviceId = id;
    if (!id) {
      room.envLive = false;
      room.powerLive = false;
      room.powerKnown = room.powerExpected;
      room.probe = true;
      note(room.name + " unbound. Simulated floor again.");
    } else if (state.unassigned.has(id)) {
      adopt(id);
      return;
    } else {
      note(room.name + " will take " + id + " when it publishes.");
    }
    saveStore();
    render();
  });

  document.getElementById("link-open").addEventListener("click", function () {
    document.getElementById("link").showModal();
  });
  document.getElementById("link-close").addEventListener("click", function () {
    document.getElementById("link").close();
  });
  document.getElementById("link-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    connectMqtt();
  });
  document.getElementById("link-stop").addEventListener("click", function () {
    disconnectMqtt(false);
  });

  setInterval(function () {
    const h = window.HoldDay ? window.HoldDay.hour() : 0;
    let d = h - simPrev;
    if (d < 0) d += 24;
    const simMin = d * 60;
    state.rooms.forEach(function (room) { tickRoom(room, simPrev, h, simMin); });
    simPrev = h;
    rememberLevel();
    render();
  }, 1000);
}

window.HoldRepaint = render;
boot();
