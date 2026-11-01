/* Listen-only log for the MeshEMS broker.
   The static site can be closed. This process keeps the publishes.
   Each row hashes the row before it, so a later check can see an edit.
   It does not publish, and it does not send a relay command.

   node log/record.mjs
   node log/record.mjs --check
   node log/record.mjs --verify
   node log/record.mjs --query --device StreetPoleEMS_abc --kind env --since 2026-10-31
*/

import net from "net";
import http from "http";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const GENESIS = "0".repeat(64);

function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "";
}

function mqttStr(s) {
  const b = Buffer.from(String(s));
  const h = Buffer.alloc(2);
  h.writeUInt16BE(b.length);
  return Buffer.concat([h, b]);
}

function encodeLen(len) {
  const out = [];
  do {
    let digit = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) digit |= 0x80;
    out.push(digit);
  } while (len > 0);
  return Buffer.from(out);
}

function connectPacket(clientId, user, pass) {
  const head = [mqttStr("MQTT"), Buffer.from([0x04, user ? 0xc2 : 0x02, 0x00, 60]), mqttStr(clientId)];
  if (user) head.push(mqttStr(user), mqttStr(pass || ""));
  const body = Buffer.concat(head);
  return Buffer.concat([Buffer.from([0x10]), encodeLen(body.length), body]);
}

function subscribePacket(topic, id) {
  const body = Buffer.concat([
    Buffer.from([(id >> 8) & 0xff, id & 0xff]),
    mqttStr(topic),
    Buffer.from([0])
  ]);
  return Buffer.concat([Buffer.from([0x82]), encodeLen(body.length), body]);
}

function takePacket(buf) {
  if (buf.length < 2) return null;
  let value = 0;
  let multiplier = 1;
  let i = 1;
  let byte = 0;
  do {
    if (i >= buf.length) return null;
    byte = buf[i++];
    value += (byte & 127) * multiplier;
    multiplier *= 128;
    if (multiplier > 128 ** 4) return null;
  } while (byte & 128);
  const total = i + value;
  if (buf.length < total) return null;
  return {
    type: buf[0] >> 4,
    flags: buf[0] & 0x0f,
    header: i,
    packet: buf.subarray(0, total),
    rest: buf.subarray(total)
  };
}

function readStr(buf, at) {
  if (at + 2 > buf.length) return null;
  const n = buf.readUInt16BE(at);
  const start = at + 2;
  const end = start + n;
  if (end > buf.length) return null;
  return { text: buf.subarray(start, end).toString("utf8"), next: end };
}

export function decodePublish(packet) {
  const qos = (packet.flags >> 1) & 0x03;
  const topic = readStr(packet.packet, packet.header);
  if (!topic) return null;
  let next = topic.next;
  let id = null;
  if (qos > 0) {
    if (next + 2 > packet.packet.length) return null;
    id = packet.packet.readUInt16BE(next);
    next += 2;
  }
  if (next > packet.packet.length) return null;
  return {
    topic: topic.text,
    body: packet.packet.subarray(next).toString("utf8"),
    qos: qos,
    id: id
  };
}

export function classify(topic) {
  const parts = String(topic || "").split("/").filter(Boolean);
  if (!parts.length || parts[0] === "$SYS") return null;
  if (parts[0] === "openami") {
    if (parts[1] === "geojson") return { device: parts[2] || "geojson", kind: "geojson" };
    const device = parts[1] || "unknown";
    const sub = parts.slice(2).join("/");
    if (!sub) return { device: device, kind: "other" };
    if (sub === "subpanel_ENV" || sub.endsWith("/env")) return { device: device, kind: "env" };
    if (sub === "subpanel_3Ph" || sub.endsWith("/power")) return { device: device, kind: "power" };
    if (sub === "door") return { device: device, kind: "door" };
    if (sub === "cmd" || sub.endsWith("/cmd")) return { device: device, kind: "cmd" };
    return { device: device, kind: parts[parts.length - 1] };
  }
  const device = parts.length > 1 ? parts[0] + "/" + parts[1] : parts[0];
  return { device: device, kind: parts.length > 2 ? parts[parts.length - 1] : "other" };
}

function num(v) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function blankFields() {
  return {
    temperature_C: null, humidity_percent: null, door_open: null, watts: null, volts: null,
    v_a: null, v_b: null, v_c: null, w_a: null, w_b: null, w_c: null,
    ma_a: null, ma_b: null, ma_c: null, hz: null, kwh: null, alarm: null
  };
}

