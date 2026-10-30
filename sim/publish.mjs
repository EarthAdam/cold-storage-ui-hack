// Publish one GeoJSON FeatureCollection per trade.
//   node sim/publish.mjs --dump
//   node sim/publish.mjs
//   node sim/publish.mjs --once
//
// Topic: openami/geojson/<profile>
// Broker: public.cloud.shiftr.io:1883  user public / password public

import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createWorld, step, collection, PROFILE_IDS } from "./feeds.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dump = args.includes("--dump");
const once = args.includes("--once");
const host = flag("--host") || "public.cloud.shiftr.io";
const port = Number(flag("--port") || 1883);
const user = flag("--user") || "public";
const pass = flag("--pass") || "public";
const everyMs = Number(flag("--interval") || 2000);

function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : "";
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

function mqttStr(s) {
  const b = Buffer.from(String(s));
  const h = Buffer.alloc(2);
  h.writeUInt16BE(b.length);
  return Buffer.concat([h, b]);
}

function connectPacket(clientId) {
  const body = Buffer.concat([
    mqttStr("MQTT"),
    Buffer.from([0x04, 0xc2, 0x00, 60]),
    mqttStr(clientId),
    mqttStr(user),
    mqttStr(pass)
  ]);
  return Buffer.concat([Buffer.from([0x10]), encodeLen(body.length), body]);
}

function publishPacket(topic, message) {
  const body = Buffer.concat([mqttStr(topic), Buffer.from(message)]);
  return Buffer.concat([Buffer.from([0x30]), encodeLen(body.length), body]);
}

function writeSnapshots(world) {
  const dir = path.join(here, "geojson");
  fs.mkdirSync(dir, { recursive: true });
  const time = new Date().toISOString();
  PROFILE_IDS.forEach(function (id) {
    const file = path.join(dir, id + ".geojson");
    fs.writeFileSync(file, JSON.stringify(collection(world, id, time), null, 2) + "\n");
    console.log("wrote", path.relative(path.join(here, ".."), file));
  });
}

function frames(world) {
  const time = new Date().toISOString();
  return PROFILE_IDS.map(function (id) {
    return {
      topic: "openami/geojson/" + id,
      body: JSON.stringify(collection(world, id, time))
    };
  });
}

function publishLoop() {
  const world = createWorld();
  const clientId = "hold-sim-" + Math.random().toString(16).slice(2, 8);
  const socket = net.connect({ host: host, port: port });
  socket.setTimeout(8000);
  let buf = Buffer.alloc(0);
  let live = false;
  let timer = null;

  function sendFrames(advance) {
    if (advance) step(world, everyMs / 1000);
    frames(world).forEach(function (frame) {
      socket.write(publishPacket(frame.topic, frame.body));
    });
    console.log("published", PROFILE_IDS.join(", "));
    if (once) finish();
  }

  function finish() {
    if (timer) clearInterval(timer);
    try { socket.end(); } catch (e) { /* already closed */ }
  }

  socket.on("connect", function () {
    socket.write(connectPacket(clientId));
  });
  socket.on("data", function (chunk) {
    buf = Buffer.concat([buf, chunk]);
    if (!live && buf.length >= 4 && buf[0] === 0x20) {
      const code = buf[3];
      buf = buf.subarray(4);
      if (code !== 0) {
        console.error("MQTT refused, CONNACK", code);
        finish();
        process.exitCode = 1;
        return;
      }
      live = true;
      socket.setTimeout(0);
      console.log("connected", host + ":" + port, "as", user);
      sendFrames(false);
      if (!once) timer = setInterval(function () { sendFrames(true); }, everyMs);
    }
  });
  socket.on("timeout", function () {
    if (live) return;
    console.error("broker timeout");
    finish();
    process.exitCode = 1;
  });
  socket.on("error", function (err) {
    console.error(err.message);
    process.exitCode = 1;
  });
  socket.on("close", function () {
    if (timer) clearInterval(timer);
  });
  process.on("SIGINT", finish);
}

if (dump) {
  writeSnapshots(createWorld());
} else {
  publishLoop();
}
