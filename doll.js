/* Clinic dollhouse. Front wall is open. Three.js, schematic, not a survey. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

var CABS = [
  { id: "vaccine", x: 0.15, z: -3.45, w: 1.32, h: 1.82, d: 0.6 },
  { id: "oxy", x: 1.7, z: -3.45, w: 1.12, h: 1.62, d: 0.56 },
  { id: "insulin", x: 3.05, z: -3.45, w: 0.92, h: 1.26, d: 0.5 }
];

var renderer = null;
var scene = null;
var camera = null;
var controls = null;
var canvas = null;
var cabs = [];
var wireMat = null;
var hostEl = null;
var raf = 0;
var mounted = false;
var reduce = false;
var ro = null;

function mat(color, rough, metal) {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: rough == null ? 0.78 : rough,
    metalness: metal == null ? 0.04 : metal
  });
}

function box(w, h, d, material, x, y, z) {
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundPlate(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function makeLabel() {
  var canvasEl = document.createElement("canvas");
  canvasEl.width = 512;
  canvasEl.height = 256;
  var ctx = canvasEl.getContext("2d");
  var tex = new THREE.CanvasTexture(canvasEl);
  tex.colorSpace = THREE.SRGBColorSpace;
  var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false
  }));
  sprite.scale.set(1.55, 0.78, 1);
  return { sprite: sprite, ctx: ctx, tex: tex, key: "" };
}

function paintLabel(label, room) {
  var stock = room.stock || "";
  var key = room.name + "|" + room.temp + "|" + room.sub + "|" + stock;
  if (label.key === key) return;
  label.key = key;
  var ctx = label.ctx;
  ctx.clearRect(0, 0, 512, 256);
  ctx.fillStyle = "rgba(12, 16, 18, 0.62)";
  roundPlate(ctx, 8, 8, 496, 240, 18);
  ctx.fillStyle = "#e7eee8";
  ctx.font = "600 36px system-ui, sans-serif";
  ctx.fillText(room.name, 28, 62);
  ctx.font = "560 72px Georgia, serif";
  ctx.fillText(room.temp, 28, 148);
  ctx.fillStyle = "#c5d0c8";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText(room.sub, 28, 190);
  ctx.fillStyle = "#93a399";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(stock, 28, 224);
  label.tex.needsUpdate = true;
}

function makeFan() {
  var g = new THREE.Group();
  var blade = mat(0xe7eee8, 0.4, 0.2);
  var i;
  for (i = 0; i < 4; i++) {
    var b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.028), blade);
    b.position.x = 0.09;
    b.rotation.z = (i * Math.PI) / 2;
    g.add(b);
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), blade));
  return g;
}

function makeCabinet(spec) {
  var g = new THREE.Group();
  g.position.set(spec.x, 0, spec.z == null ? -1.35 : spec.z);
  var bodyMat = mat(0x1e3a30, 0.7, 0.06);
  var body = box(spec.w, spec.h, spec.d, bodyMat, 0, spec.h / 2, 0);
  body.userData.room = spec.id;
  g.add(body);

  var shelfMat = mat(0x9aab9f, 0.55, 0.02);
  [0.42, 0.66].forEach(function (t) {
    g.add(box(spec.w - 0.14, 0.02, spec.d - 0.16, shelfMat, 0, spec.h * t, -0.02));
  });

  var hinge = new THREE.Group();
  var doorH = spec.h * 0.68;
  var doorW = spec.w - 0.1;
  hinge.position.set(-spec.w / 2 + 0.04, spec.h * 0.2, spec.d / 2 + 0.02);
  var doorMat = mat(0xe4ebe6, 0.42, 0.08);
  var door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.04), doorMat);
  door.position.set(doorW / 2, doorH / 2, 0);
  door.castShadow = true;
  door.userData.room = spec.id;
  hinge.add(door);
  var handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.16, 0.03),
    mat(0x1c2420, 0.4, 0.3)
  );
  handle.position.set(doorW - 0.1, doorH * 0.5, 0.035);
  hinge.add(handle);
  g.add(hinge);

  var fan = makeFan();
  fan.position.set(spec.w * 0.28, spec.h - 0.12, spec.d / 2 + 0.04);
  g.add(fan);

  var edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(spec.w + 0.03, spec.h + 0.03, spec.d + 0.03)),
    new THREE.LineBasicMaterial({ color: 0xf4efe6 })
  );
  edges.position.y = spec.h / 2;
  edges.visible = false;
  g.add(edges);

  var label = makeLabel();
  label.sprite.position.set(0, spec.h + 0.42, spec.d * 0.2);
  label.sprite.userData.room = spec.id;
  g.add(label.sprite);

  return {
    id: spec.id,
    group: g,
    body: bodyMat,
    hinge: hinge,
    fan: fan,
    edges: edges,
    label: label,
    open: false,
    fanOn: false,
    hot: false,
    cold: false
  };
}

function buildHouse() {
  var wall = mat(0xf3efe8, 0.86, 0.02);
  var half = mat(0xf7f4ef, 0.9, 0.02);
  scene.add(box(12.6, 0.08, 9.4, mat(0xd9cfc3, 0.92, 0), 0, -0.04, -0.15));
  scene.add(box(7.1, 0.025, 3.55, mat(0xe7d7c3), -2.35, 0.02, 2.15));
  scene.add(box(4.5, 0.025, 3.55, mat(0xd7b896), 3.65, 0.02, 2.15));
  scene.add(box(4.5, 0.025, 3.7, mat(0xcbb892), -3.75, 0.02, -2.35));
  scene.add(box(6.4, 0.025, 3.7, mat(0xd5e4ea), 1.55, 0.02, -2.35));

  scene.add(box(12.4, 2.55, 0.1, mat(0xf7f4ef), 0, 1.28, -4.55));
  scene.add(box(0.1, 2.55, 9.1, wall, -6.15, 1.28, -0.15));
  scene.add(box(0.1, 2.55, 9.1, wall, 6.15, 1.28, -0.15));
  scene.add(box(4.6, 1.12, 0.08, half, -3.7, 0.56, 0.35));
  scene.add(box(4.2, 1.12, 0.08, half, 3.85, 0.56, 0.35));
  scene.add(box(0.08, 1.12, 3.3, half, 1.2, 0.56, 2.15));
  scene.add(box(0.08, 1.12, 2.5, half, -1.45, 0.56, -2.9));

  scene.add(box(12.5, 0.08, 1.7, mat(0xc43838, 0.72, 0.04), 0, 2.62, -3.7));
  scene.add(box(1.05, 0.05, 0.16, mat(0xf4efe6), 1.6, 2.7, -3.7));
  scene.add(box(0.16, 0.05, 0.95, mat(0xf4efe6), 1.6, 2.7, -3.7));
  var i;
  for (i = 0; i < 5; i++) scene.add(box(0.62, 0.02, 0.9, mat(0x1a3038, 0.35, 0.25), -1.5 + i * 0.75, 2.68, -3.85));

  scene.add(box(0.55, 0.18, 0.06, mat(0x1a2420, 0.5, 0.15), 3.3, 2.15, -4.48));
  sign("MeshEMS", 3.3, 2.5, -4.2, "node", "listens only");

  scene.add(box(1.5, 0.08, 0.62, mat(0x8a5a32, 0.6, 0.05), -4.3, 0.74, 2.35));
  scene.add(box(1.5, 0.66, 0.08, mat(0x6e4528), -4.3, 0.33, 2.02));
  sign("Reception", -4.3, 1.55, 2.35, "desk", "clinic hours");
  chair(-2.4, 3.15, 0);
  chair(-1.7, 3.15, 0);
  chair(-1.0, 3.15, Math.PI);
  scene.add(box(1.7, 0.08, 0.42, mat(0x8d6a45), -1.7, 0.42, 2.55));
  sign("Waiting", -1.6, 1.45, 3.35, "seats", "");

  scene.add(box(1.15, 0.08, 0.7, mat(0xc9844a, 0.55, 0.04), 3.7, 0.7, 2.2));
  chair(3.15, 2.2, -0.4);
  chair(4.25, 2.2, 0.4);
  chair(3.7, 1.65, 0);
  chair(3.7, 2.75, Math.PI);
  sign("Lunch", 3.7, 1.55, 3.35, "staff", "");

  scene.add(box(1.3, 1.35, 0.28, mat(0xa88862), -4.5, 0.7, -3.5));
  scene.add(box(0.28, 0.22, 0.22, mat(0x3d9a4a), -4.15, 0.35, -3.15));
  scene.add(box(0.32, 0.18, 0.24, mat(0xc4a574), -3.7, 0.55, -3.4));
  scene.add(box(0.26, 0.2, 0.2, mat(0x8a5a32), -3.2, 0.85, -3.55));
  sign("Dry store", -3.8, 1.7, -1.7, "shelves", "not cold");
  sign("Cold room", 1.6, 2.15, -1.55, "2–8 °C", "click a cabinet");

  var posts = mat(0xc43838, 0.6, 0.04);
  scene.add(box(0.08, 2.1, 0.08, posts, -5.55, 1.05, 4.15));
  scene.add(box(0.08, 2.1, 0.08, posts, -4.15, 1.05, 4.15));
  clinicDoor = new THREE.Group();
  clinicDoor.position.set(-5.55, 0, 4.15);
  var leaf = box(1.32, 2.0, 0.06, mat(0xf4efe6, 0.5, 0.05), 0.66, 1.02, 0);
  clinicDoor.add(leaf);
  scene.add(clinicDoor);

  var clerk = figure(0xf7f4ef, -4.3, 2.7);
  folk.push({ mesh: clerk, kind: "staff", home: [-4.3, 2.7] });
  var lunch = figure(0xe0a84a, 4.3, 1.7);
  folk.push({ mesh: lunch, kind: "staff", seat: true, phase: 1.2, home: [4.3, 1.7] });
  [[-2.4, 2.55, 0x3aa0d8], [-1.7, 2.55, 0x3d9a4a]].forEach(function (p, n) {
    folk.push({ mesh: figure(p[2], p[0], p[1]), kind: "patient", seat: true, phase: n, home: [p[0], p[1]] });
  });
  folk.push({
    mesh: figure(0xc45b78, -3.2, 1.4),
    kind: "patient",
    phase: 0.15,
    ms: 16000,
    path: [[-3.4, 1.5], [-0.4, 1.5], [-0.4, 3.2], [-3.2, 3.2], [-4.8, 2.2]]
  });
  folk.push({
    mesh: figure(0x3aa0d8, 0.2, 1.2),
    kind: "patient",
    phase: 0.55,
    ms: 18000,
    path: [[-1.2, 1.1], [0.4, 1.1], [0.4, 3.0], [-2.8, 3.0], [-2.8, 1.6]]
  });
  folk.push({
    mesh: figure(0xf7f4ef, 0.2, -1.2),
    kind: "staff",
    phase: 0.3,
    ms: 14000,
    path: [[0.2, 1.2], [0.2, -2.2], [2.4, -2.2], [2.4, -1.0], [0.6, 0.8]]
  });
  makeBank(4.7, 3.85, 1.05);
}

function sign(name, x, y, z, sub, stock) {
  var label = makeLabel();
  label.sprite.position.set(x, y, z);
  label.sprite.scale.set(1.2, 0.6, 1);
  paintLabel(label, { name: name, temp: sub || "", sub: stock || "", stock: "" });
  scene.add(label.sprite);
}

function chair(x, z, rot) {
  var g = new THREE.Group();
  g.add(box(0.34, 0.05, 0.34, mat(0x8a5a32), 0, 0.42, 0));
  g.add(box(0.34, 0.32, 0.05, mat(0x8a5a32), 0, 0.6, -0.14));
  g.position.set(x, 0, z);
  g.rotation.y = rot || 0;
  scene.add(g);
}

function figure(shirt, x, z) {
  var g = new THREE.Group();
  g.add(box(0.26, 0.36, 0.14, mat(shirt, 0.7, 0.02), 0, 0.58, 0));
  g.add(box(0.22, 0.26, 0.12, mat(0x243044, 0.85, 0), 0, 0.26, 0));
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(0xf0d2bf, 0.72, 0));
  head.position.y = 0.9;
  g.add(head);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}

function buildWire() {
  var pts = [
    new THREE.Vector3(0.2, 2.7, -3.85),
    new THREE.Vector3(3.3, 2.2, -4.4),
    new THREE.Vector3(0.15, 1.9, -3.45),
    new THREE.Vector3(1.7, 1.7, -3.45),
    new THREE.Vector3(3.05, 1.4, -3.45)
  ];
  wireMat = new THREE.LineBasicMaterial({ color: 0x4a524c });
  var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat);
  scene.add(line);
}

var mode = "";
var tractor = null;
var tractor2 = null;
var drum = null;
var drops = [];
var folk = [];
var clinicDoor = null;
var bank = null;
var circuit = null;
var CLINIC_MARKS = [];
var LOOK = {
  vaccine: 0xf7f4ef,
  oxy: 0xd64545,
  insulin: 0x8e2f3c,
  leaf: 0x2f8f45,
  tomato: 0xd4532a,
  out: 0x1f6f8a
};

function makeBank(x, z, scale) {
  var g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(box(1.55 * scale, 0.14 * scale, 0.58 * scale, mat(0x1c2428, 0.4, 0.45), 0, 0.08 * scale, 0));
  var fills = [];
  var i;
  for (i = 0; i < 4; i++) {
    fills.push(box(0.26 * scale, 0.52 * scale, 0.3 * scale, new THREE.MeshStandardMaterial({
      color: 0x7eb0c8,
      roughness: 0.32,
      metalness: 0.28,
      emissive: 0x1a4060,
      emissiveIntensity: 0.35
    }), (-0.48 + i * 0.32) * scale, 0.42 * scale, 0));
    g.add(fills[i]);
  }
  var arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.11 * scale, 0.3 * scale, 10),
    new THREE.MeshStandardMaterial({
      color: 0xe6c56a,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0xe6c56a,
      emissiveIntensity: 0.4
    })
  );
  arrow.position.set(0.86 * scale, 0.55 * scale, 0);
  g.add(arrow);
  var label = makeLabel();
  label.sprite.position.set(0, 1.05 * scale, 0);
  label.sprite.scale.set(1.35 * Math.max(1, scale * 0.7), 0.68 * Math.max(1, scale * 0.7), 1);
  g.add(label.sprite);
  scene.add(g);
  bank = { fills: fills, arrow: arrow, label: label, scale: scale, cellH: 0.52 * scale, base: 0.16 * scale };
}

function paintBank(hour) {
  if (!bank || !window.HoldBattery) return;
  var b = window.HoldBattery(hour == null ? 6 : hour);
  var charging = b.flow > 0;
  var hex = charging ? 0xe6c56a : 0x3aa0d8;
  var glow = charging ? 0x8a6a20 : 0x1a4060;
  bank.fills.forEach(function (cell, i) {
    var local = b.soc * bank.fills.length - i;
    if (local < 0) local = 0;
    if (local > 1) local = 1;
    var grow = 0.08 + 0.92 * local;
    cell.scale.y = grow;
    cell.position.y = bank.base + (bank.cellH * grow) / 2;
    cell.material.color.setHex(hex);
    cell.material.emissive.setHex(glow);
    cell.material.emissiveIntensity = 0.2 + 0.55 * local;
  });
  bank.arrow.rotation.x = charging ? 0 : Math.PI;
  bank.arrow.material.color.setHex(hex);
  bank.arrow.material.emissive.setHex(glow);
  paintLabel(bank.label, {
    name: "Battery",
    temp: Math.round(b.soc * 100) + "%",
    sub: charging ? "charging" : "discharging",
    stock: "illustrative day"
  });
}

function emptyScene() {
  tractor = null;
  tractor2 = null;
  drum = null;
  drops = [];
  folk = [];
  clinicDoor = null;
  bank = null;
  circuit = null;
  cabs = [];
  wireMat = null;
  if (!scene) return;
  scene.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      var list = [].concat(obj.material);
      list.forEach(function (m) {
        if (m.map) m.map.dispose();
        if (m.dispose) m.dispose();
      });
    }
  });
  while (scene.children.length) scene.remove(scene.children[0]);
}

function addLights(farm) {
  scene.add(new THREE.HemisphereLight(farm ? 0xc8e6c0 : 0xf0d0d0, 0x1a1412, farm ? 0.7 : 0.6));
  var sun = new THREE.DirectionalLight(0xfff6ea, 1.4);
    sun.position.set(farm ? 18 : 6, farm ? 48 : 14, farm ? 14 : 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var span = farm ? 52 : 16;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = farm ? 160 : 48;
  scene.add(sun);
  var fill = new THREE.PointLight(farm ? 0xfff2cc : 0xffd0d0, farm ? 4 : 8, farm ? 120 : 32);
  fill.position.set(0, farm ? 16 : 4.2, farm ? 2 : 1.4);
  scene.add(fill);
}

function loopPoint(pts, u) {
  var seg = [];
  var total = 0;
  var i;
  for (i = 0; i < pts.length; i++) {
    var a = pts[i];
    var b = pts[(i + 1) % pts.length];
    var d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.0001;
    seg.push({ a: a, b: b, d: d });
    total += d;
  }
  var dist = ((u % 1) + 1) % 1 * total;
  for (i = 0; i < seg.length; i++) {
    if (dist <= seg[i].d || i === seg.length - 1) {
      var f = seg[i].d ? dist / seg[i].d : 0;
      return {
        x: seg[i].a[0] + (seg[i].b[0] - seg[i].a[0]) * f,
        z: seg[i].a[1] + (seg[i].b[1] - seg[i].a[1]) * f,
        nx: seg[i].b[0],
        nz: seg[i].b[1]
      };
    }
    dist -= seg[i].d;
  }
  return { x: pts[0][0], z: pts[0][1], nx: pts[0][0], nz: pts[0][1] };
}

function makePad(id, x, z, color) {
  var g = new THREE.Group();
  g.position.set(x, 0, z);
  var bodyMat = mat(color, 0.62, 0.05);
  var body = box(2.1, 0.55, 2.3, bodyMat, 0, 0.4, 0);
  body.userData.room = id;
  g.add(body);
  var edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.16, 0.6, 2.36)),
    new THREE.LineBasicMaterial({ color: 0xf4efe6 })
  );
  edges.position.y = 0.4;
  edges.visible = false;
  g.add(edges);
  var label = makeLabel();
  label.sprite.position.set(0, 1.35, 0);
  label.sprite.scale.set(1.7, 0.85, 1);
  g.add(label.sprite);
  return { id: id, group: g, body: bodyMat, hinge: null, fan: null, edges: edges, label: label, open: false, fanOn: false, hot: false, cold: false };
}

function makeTractor(color) {
  var rig = new THREE.Group();
  rig.add(box(1.15, 0.55, 1.9, mat(color, 0.55, 0.08), 0, 0.62, 0));
  rig.add(box(0.9, 0.48, 0.62, mat(0xf2d48a, 0.5, 0.05), 0, 1.1, -0.5));
  var wheel = mat(0x1c1915, 0.7, 0.1);
  [[-0.58, 0.62], [0.58, 0.62], [-0.58, -0.55], [0.58, -0.55]].forEach(function (p) {
    var w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), wheel);
    w.rotation.z = Math.PI / 2;
    w.position.set(p[0], 0.28, p[1]);
    rig.add(w);
  });
  return rig;
}

function dripRow(x0, span, z, phase) {
  scene.add(box(span, 0.04, 0.06, mat(0x2f86c8, 0.3, 0.15), x0 + span / 2, 0.12, z));
  var drop = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0x9ad7f5, 0.15, 0.05));
  drop.userData.x0 = x0;
  drop.userData.span = span;
  drop.userData.z = z;
  drop.userData.phase = phase;
  scene.add(drop);
  drops.push(drop);
}

function glowMat(color, intensity) {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.35,
    metalness: 0.45,
    emissive: color,
    emissiveIntensity: intensity == null ? 0.35 : intensity
  });
}

function bar(x1, y1, z1, x2, y2, z2, color, thick) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var dz = z2 - z1;
  var len = Math.hypot(dx, dy, dz) || 0.01;
  var t = thick || 0.12;
  var mesh = new THREE.Mesh(new THREE.BoxGeometry(len, t, t * 1.5), glowMat(color, 0.4));
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dx, dy, dz).normalize());
  scene.add(mesh);
  return mesh;
}

function setGlow(mesh, hex, intensity) {
  if (!mesh || !mesh.material) return;
  mesh.material.color.setHex(hex);
  mesh.material.emissive.setHex(hex);
  mesh.material.emissiveIntensity = intensity;
}

function tag(name, temp, sub, x, y, z, sx) {
  var label = makeLabel();
  label.sprite.position.set(x, y, z);
  var w = sx || 2.4;
  label.sprite.scale.set(w, w * 0.5, 1);
  paintLabel(label, { name: name, temp: temp || "", sub: sub || "", stock: "" });
  scene.add(label.sprite);
  return label;
}

function makeContactor(x, z) {
  var g = new THREE.Group();
  g.position.set(x, 0, z);
  var post = mat(0xe4e0d4, 0.35, 0.35);
  g.add(box(0.18, 0.5, 0.18, post, 0, 0.55, 0));
  g.add(box(0.18, 0.5, 0.18, post, 1.25, 0.55, 0));
  var hinge = new THREE.Group();
  hinge.position.set(0, 0.78, 0);
  var blade = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.16), glowMat(0xe6c56a, 0.25));
  blade.position.x = 0.62;
  hinge.add(blade);
  g.add(hinge);
  scene.add(g);
  return { hinge: hinge, blade: blade };
}

function buildCircuit() {
  scene.add(box(0.32, 3.4, 0.32, mat(0x2c261c, 0.7, 0.08), -4.2, 1.7, 12.2));
  var emsMat = new THREE.MeshStandardMaterial({
    color: 0x14201a,
    roughness: 0.4,
    metalness: 0.25,
    emissive: 0x3d9a4a,
    emissiveIntensity: 0.25
  });
  var ems = box(1.55, 1.75, 0.36, emsMat, -4.2, 2.05, 12.55);
  scene.add(ems);
  var emsLabel = tag("Street-EMS", "on phase B", "box on the pole", -4.2, 3.6, 12.2, 3.4);
  tag("Pole", "mains", "three phase in", -4.2, 4.6, 12.2, 2.2);

  var A = 0xe6c56a;
  var B = 0x7dcea0;
  var C = 0x3aa0d8;
  var dropA = bar(-3.5, 3.15, 12.2, -1.2, 0.72, 10.0, A);
  var dropB = bar(-3.5, 3.15, 12.2, -1.2, 0.72, 12.2, B);
  var dropC = bar(-3.5, 3.15, 12.2, -1.2, 0.72, 14.4, C);
  var bIn = bar(-1.2, 0.72, 12.2, 0.2, 0.72, 12.2, B);
  var jumper = bar(0.2, 0.72, 12.2, 1.25, 0.72, 12.2, B);
  var faultOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glowMat(0xe24b4b, 0.9));
  faultOrb.position.set(0.7, 1.05, 12.2);
  faultOrb.visible = false;
  scene.add(faultOrb);
  var faultLabel = tag("Incomer", "B down", "before the cooler", 0.8, 2.15, 12.2, 2.8);
  faultLabel.sprite.visible = false;

  var aBus = bar(-1.2, 0.72, 10.0, 8.4, 0.72, 10.0, A);
  var bBus = bar(1.25, 0.72, 12.2, 8.4, 0.72, 12.2, B);
  var cBus = bar(-1.2, 0.72, 14.4, 8.4, 0.72, 14.4, C);
  tag("Leafy", "A", "stays on A", 3.4, 1.7, 9.15, 2.3);
  tag("Cooler", "B", "starts on B", 4.6, 1.7, 13.35, 2.3);
  tag("Tomato", "C", "stays on C", 3.4, 1.7, 15.55, 2.3);

  var leafFeed = bar(1.0, 0.72, 10.0, 0.4, 0.55, 8.15, A);
  var tomatoFeed = bar(3.2, 0.72, 14.4, 3.2, 0.55, 8.15, C);
  var bSw = makeContactor(8.5, 12.2);
  var aSw = makeContactor(8.5, 10.0);
  aSw.hinge.rotation.y = 1.15;
  var coolFromB = bar(9.75, 0.72, 12.2, 6.35, 0.55, 8.2, B);
  var coolFromA = bar(9.75, 0.72, 10.0, 5.65, 0.55, 8.2, A);

  var line = feederLine([
    { x: -4.2, z: 12.2, h: 3.55, skipPost: true },
    { x: -8, z: 1, h: 4.3 },
    { x: -14, z: -10, h: 4.6 },
    { x: -21, z: -22, h: 5.0 },
    { x: -30, z: -36, h: 5.4 },
    { x: -40, z: -52, h: 5.8 }
  ], { A: A, B: B, C: C });

  circuit = {
    emsMat: emsMat,
    emsLabel: emsLabel,
    dropA: dropA,
    dropB: dropB,
    dropC: dropC,
    bIn: bIn,
    jumper: jumper,
    faultOrb: faultOrb,
    faultLabel: faultLabel,
    aBus: aBus,
    bBus: bBus,
    cBus: cBus,
    leafFeed: leafFeed,
    tomatoFeed: tomatoFeed,
    bSw: bSw,
    aSw: aSw,
    coolFromB: coolFromB,
    coolFromA: coolFromA,
    lineA: line.A,
    lineB: line.B,
    lineC: line.C
  };
}

function catenary(a, b, color, sag) {
  var meshes = [];
  var n = 5;
  var i;
  var px = a.x;
  var py = a.y;
  var pz = a.z;
  for (i = 1; i <= n; i++) {
    var t = i / n;
    var x = a.x + (b.x - a.x) * t;
    var z = a.z + (b.z - a.z) * t;
    var y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag;
    meshes.push(bar(px, py, pz, x, y, z, color, 0.16));
    px = x;
    py = y;
    pz = z;
  }
  return meshes;
}

function feederLine(poles, colors) {
  var out = { A: [], B: [], C: [] };
  var i;
  for (i = 0; i < poles.length; i++) {
    var p = poles[i];
    if (!p.skipPost) {
      scene.add(box(0.24, p.h, 0.24, mat(0x3a3328, 0.75, 0.05), p.x, p.h / 2, p.z));
    }
    var prev = poles[Math.max(0, i - 1)];
    var next = poles[Math.min(poles.length - 1, i + 1)];
    var dx = next.x - prev.x;
    var dz = next.z - prev.z;
    var len = Math.hypot(dx, dz) || 1;
    var px = -dz / len;
    var pz = dx / len;
    var y = p.h - 0.2;
    var arm = 0.9;
    bar(p.x - px * arm, y, p.z - pz * arm, p.x + px * arm, y, p.z + pz * arm, 0x6a5438, 0.1);
    p.A = { x: p.x - px * arm, y: y, z: p.z - pz * arm };
    p.B = { x: p.x, y: y, z: p.z };
    p.C = { x: p.x + px * arm, y: y, z: p.z + pz * arm };
  }
  for (i = 0; i < poles.length - 1; i++) {
    var sag = 0.55 + i * 0.08;
    out.A = out.A.concat(catenary(poles[i].A, poles[i + 1].A, colors.A, sag));
    out.B = out.B.concat(catenary(poles[i].B, poles[i + 1].B, colors.B, sag));
    out.C = out.C.concat(catenary(poles[i].C, poles[i + 1].C, colors.C, sag));
  }
  return out;
}

function paintList(list, hex, intensity) {
  var i;
  if (!list) return;
  for (i = 0; i < list.length; i++) setGlow(list[i], hex, intensity);
}

function paintLiveCircuit(live, now) {
  if (!live || !live.mainsValid) {
    [circuit.dropA, circuit.aBus, circuit.leafFeed, circuit.dropB, circuit.bIn, circuit.bBus, circuit.dropC, circuit.cBus, circuit.tomatoFeed, circuit.coolFromA, circuit.coolFromB].forEach(function (mesh) {
      setGlow(mesh, 0x5c6560, 0.08);
    });
    paintList(circuit.lineA, 0x5c6560, 0.08);
    paintList(circuit.lineB, 0x5c6560, 0.08);
    paintList(circuit.lineC, 0x5c6560, 0.08);
    circuit.jumper.visible = true;
    circuit.faultOrb.visible = false;
    circuit.faultLabel.sprite.visible = false;
    circuit.emsMat.emissive.setHex(0x3d9a4a);
    circuit.emsMat.emissiveIntensity = 0.15;
    paintLabel(circuit.emsLabel, {
      name: "COLD-EMS",
      temp: live && live.link === "connected" ? "meter quiet" : "waiting",
      sub: "box on the pole",
      stock: "LIVE"
    });
    return;
  }
  var down = [false, false, false];
  var i;
  for (i = 0; i < 3; i++) down[i] = live.volts[i] < 40;
  var faultB = down[1] && (!down[0] || !down[2]);
  setGlow(circuit.dropA, down[0] ? 0xe24b4b : 0xe6c56a, down[0] ? 0.2 : 0.45);
  setGlow(circuit.aBus, down[0] ? 0xe24b4b : 0xe6c56a, down[0] ? 0.2 : 0.45);
  setGlow(circuit.leafFeed, down[0] ? 0xe24b4b : 0xe6c56a, down[0] ? 0.15 : 0.45);
  paintList(circuit.lineA, down[0] ? 0xe24b4b : 0xe6c56a, down[0] ? 0.2 : 0.45);
  setGlow(circuit.dropC, down[2] ? 0xe24b4b : 0x3aa0d8, down[2] ? 0.2 : 0.45);
  setGlow(circuit.cBus, down[2] ? 0xe24b4b : 0x3aa0d8, down[2] ? 0.2 : 0.45);
  setGlow(circuit.tomatoFeed, down[2] ? 0xe24b4b : 0x3aa0d8, down[2] ? 0.15 : 0.45);
  paintList(circuit.lineC, down[2] ? 0xe24b4b : 0x3aa0d8, down[2] ? 0.2 : 0.45);
  setGlow(circuit.dropB, down[1] ? 0xe24b4b : 0x7dcea0, down[1] ? 0.2 : 0.45);
  setGlow(circuit.bIn, down[1] ? 0xe24b4b : 0x7dcea0, down[1] ? 0.85 : 0.45);
  setGlow(circuit.bBus, down[1] ? 0x5c3030 : 0x7dcea0, down[1] ? 0.08 : 0.45);
  paintList(circuit.lineB, down[1] ? 0xe24b4b : 0x7dcea0, down[1] ? 0.22 : 0.45);
  circuit.jumper.visible = !faultB;
  circuit.faultOrb.visible = faultB;
  circuit.faultLabel.sprite.visible = faultB;
  if (faultB && !reduce) {
    var pulse = 0.4 + 0.6 * Math.sin(now / 180);
    circuit.faultOrb.material.emissiveIntensity = pulse;
    circuit.faultOrb.scale.setScalar(0.8 + 0.35 * pulse);
  }
  var names = ["A", "B", "C"].filter(function (ph, n) { return down[n]; });
  var line = names.length ? names.join(" ") + " down" : "phases up";
  if (live.leakageAlarm) line = "leakage alarm";
  circuit.emsMat.emissive.setHex(names.length || live.leakageAlarm ? 0xe24b4b : 0x3d9a4a);
  circuit.emsMat.emissiveIntensity = 0.7;
  paintLabel(circuit.emsLabel, {
    name: "Street-EMS",
    temp: "LIVE " + line,
    sub: "box on the pole",
    stock: live.deviceId.slice(-6)
  });
}

function paintCircuit(hour, now) {
  if (!circuit) return;
  var live = window.HoldLive && window.HoldLive();
  if ((window.HoldDesk && window.HoldDesk()) || (live && live.mainsValid)) {
    paintLiveCircuit(live, now);
    return;
  }
  var sup = window.HoldSupply && hour != null ? window.HoldSupply(hour) : { step: "hold", fault: false };
  var step = sup.step || "hold";
  var fault = !!sup.fault;
  var bClosed = step === "hold" || step === "fault";
  var aClosed = step === "make" || step === "run";
  var k = reduce ? 1 : 0.18;
  circuit.bSw.hinge.rotation.y += ((bClosed ? 0 : -1.15) - circuit.bSw.hinge.rotation.y) * k;
  circuit.aSw.hinge.rotation.y += ((aClosed ? 0 : 1.15) - circuit.aSw.hinge.rotation.y) * k;

  setGlow(circuit.dropA, 0xe6c56a, 0.45);
  setGlow(circuit.aBus, 0xe6c56a, 0.45);
  setGlow(circuit.leafFeed, 0xe6c56a, 0.45);
  setGlow(circuit.dropC, 0x3aa0d8, 0.45);
  setGlow(circuit.cBus, 0x3aa0d8, 0.45);
  setGlow(circuit.tomatoFeed, 0x3aa0d8, 0.45);
  setGlow(circuit.dropB, fault ? 0xe24b4b : 0x7dcea0, fault ? 0.15 : 0.45);
  paintList(circuit.lineA, 0xe6c56a, 0.45);
  paintList(circuit.lineC, 0x3aa0d8, 0.45);
  paintList(circuit.lineB, fault ? 0xe24b4b : 0x7dcea0, fault ? 0.22 : 0.45);
  setGlow(circuit.bIn, fault ? 0xe24b4b : 0x7dcea0, fault ? 0.85 : 0.45);
  setGlow(circuit.bBus, fault ? 0x5c3030 : 0x7dcea0, fault ? 0.08 : 0.45);
  circuit.jumper.visible = !fault;
  circuit.faultOrb.visible = fault;
  circuit.faultLabel.sprite.visible = fault;
  if (fault && !reduce) {
    var pulse = 0.4 + 0.6 * Math.sin(now / 180);
    circuit.faultOrb.material.emissiveIntensity = pulse;
    circuit.faultOrb.scale.setScalar(0.8 + 0.35 * pulse);
  }

  var bCarry = bClosed && !fault;
  setGlow(circuit.coolFromB, bClosed && fault ? 0xe24b4b : 0x7dcea0, bCarry ? 0.7 : 0.08);
  setGlow(circuit.coolFromA, 0xe6c56a, aClosed ? 0.8 : 0.05);
  setGlow(circuit.bSw.blade, bCarry ? 0x7dcea0 : (bClosed ? 0xe24b4b : 0x8a8478), bClosed ? 0.6 : 0.05);
  setGlow(circuit.aSw.blade, 0xe6c56a, aClosed ? 0.75 : 0.05);

  var emsHex = (step === "break" || step === "make") ? 0xe6c56a : (step === "fault" ? 0xe24b4b : 0x3d9a4a);
  circuit.emsMat.emissive.setHex(emsHex);
  circuit.emsMat.emissiveIntensity = step === "hold" ? 0.2 : 0.75;
  var line = {
    hold: "on phase B",
    fault: "sees B down",
    break: "opens off B",
    make: "closes onto A",
    run: "now on A"
  }[step] || "";
  paintLabel(circuit.emsLabel, {
    name: "Street-EMS",
    temp: line,
    sub: "box on the pole",
    stock: "SIM"
  });
}

function buildFarm() {
  scene.background = new THREE.Color(0x14301c);
  addLights(true);
  scene.add(box(86, 0.18, 64, mat(0x245c30, 0.9, 0), 2, -0.08, 2));
  scene.add(box(72, 0.05, 1.6, mat(0x6b4428, 0.95, 0), 2, 0.02, 2));
  scene.add(box(1.6, 0.05, 50, mat(0x6b4428, 0.95, 0), -2, 0.02, 2));

  scene.add(box(20, 0.06, 16, mat(0x3a6e34, 0.95, 0), -22, 0.03, -8));
  scene.add(box(16, 0.06, 12, mat(0x6a4428, 0.95, 0), 16, 0.03, -16));
  scene.add(box(14, 0.06, 16, mat(0xb8923a, 0.35, 0), 28, 0.03, 8));
  scene.add(box(16, 0.06, 12, mat(0x2a5230, 0.95, 0), -24, 0.03, 16));

  var r;
  var c;
  for (r = 0; r < 6; r++) {
    var z = -14 + r * 2.3;
    dripRow(-31, 18, z, r / 6);
    for (c = 0; c < 7; c++) {
      scene.add(box(1.7, 0.38 + (r % 2) * 0.1, 1.05, mat(r % 2 ? 0x46b85a : 0x2f8f45), -29.5 + c * 2.4, 0.26, z));
    }
  }
  for (r = 0; r < 4; r++) {
    for (c = 0; c < 5; c++) {
      var px = 10 + c * 2.4;
      var pz = -20 + r * 2.4;
      scene.add(box(0.9, 0.5, 0.9, mat(0x2f7a32), px, 0.32, pz));
      var fruit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0xd4532a, 0.4, 0.05));
      fruit.position.set(px, 0.7, pz);
      scene.add(fruit);
    }
  }
  for (r = 0; r < 5; r++) {
    for (c = 0; c < 4; c++) {
      scene.add(box(0.35, 1.15, 0.35, mat(r % 2 ? 0xd4b24a : 0x8f9a32), 23 + c * 2.6, 0.62, 2 + r * 2.6));
    }
  }
  for (r = 0; r < 4; r++) {
    var bz = 12 + r * 2.2;
    dripRow(-31, 14, bz, 0.4 + r / 8);
    for (c = 0; c < 5; c++) {
      scene.add(box(1.5, 0.28, 0.9, mat(0x3d8f4a), -29 + c * 2.5, 0.2, bz));
    }
  }

  sign("Leaf field", -22, 2.4, -17.2, "greens", "drip");
  sign("Tomato field", 16, 2.4, -23, "fruit", "");
  sign("Maize field", 28, 2.4, -1.2, "grain", "");
  sign("Bean field", -24, 2.4, 9.2, "pulses", "");

  scene.add(box(4.2, 1.7, 3.1, mat(0xc4a574, 0.75, 0.04), -8.5, 0.85, 6.2));
  drum = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 18), mat(0xd5dde4, 0.32, 0.55));
  drum.rotation.z = Math.PI / 2;
  drum.position.set(-8.5, 0.8, 8.1);
  scene.add(drum);
  var grind = makeLabel();
  grind.sprite.position.set(-8.5, 2.5, 6.2);
  grind.sprite.scale.set(2.2, 1.1, 1);
  paintLabel(grind, { name: "Grinder", temp: "", sub: "packhouse yard", stock: "" });
  scene.add(grind.sprite);

  tractor = makeTractor(0xe25b1a);
  tractor.userData.path = [[-32, -16], [-12, -16], [-12, 22], [-32, 22]];
  tractor.userData.ms = 14000;
  tractor.userData.phase = 0.1;
  scene.add(tractor);
  tractor2 = makeTractor(0xc47a12);
  tractor2.userData.path = [[8, -22], [36, -22], [36, 16], [8, 16]];
  tractor2.userData.ms = 16000;
  tractor2.userData.phase = 0.55;
  scene.add(tractor2);

  scene.add(box(10, 1.05, 0.14, mat(0xd9c7a3), 3.2, 0.55, 4.2));
  scene.add(box(0.14, 1.05, 5.4, mat(0xd9c7a3), -1.8, 0.55, 6.9));
  scene.add(box(0.14, 1.05, 5.4, mat(0xd9c7a3), 8.2, 0.55, 6.9));
  scene.add(box(10, 0.1, 5.4, mat(0xcbb892), 3.2, 0.05, 6.9));
  var shed = makeLabel();
  shed.sprite.position.set(3.2, 2.8, 4.2);
  shed.sprite.scale.set(3.4, 1.6, 1);
  paintLabel(shed, { name: "Packinghouse", temp: "", sub: "cold rooms", stock: "four fields" });
  scene.add(shed.sprite);
  makeBank(11.4, 5.6, 2.6);

  [
    { id: "leaf", x: 0.4 },
    { id: "tomato", x: 3.2 },
    { id: "out", x: 6.0 }
  ].forEach(function (spec) {
    var pad = makePad(spec.id, spec.x, 6.9, LOOK[spec.id]);
    pad.label.sprite.scale.set(2.4, 1.2, 1);
    scene.add(pad.group);
    cabs.push(pad);
  });
  buildCircuit();
}

function buildDesk() {
  scene.background = new THREE.Color(0x101410);
  addLights(true);
  scene.add(box(36, 0.08, 28, mat(0x1a221c, 0.9, 0), 2, -0.04, 12));
  buildCircuit();
}

function aimView(profile) {
  if (profile === "packhouse") {
    camera.position.set(2.4, 22, 34);
    camera.far = 280;
    controls.target.set(1.2, 2.0, 8);
    controls.minDistance = 7;
    controls.maxDistance = 80;
    controls.maxPolarAngle = 1.25;
    controls.minPolarAngle = 0.35;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.autoRotate = false;
  } else if (profile === "desk") {
    camera.position.set(2.4, 18, 30);
    camera.far = 220;
    controls.target.set(1.2, 1.6, 11);
    controls.minDistance = 6;
    controls.maxDistance = 40;
    controls.maxPolarAngle = 1.25;
    controls.minPolarAngle = 0.35;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.autoRotate = false;
  } else {
    camera.position.set(0.3, 8.6, 12.2);
    camera.far = 80;
    controls.target.set(0, 0.7, -0.4);
    controls.minDistance = 8;
    controls.maxDistance = 20;
    controls.maxPolarAngle = 1.02;
    controls.minPolarAngle = 0.35;
    controls.minAzimuthAngle = -0.7;
    controls.maxAzimuthAngle = 0.7;
    controls.autoRotate = false;
  }
  camera.updateProjectionMatrix();
  controls.update();
}

function buildMode(profile) {
  emptyScene();
  if (profile === "packhouse") buildFarm();
  else if (profile === "desk") buildDesk();
  else {
    scene.background = new THREE.Color(0x1a1214);
    addLights(false);
    buildHouse();
    cabs = CABS.map(function (spec) {
      var cab = makeCabinet(spec);
      cab.body.color.set(LOOK[spec.id] || 0xf7f4ef);
      scene.add(cab.group);
      return cab;
    });
    buildWire();
  }
  aimView(profile);
  canvas.setAttribute("aria-label", profile === "desk"
    ? "Live COLD-EMS feeder. Three phases, the pole box, and a phase fault when the node reports one."
    : profile === "packhouse"
    ? "Packhouse feeder. Three phases leave the pole. Street-EMS is the box on the pole. Phase B faults on its incomer. The market cooler moves onto phase A."
    : "Cutaway clinic. Reception, waiting, lunch, store, and the cold room. People move during clinic hours. Click a cabinet.");
}

function build() {
  reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1214);
  camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 90);
  camera.position.set(0.2, 2.55, 6.1);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  canvas = renderer.domElement;

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduce;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.35;

  var down = null;
  canvas.addEventListener("pointerdown", function (ev) {
    down = { x: ev.clientX, y: ev.clientY };
    controls.autoRotate = false;
  });
  canvas.addEventListener("pointerup", function (ev) {
    if (!down) return;
    var dx = ev.clientX - down.x;
    var dy = ev.clientY - down.y;
    down = null;
    if (dx * dx + dy * dy > 16) return;
    pick(ev);
  });
}

function pick(ev) {
  if (!camera) return;
  var rect = canvas.getBoundingClientRect();
  var ndc = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1
  );
  var ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  var hits = ray.intersectObjects(scene.children, true);
  var i;
  for (i = 0; i < hits.length; i++) {
    var obj = hits[i].object;
    while (obj) {
      if (obj.userData && obj.userData.room) {
        if (window.HoldDoll && window.HoldDoll.onPick) window.HoldDoll.onPick(obj.userData.room);
        return;
      }
      obj = obj.parent;
    }
  }
}

function cabById(id) {
  var i;
  for (i = 0; i < cabs.length; i++) if (cabs[i].id === id) return cabs[i];
  return null;
}

function frame(now) {
  if (!mounted) return;
  raf = requestAnimationFrame(frame);
  cabs.forEach(function (cab) {
    if (cab.hinge) {
      var goal = cab.open ? -1.15 : 0;
      cab.hinge.rotation.y += (goal - cab.hinge.rotation.y) * (reduce ? 1 : 0.14);
    }
    if (cab.fan && cab.fanOn && !reduce) cab.fan.rotation.z += 0.28;
    if (cab.hot) {
      cab.body.emissive.set(0xff5a3c);
      cab.body.emissiveIntensity = 0.25 + 0.3 * Math.sin(now / 280);
    } else if (cab.cold) {
      cab.body.emissive.set(0x8eb4e0);
      cab.body.emissiveIntensity = 0.4;
    } else {
      cab.body.emissive.set(0x000000);
      cab.body.emissiveIntensity = 0;
    }
  });
  var hour = window.HoldDay && window.HoldDay.hour ? window.HoldDay.hour() : null;
  paintBank(hour);
  paintCircuit(hour, now);
  var awake = hour == null || (hour >= 8 && hour < 17);
  folk.forEach(function (f) {
    var show = f.kind === "staff" || awake || reduce;
    f.mesh.visible = show;
    if (!show) return;
    if (f.path && !reduce) {
      var walk = hour == null ? now / f.ms + f.phase : hour / (f.ms / 12000) + f.phase;
      var step = loopPoint(f.path, walk);
      f.mesh.position.set(step.x, 0, step.z);
      var dx = step.nx - step.x;
      var dz = step.nz - step.z;
      if (dx * dx + dz * dz > 1e-8) f.mesh.rotation.y = Math.atan2(dx, dz);
    } else if (f.seat && !reduce) {
      var bob = hour == null ? now / 420 + f.phase : hour * 28.6 + f.phase;
      f.mesh.position.y = Math.sin(bob) * 0.02;
    }
  });
  if (clinicDoor) {
    var ajar = false;
    if (hour != null) {
      var marks = (window.CLINIC_DOORS && window.CLINIC_DOORS.front) || CLINIC_MARKS;
      ajar = marks.some(function (at) {
        var dt = (hour - at + 24) % 24;
        return dt <= 0.18;
      });
    }
    var goal = ajar ? -1.2 : 0;
    clinicDoor.rotation.y += (goal - clinicDoor.rotation.y) * (reduce ? 1 : 0.14);
  }
  if (drum && !reduce) drum.rotation.x = hour == null ? now / 140 : hour * 48;
  [tractor, tractor2].forEach(function (rig) {
    if (!rig || reduce) return;
    var u = hour == null ? now / rig.userData.ms : hour / (rig.userData.ms / 12000);
    var step = loopPoint(rig.userData.path, u + rig.userData.phase);
    var dx = step.nx - step.x;
    var dz = step.nz - step.z;
    rig.position.set(step.x, 0, step.z);
    if (dx * dx + dz * dz > 1e-6) rig.rotation.y = Math.atan2(dx, dz);
  });
  drops.forEach(function (drop) {
    var u = hour == null ? (now / 4000 + drop.userData.phase) % 1 : (hour * 3 + drop.userData.phase) % 1;
    if (u < 0) u += 1;
    drop.position.set(drop.userData.x0 + u * drop.userData.span, 0.22, drop.userData.z);
  });
  controls.update();
  renderer.render(scene, camera);
}

function fit() {
  if (!renderer || !hostEl) return;
  var w = hostEl.clientWidth || 640;
  var h = hostEl.clientHeight || 560;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function sync(host, profile, rooms) {
  hostEl = host;
  if (!renderer) build();
  if (canvas.parentNode !== host) {
    host.textContent = "";
    host.classList.add("doll-live");
    host.appendChild(canvas);
    var note = document.createElement("p");
    note.className = "doll-note";
    host.appendChild(note);
    if (!ro && window.ResizeObserver) ro = new ResizeObserver(fit);
    if (ro) ro.observe(host);
    fit();
  }
  var noteEl = host.querySelector(".doll-note");
  if (noteEl) {
    noteEl.textContent = profile === "desk"
      ? "Live feeder. The box is COLD-EMS. A dark phase is down. Drag to look."
      : profile === "packhouse"
      ? "Street-EMS is the box on the pole. Phase B breaks on the incomer. Drag to look. Click a cold room."
      : "Cutaway clinic. Drag to look. People move 08:00–17:00. Click a cabinet.";
  }
  if (mode !== profile) {
    buildMode(profile);
    mode = profile;
    fit();
  }
  (rooms || []).forEach(function (room) {
    var cab = cabById(room.id);
    if (!cab) return;
    cab.open = !!room.open;
    cab.fanOn = !!room.fan;
    cab.hot = !!room.hot;
    cab.cold = !!room.cold;
    cab.edges.visible = !!room.picked;
    if (LOOK[room.id]) cab.body.color.set(LOOK[room.id]);
    paintLabel(cab.label, room);
  });
  if (wireMat) wireMat.color.set(0xc43838);
  if (!mounted) {
    mounted = true;
    raf = requestAnimationFrame(frame);
  }
}

function stop() {
  mounted = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (ro && hostEl) ro.unobserve(hostEl);
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  if (hostEl) {
    hostEl.classList.remove("doll-live");
    hostEl = null;
  }
}

window.HoldDoll = { sync: sync, stop: stop, onPick: null };
if (window.HoldRepaint) window.HoldRepaint();