function sumNums(list) {
  const known = list.filter(function (v) { return v != null; });
  return known.length ? known.reduce(function (a, b) { return a + b; }, 0) : null;
}

function fields(kind, body) {
  const out = blankFields();
  let msg = null;
  try { msg = JSON.parse(body); } catch (e) { msg = null; }
  if (!msg || typeof msg !== "object") return out;
  if (kind === "env" || num(msg.temperature_C) != null || num(msg.humidity_percent) != null) {
    out.temperature_C = num(msg.temperature_C);
    out.humidity_percent = num(msg.humidity_percent);
    if (typeof msg.door_open === "boolean") out.door_open = msg.door_open ? 1 : 0;
  }
  const legacyW = [num(msg.WphA), num(msg.WphB), num(msg.WphC)];
  const legacyV = [num(msg.PhVphA), num(msg.PhVphB), num(msg.PhVphC)].filter(function (v) { return v != null; });
  if (legacyW.some(function (v) { return v != null; })) out.watts = sumNums(legacyW);
  if (legacyV.length) out.volts = Math.min.apply(null, legacyV);
  const ph = msg.phases;
  if (ph && (ph.A || ph.B || ph.C)) {
    out.v_a = num(ph.A && ph.A.voltage_ln);
    out.v_b = num(ph.B && ph.B.voltage_ln);
    out.v_c = num(ph.C && ph.C.voltage_ln);
    out.w_a = num(ph.A && ph.A.real_power_w);
    out.w_b = num(ph.B && ph.B.real_power_w);
    out.w_c = num(ph.C && ph.C.real_power_w);
    const vs = [out.v_a, out.v_b, out.v_c].filter(function (v) { return v != null; });
    if (vs.length) out.volts = Math.min.apply(null, vs);
    const watts = sumNums([out.w_a, out.w_b, out.w_c]);
    if (watts != null) out.watts = watts;
    out.hz = num(msg.totals && msg.totals.frequency_avg);
    if (out.hz == null) out.hz = num(ph.A && ph.A.frequency);
    out.kwh = sumNums([
      num(ph.A && ph.A.energy_kwh),
      num(ph.B && ph.B.energy_kwh),
      num(ph.C && ph.C.energy_kwh)
    ]);
  }
  const sensors = msg.sensors;
  if (sensors && (sensors.A || sensors.B || sensors.C) &&
      (sensors.A && (sensors.A.leakage_ma != null || sensors.A.alarm != null) ||
       sensors.B && (sensors.B.leakage_ma != null || sensors.B.alarm != null) ||
       sensors.C && (sensors.C.leakage_ma != null || sensors.C.alarm != null))) {
    out.ma_a = num(sensors.A && sensors.A.leakage_ma);
    out.ma_b = num(sensors.B && sensors.B.leakage_ma);
    out.ma_c = num(sensors.C && sensors.C.leakage_ma);
    out.alarm = [sensors.A, sensors.B, sensors.C].some(function (s) { return s && s.alarm; }) ? 1 : 0;
  }
  if (typeof msg.leakage_alarm_active === "boolean") out.alarm = msg.leakage_alarm_active ? 1 : 0;
  if (Array.isArray(msg.probes)) {
    const probe = msg.probes.filter(function (p) { return p && (num(p.temperature_C) != null || num(p.humidity_percent) != null); })[0];
    if (probe) {
      out.temperature_C = num(probe.temperature_C);
      out.humidity_percent = num(probe.humidity_percent);
    }
  }
  return out;
}

function rowHash(prev, ts, topic, body) {
  return createHash("sha256").update(prev + "\n" + ts + "\n" + topic + "\n" + body).digest("hex");
}

