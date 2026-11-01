/* Listen-only inventory. Keep all fields, including unknown firmware extensions.
   Receipt is evidence of a message, not proof of a measurement or actuation. */
(function (root) {
  "use strict";
  const topics = new Map();
  let dirty = true;
  function parse(raw) {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  function stamp(value) {
    if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : null;
  }
  function capture(topic, raw, packet) {
    const old = topics.get(topic);
    topics.set(topic, { topic: topic, raw: String(raw), data: parse(raw),
      received: Date.now(), count: old ? old.count + 1 : 1,
      retained: !!(packet && packet.retain) });
    dirty = true;
  }
  function status(row, now) {
    const msg = row.data;
    const sent = msg && stamp(msg.ts);
    const ttl = msg && typeof msg.ttl_s === "number" && msg.ttl_s > 0 ? msg.ttl_s * 1000 : 60000;
    const age = Math.max(now - row.received, sent == null ? 0 : now - sent);
    let mode = "SOURCE UNSPECIFIED";
    if (msg && (msg.data_mode === "simulated" || msg.mock === true || msg.simulated === true || msg.is_mock === true)) mode = "SIM";
    else if (msg && msg.data_mode) mode = String(msg.data_mode).toUpperCase();
    const quality = msg && (msg.valid === false || msg.quality === "invalid") ? "INVALID" : age > ttl ? "STALE" : "RECEIVED";
    return mode + " · " + quality + (row.retained ? " · retained" : "") + " · " + Math.max(0, Math.floor(age / 1000)) + " s";
  }
  function esc(value) {
    return String(value == null ? "null" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fields(value, path, rows) {
    if (value && typeof value === "object" && Object.keys(value).length) {
      Object.keys(value).forEach(function (key) { fields(value[key], path ? path + "." + key : key, rows); });
    } else rows.push([path || "value", value == null ? "unknown" : typeof value === "object" ? JSON.stringify(value) : String(value)]);
    return rows;
  }
  function paint() {
    const host = root.document && document.getElementById("mqtt-telemetry");
    if (!host) return;
    if (!host.dataset.ready) {
      host.dataset.ready = "true";
      host.innerHTML = '<details><summary>MQTT feed · <span id="mqtt-count">waiting</span></summary>' +
        '<p>Every received topic and field is available below. Receipt alone does not prove a real sensor or a completed transfer. Unspecified sources remain unverified. The packhouse transfer animation is SIM.</p>' +
        '<label>Bench node <select id="mqtt-node"><option value="">Waiting for a node</option></select></label>' +
        '<div id="mqtt-topics"></div></details>';
      document.getElementById("mqtt-node").addEventListener("change", function (event) {
        if (root.HoldSelectCold) root.HoldSelectCold(event.target.value);
      });
    }
    const now = Date.now();
    const count = document.getElementById("mqtt-count");
    let messages = 0;
    topics.forEach(function (row) { messages += row.count; });
    count.textContent = topics.size + " topics · " + messages + " messages this session";
    const list = document.getElementById("mqtt-topics");
    const nodes = new Set();
    topics.forEach(function (row, topic) {
      const parts = topic.split("/");
      if (parts[0] === "nesl_coldems" && parts[1]) nodes.add(parts[1]);
      let item = Array.from(list.children).find(function (child) { return child.dataset.topic === topic; });
      if (!item) {
        item = document.createElement("details");
        item.dataset.topic = topic;
        item.innerHTML = '<summary></summary><p class="mqtt-quality"></p><div class="mqtt-fields"></div>';
        list.appendChild(item);
        item.addEventListener("toggle", function () { dirty = true; });
      }
      item.querySelector("summary").textContent = topic + " · " + row.count + " messages";
      item.querySelector(".mqtt-quality").textContent = status(row, now);
      if (item.open && (dirty || item.dataset.received !== String(row.received))) {
        const values = fields(row.data == null ? row.raw : row.data, "", []);
        item.querySelector(".mqtt-fields").innerHTML = '<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>' + values.map(function (pair) {
          return '<tr><td>' + esc(pair[0]) + '</td><td>' + esc(pair[1]) + '</td></tr>';
        }).join("") + '</tbody></table><details><summary>Original payload</summary><pre class="raw">' + esc(row.raw) + '</pre></details>';
        item.dataset.received = String(row.received);
      }
    });
    const select = document.getElementById("mqtt-node");
    nodes.forEach(function (id) {
      if (!Array.from(select.options).some(function (option) { return option.value === id; })) {
        const option = document.createElement("option"); option.value = id; option.textContent = id; select.appendChild(option);
        if (!select.value) select.value = id;
      }
    });
    dirty = false;
  }
  root.HoldTelemetry = { capture: capture, topics: topics, status: status, fields: fields, paint: paint };
  if (root.document) { paint(); setInterval(paint, 1000); }
})(typeof window === "undefined" ? globalThis : window);