export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 4000");
  db.exec(`CREATE TABLE IF NOT EXISTS msg (
    id INTEGER PRIMARY KEY,
    ts INTEGER NOT NULL,
    topic TEXT NOT NULL,
    device TEXT NOT NULL,
    kind TEXT NOT NULL,
    temperature_C REAL,
    humidity_percent REAL,
    door_open INTEGER,
    watts REAL,
    volts REAL,
    body TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    row_hash TEXT NOT NULL
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS msg_device_ts ON msg(device, ts)");
  db.exec("CREATE INDEX IF NOT EXISTS msg_kind_ts ON msg(kind, ts)");
  const have = db.prepare("PRAGMA table_info(msg)").all().map(function (col) { return col.name; });
  [
    ["v_a", "REAL"], ["v_b", "REAL"], ["v_c", "REAL"],
    ["w_a", "REAL"], ["w_b", "REAL"], ["w_c", "REAL"],
    ["ma_a", "REAL"], ["ma_b", "REAL"], ["ma_c", "REAL"],
    ["hz", "REAL"], ["kwh", "REAL"], ["alarm", "INTEGER"]
  ].forEach(function (col) {
    if (have.indexOf(col[0]) < 0) db.exec("ALTER TABLE msg ADD COLUMN " + col[0] + " " + col[1]);
  });
  return db;
}

export function accept(db, topic, body, ts) {
  const slot = classify(topic);
  if (!slot) return null;
  const tip = db.prepare("SELECT row_hash FROM msg ORDER BY id DESC LIMIT 1").get();
  const prev = tip ? tip.row_hash : GENESIS;
  const hash = rowHash(prev, ts, topic, body);
  const f = fields(slot.kind, body);
  db.prepare(`INSERT INTO msg (
    ts, topic, device, kind, temperature_C, humidity_percent, door_open, watts, volts,
    v_a, v_b, v_c, w_a, w_b, w_c, ma_a, ma_b, ma_c, hz, kwh, alarm,
    body, prev_hash, row_hash
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    ts, topic, slot.device, slot.kind,
    f.temperature_C, f.humidity_percent, f.door_open, f.watts, f.volts,
    f.v_a, f.v_b, f.v_c, f.w_a, f.w_b, f.w_c, f.ma_a, f.ma_b, f.ma_c, f.hz, f.kwh, f.alarm,
    body, prev, hash
  );
  return { device: slot.device, kind: slot.kind, hash: hash };
}

export function verify(db) {
  const rows = db.prepare("SELECT id, ts, topic, body, prev_hash, row_hash FROM msg ORDER BY id").all();
  let prev = GENESIS;
  let i;
  for (i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.prev_hash !== prev) return { ok: false, id: row.id, n: rows.length };
    const hash = rowHash(prev, row.ts, row.topic, row.body);
    if (hash !== row.row_hash) return { ok: false, id: row.id, n: rows.length };
    prev = hash;
  }
  return { ok: true, n: rows.length, tip: prev };
}

function when(value) {
  if (value == null || value === "") return null;
  if (/^\d+$/.test(String(value))) return Number(value);
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

export function ask(db, q) {
  const where = [];
  const bind = [];
  if (q.device) { where.push("device = ?"); bind.push(q.device); }
  if (q.kind) { where.push("kind = ?"); bind.push(q.kind); }
  const since = when(q.since);
  const until = when(q.until);
  if (since != null) { where.push("ts >= ?"); bind.push(since); }
  if (until != null) { where.push("ts <= ?"); bind.push(until); }
  if (q.min_c != null && q.min_c !== "") { where.push("temperature_C >= ?"); bind.push(Number(q.min_c)); }
  if (q.max_c != null && q.max_c !== "") { where.push("temperature_C <= ?"); bind.push(Number(q.max_c)); }
  if (q.door === "0" || q.door === "1") { where.push("door_open = ?"); bind.push(Number(q.door)); }
  const limit = Math.min(1000, Math.max(1, Number(q.limit) || 100));
  bind.push(limit);
  const sql = "SELECT id, ts, topic, device, kind, temperature_C, humidity_percent, door_open, watts, volts, body FROM msg" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY ts DESC, id DESC LIMIT ?";
  return db.prepare(sql).all(...bind);
}

function latest(db, device) {
  const env = db.prepare("SELECT id, ts, topic, temperature_C, humidity_percent, door_open, body FROM msg WHERE device = ? AND kind = 'env' ORDER BY id DESC LIMIT 1").get(device);
  const power = db.prepare("SELECT id, ts, topic, watts, volts, body FROM msg WHERE device = ? AND kind = 'power' ORDER BY id DESC LIMIT 1").get(device);
  const n = db.prepare("SELECT COUNT(*) AS n, MAX(ts) AS ts FROM msg WHERE device = ?").get(device);
  return { device: device, n: n ? n.n : 0, ts: n ? n.ts : null, env: env || null, power: power || null };
}

export function coverage(db, now) {
  const at = now || Date.now();
  const rows = db.prepare("SELECT device, kind, ts FROM msg").all();
  if (!rows.length) return { now: at, minTs: null, maxTs: null, minAge: 1000, maxAge: 60000, edges: [], lanes: [] };
  let minTs = rows[0].ts;
  let maxTs = rows[0].ts;
  rows.forEach(function (row) {
    if (row.ts < minTs) minTs = row.ts;
    if (row.ts > maxTs) maxTs = row.ts;
  });
  const minAge = 1000;
  const maxAge = Math.max(60 * 1000, at - minTs, minAge * 10);
  const span = Math.log(maxAge / minAge);
  const n = Math.max(8, Math.min(32, Math.round(span / Math.log(10) * 6)));
  const edges = [];
  let i;
  for (i = 0; i <= n; i++) edges.push(minAge * Math.exp(span * i / n));
  const lanes = new Map();
  rows.forEach(function (row) {
    const key = row.device + "\0" + row.kind;
    let lane = lanes.get(key);
    if (!lane) {
      lane = { device: row.device, kind: row.kind, n: 0, minTs: row.ts, maxTs: row.ts, bins: new Array(n).fill(0) };
      lanes.set(key, lane);
    }
    lane.n += 1;
    if (row.ts < lane.minTs) lane.minTs = row.ts;
    if (row.ts > lane.maxTs) lane.maxTs = row.ts;
    let age = at - row.ts;
    if (age < minAge) age = minAge;
    if (age > maxAge) age = maxAge;
    let idx = Math.floor(n * Math.log(age / minAge) / span);
    if (idx < 0) idx = 0;
    if (idx >= n) idx = n - 1;
    lane.bins[idx] += 1;
  });
  return {
    now: at,
    minTs: minTs,
    maxTs: maxTs,
    minAge: minAge,
    maxAge: maxAge,
    edges: edges,
    lanes: Array.from(lanes.values()).sort(function (a, b) {
      return b.maxTs - a.maxTs || String(a.device).localeCompare(String(b.device)) || String(a.kind).localeCompare(String(b.kind));
    })
  };
}

function devices(db) {
  return db.prepare(`SELECT device, COUNT(*) AS n, MAX(ts) AS ts
    FROM msg WHERE kind != 'geojson' GROUP BY device ORDER BY ts DESC`).all().map(function (row) {
    return latest(db, row.device);
  });
}

function selfCheck() {
  const file = path.join(here, "self-check.sqlite");
  fs.rmSync(file, { force: true });
  fs.rmSync(file + "-wal", { force: true });
  fs.rmSync(file + "-shm", { force: true });
  const topic = "openami/StreetPoleEMS_test/subpanel_ENV";
  const body = JSON.stringify({ temperature_C: 5.5, humidity_percent: 48, door_open: false });
  const packet = Buffer.concat([
    Buffer.from([0x30]),
    encodeLen(mqttStr(topic).length + Buffer.from(body).length),
    mqttStr(topic),
    Buffer.from(body)
  ]);
  const decoded = decodePublish(takePacket(packet));
  if (!decoded || decoded.topic !== topic || decoded.body !== body) throw new Error("publish decode failed");
  if (classify("openami/x/cmd").kind !== "cmd") throw new Error("cmd should be stored");
  const cold = classify("nesl_coldems/NESL_test/COLDAMI/mains");
  if (!cold || cold.kind !== "mains" || cold.device !== "nesl_coldems/NESL_test") throw new Error("coldems mains should be stored");
  const renamed = classify("nesl_coldems/NESL_test/COLD-EMS/mains");
  if (!renamed || renamed.kind !== "mains") throw new Error("COLD-EMS mains leaf should be stored");
  if (classify("$SYS/broker/version")) throw new Error("$SYS should be dropped");
  const db = openDb(file);
  accept(db, topic, body, 1000);
  accept(db, "openami/StreetPoleEMS_test/subpanel_3Ph", JSON.stringify({ WphA: 40, WphB: 10, PhVphA: 230, PhVphB: 228 }), 2000);
  const chain = verify(db);
  if (!chain.ok || chain.n !== 2) throw new Error("chain should hold 2 rows");
  accept(db, "nesl_coldems/NESL_test/coldems/mains", JSON.stringify({
    phases: {
      A: { voltage_ln: 230, real_power_w: 40, energy_kwh: 1.5, frequency: 60 },
      B: { voltage_ln: 12, real_power_w: 0, energy_kwh: 0 },
      C: { voltage_ln: 228, real_power_w: 5, energy_kwh: 0.2 }
    },
    totals: { frequency_avg: 60 }
  }), 3000);
  const mains = db.prepare("SELECT v_a, v_b, v_c, watts, hz, kwh FROM msg WHERE kind = 'mains'").get();
  if (!mains || mains.v_a !== 230 || mains.v_b !== 12 || mains.watts !== 45 || mains.hz !== 60) {
    throw new Error("mains columns missed");
  }
  const hot = ask(db, { device: "StreetPoleEMS_test", kind: "env", min_c: 5, max_c: 6 });
  if (hot.length !== 1) throw new Error("query missed the env row");
  accept(db, topic, body, Date.now() - 5000);
  const cov = coverage(db);
  const envLane = cov.lanes.filter(function (lane) { return lane.kind === "env"; })[0];
  const filled = envLane.bins.reduce(function (sum, n) { return sum + n; }, 0);
  if (filled !== 2) throw new Error("coverage dropped rows");
  if (envLane.bins.filter(function (n) { return n > 0; }).length < 2) throw new Error("log bins collapsed");
  db.prepare("UPDATE msg SET body = ? WHERE id = 1").run("{\"temperature_C\":99}");
  const broken = verify(db);
  if (broken.ok) throw new Error("tamper should break the chain");
  db.close();
  fs.rmSync(file, { force: true });
  fs.rmSync(file + "-wal", { force: true });
  fs.rmSync(file + "-shm", { force: true });
  console.log("check ok");
}

function queryCli(file) {
  if (!fs.existsSync(file)) {
    console.error("no log yet");
    process.exitCode = 1;
    return;
  }
  const db = openDb(file);
  const rows = ask(db, {
    device: flag("--device"),
    kind: flag("--kind"),
    since: flag("--since"),
    until: flag("--until"),
    min_c: flag("--min-c"),
    max_c: flag("--max-c"),
    door: flag("--door"),
    limit: flag("--limit")
  });
  console.log(JSON.stringify(rows, null, 2));
  db.close();
}

function serve(db, port, state) {
  const server = http.createServer(function (req, res) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      res.end();
      return;
    }
    const url = new URL(req.url, "http://127.0.0.1");
    const q = Object.fromEntries(url.searchParams);
    function send(code, obj) {
      const body = JSON.stringify(obj);
      res.writeHead(code, {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "no-store"
      });
      res.end(body);
    }
    if (url.pathname === "/health") {
      const n = db.prepare("SELECT COUNT(*) AS n FROM msg").get();
      send(200, { ok: true, mqtt: state.mqtt, topics: state.topics || [], rows: n ? n.n : 0 });
      return;
    }
    if (url.pathname === "/verify") {
      send(200, verify(db));
      return;
    }
    if (url.pathname === "/coverage") {
      send(200, coverage(db));
      return;
    }
    if (url.pathname === "/devices") {
      send(200, { devices: devices(db) });
      return;
    }
    if (url.pathname === "/latest") {
      if (!q.device) { send(400, { error: "device required" }); return; }
      send(200, latest(db, q.device));
      return;
    }
    if (url.pathname === "/q") {
      send(200, { rows: ask(db, q) });
      return;
    }
    send(404, { error: "not found" });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

function listen(db, state, stream) {
  const host = stream.host;
  const port = Number(stream.port || 1883);
  const user = stream.user || "";
  const pass = stream.pass || "";
  const topics = stream.topics && stream.topics.length ? stream.topics : ["openami/#"];
  const key = host + ":" + port;
  const clientId = "hold-log-" + Math.random().toString(16).slice(2, 8);
  let socket = null;
  let buf = Buffer.alloc(0);
  let ping = null;
  let retry = null;
  let stopped = false;
  let up = false;
  state.links[key] = false;

  function refresh() {
    state.mqtt = Object.keys(state.links).some(function (name) { return state.links[name]; });
  }

  function cleanup() {
    if (ping) clearInterval(ping);
    ping = null;
    up = false;
    state.links[key] = false;
    refresh();
    try { if (socket) socket.destroy(); } catch (e) { /* already closed */ }
  }

  function again() {
    if (stopped || retry) return;
    retry = setTimeout(function () {
      retry = null;
      if (!stopped) connect();
    }, 4000);
    cleanup();
  }

  function connect() {
    buf = Buffer.alloc(0);
    socket = net.connect({ host: host, port: port });
    socket.setTimeout(8000);
    const failTimer = setTimeout(function () {
      if (!up && !stopped) {
        console.error("connect timeout", host + ":" + port);
        again();
      }
    }, 8000);
    socket.once("connect", function () { clearTimeout(failTimer); });
    socket.once("close", function () { clearTimeout(failTimer); });
    socket.on("connect", function () {
      socket.write(connectPacket(clientId, user, pass));
    });
    socket.on("data", function (chunk) {
      buf = Buffer.concat([buf, chunk]);
      let pkt = takePacket(buf);
      while (pkt) {
        buf = pkt.rest;
        if (pkt.type === 2) {
          const code = pkt.packet[pkt.header + 1];
          if (code !== 0) {
            console.error("MQTT refused, CONNACK", code);
            again();
            return;
          }
          up = true;
          state.links[key] = true;
          refresh();
          socket.setTimeout(0);
          topics.forEach(function (topic, i) {
            socket.write(subscribePacket(topic, i + 1));
          });
          console.log("subscribed", host, topics.join(" "));
          if (ping) clearInterval(ping);
          ping = setInterval(function () {
            try { socket.write(Buffer.from([0xc0, 0x00])); } catch (e) { /* closed */ }
          }, 30000);
        } else if (pkt.type === 9) {
          const codes = [];
          let i;
          for (i = pkt.header + 2; i < pkt.packet.length; i++) codes.push(pkt.packet[i]);
          console.log("suback", host, codes.map(function (code) { return code === 0x80 ? "refused" : "ok"; }).join(" "));
        } else if (pkt.type === 3) {
          const msg = decodePublish(pkt);
          if (msg && msg.qos === 1 && msg.id != null) {
            socket.write(Buffer.from([0x40, 0x02, (msg.id >> 8) & 0xff, msg.id & 0xff]));
          }
          if (msg) {
            state.seen = (state.seen || 0) + 1;
            if (state.seen <= 20) console.log("rx", host, msg.topic);
            const saved = accept(db, msg.topic, msg.body, Date.now());
            if (saved) console.log("saved", saved.kind, saved.device);
          }
        }
        if (buf.length > 65536) {
          console.error("mqtt buffer stalled", host, buf.length);
          buf = Buffer.alloc(0);
        }
        pkt = takePacket(buf);
      }
    });
    socket.on("timeout", function () {
      if (!up) again();
    });
    socket.on("error", function (err) {
      console.error(err.message);
    });
    socket.on("close", function () {
      if (!stopped) again();
    });
  }

  state.stops.push(function () {
    stopped = true;
    if (retry) clearTimeout(retry);
    cleanup();
  });
  connect();
}

function loadStreams() {
  const file = path.join(here, "streams.json");
  if (fs.existsSync(file)) {
    const list = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(list) && list.length) return list;
  }
  const prefix = (flag("--prefix") || "openami").replace(/\/$/, "");
  return [{
    host: flag("--host") || "public.cloud.shiftr.io",
    port: Number(flag("--port") || 1883),
    user: flag("--user") || "public",
    pass: flag("--pass") || "public",
    topics: [prefix + "/#"]
  }];
}

const dbFile = flag("--db") || path.join(here, "hold.sqlite");

if (args.includes("--check")) {
  selfCheck();
} else if (args.includes("--verify")) {
  if (!fs.existsSync(dbFile)) {
    console.error("no log yet");
    process.exitCode = 1;
  } else {
    const db = openDb(dbFile);
    console.log(JSON.stringify(verify(db)));
    db.close();
  }
} else if (args.includes("--query")) {
  queryCli(dbFile);
} else if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const db = openDb(dbFile);
  const streams = loadStreams();
  const state = {
    mqtt: false,
    links: {},
    stops: [],
    topics: streams.reduce(function (all, stream) { return all.concat(stream.topics || []); }, [])
  };
  const httpPort = Number(flag("--http") || 8732);
  const server = serve(db, httpPort, state);
  console.log("query http://127.0.0.1:" + httpPort + "/q");
  streams.forEach(function (stream) { listen(db, state, stream); });
  process.on("SIGINT", function () {
    state.stops.forEach(function (stop) { stop(); });
    try { server.close(); } catch (e) { /* closed */ }
    try { db.close(); } catch (e) { /* closed */ }
    process.exit(0);
  });
}
