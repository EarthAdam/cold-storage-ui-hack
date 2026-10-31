(function () {
  var LOG = "http://127.0.0.1:8732";
  var picked = "";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function clock(ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function json(body) {
    try { return JSON.parse(body); } catch (e) { return null; }
  }

  function get(path) {
    return fetch(LOG + path).then(function (res) {
      if (!res.ok) throw new Error(res.status + " " + path);
      return res.json();
    });
  }

  function showCall(env) {
    var card = document.getElementById("call");
    var msg = env && json(env.body);
    var text = msg && msg.maintenance && msg.maintenance.message;
    if (!text) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    card.querySelector(".who").textContent = msg.maintenance.who || "Act";
    card.querySelector(".msg").textContent = text;
  }

  function showFacts(item) {
    var host = document.getElementById("facts");
    if (!item) {
      host.hidden = true;
      showCall(null);
      return;
    }
    host.hidden = false;
    var env = item.env || {};
    var power = item.power || {};
    function cell(label, value) {
      return "<div><span>" + label + "</span><b>" + esc(value) + "</b></div>";
    }
    host.innerHTML =
      cell("Temperature", env.temperature_C == null ? "—" : env.temperature_C + " °C") +
      cell("Humidity", env.humidity_percent == null ? "—" : env.humidity_percent + " %") +
      cell("Door", env.door_open == null ? "—" : (env.door_open ? "open" : "shut")) +
      cell("Power", power.watts == null ? "—" : Math.round(power.watts) + " W") +
      cell("Volts", power.volts == null ? "—" : Math.round(power.volts) + " V") +
      cell("Last", clock(item.ts)) +
      cell("Rows", item.n == null ? "—" : item.n);
    showCall(item.env);
  }

  function showRows(rows) {
    var body = document.getElementById("rows");
    var raw = document.getElementById("body");
    raw.hidden = true;
    body.innerHTML = (rows || []).map(function (row, i) {
      return "<tr data-i=\"" + i + "\"><td>" + clock(row.ts) + "</td><td>" + esc(row.kind) + "</td><td>" +
        esc(row.temperature_C == null ? "" : row.temperature_C) + "</td><td>" +
        esc(row.humidity_percent == null ? "" : row.humidity_percent) + "</td><td>" +
        (row.door_open == null ? "" : (row.door_open ? "open" : "shut")) + "</td><td>" +
        esc(row.watts == null ? "" : Math.round(row.watts)) + "</td><td>" +
        esc(row.volts == null ? "" : Math.round(row.volts)) + "</td></tr>";
    }).join("");
    body._rows = rows || [];
  }

  function paintBoards(list) {
    var host = document.getElementById("boards");
    if (!list.length) {
      host.innerHTML = "<p class=\"dim\">No board has published into this log yet.</p>";
      showFacts(null);
      return;
    }
    if (!picked || !list.some(function (item) { return item.device === picked; })) picked = list[0].device;
    host.innerHTML = list.map(function (item) {
      return "<button type=\"button\" data-device=\"" + esc(item.device) + "\"" +
        (item.device === picked ? " class=\"on\"" : "") + ">" + esc(item.device) + "</button>";
    }).join("");
    var current = null;
    list.forEach(function (item) { if (item.device === picked) current = item; });
    showFacts(current);
    var box = document.getElementById("q-device");
    if (box && !box.value) box.value = picked;
  }

  var INK = { env: "#7dcea0", power: "#e6c56a", door: "#e36b52", geojson: "#3aa0d8", cmd: "#e7a090", other: "#93a399" };

  function ageWord(ms) {
    var s = ms / 1000;
    if (s < 90) return Math.max(1, Math.round(s)) + "s";
    var m = s / 60;
    if (m < 90) return Math.round(m) + "m";
    var h = m / 60;
    if (h < 36) return Math.round(h) + "h";
    var d = h / 24;
    return (d < 10 ? d.toFixed(d < 1 ? 1 : 0) : Math.round(d)) + "d";
  }

  function paintSpan(cov, health) {
    var host = document.getElementById("span");
    if (!cov || !cov.lanes || !cov.lanes.length) {
      var hearing = health && health.topics && health.topics.length ? " Hearing " + health.topics.join(", ") + "." : "";
      host.innerHTML = "<p class=\"dim\">The listener is on" + (health && health.mqtt ? " and the broker accepted the subscriptions." : ".") + " No publish has arrived, so there is no bar yet." + hearing + "</p>";
      return;
    }
    var labelW = 188;
    var W = 760;
    var x0 = labelW;
    var x1 = 744;
    var top = 6;
    var laneH = 22;
    var gap = 8;
    var H = top + cov.lanes.length * (laneH + gap) + 22;
    var logSpan = Math.log(cov.maxAge / cov.minAge);
    function xOf(age) {
      var t = Math.log(age / cov.minAge) / logSpan;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return x1 - t * (x1 - x0);
    }
    var html = "";
    cov.lanes.forEach(function (lane, li) {
      var y = top + li * (laneH + gap);
      var peak = 1;
      lane.bins.forEach(function (n) { if (n > peak) peak = n; });
      html += "<text font-size=\"11\" text-anchor=\"end\" x=\"" + (labelW - 8) + "\" y=\"" + (y + 15) + "\">" +
        esc(lane.device) + " " + esc(lane.kind) + "</text>";
      html += "<rect x=\"" + x0 + "\" y=\"" + y + "\" width=\"" + (x1 - x0) + "\" height=\"" + laneH + "\" fill=\"#171c19\"/>";
      lane.bins.forEach(function (n, i) {
        if (!n) return;
        var a0 = cov.edges[i];
        var a1 = cov.edges[i + 1];
        var left = xOf(a1);
        var right = xOf(a0);
        var h = Math.max(3, (n / peak) * (laneH - 4));
        var since = Math.round(cov.now - a1);
        var until = Math.round(cov.now - (i === 0 ? 0 : a0));
        var title = lane.n + " saved · this step " + n + " · " + ageWord(a0) + " to " + ageWord(a1) + " ago";
        html += "<rect class=\"bin\" data-device=\"" + esc(lane.device) + "\" data-kind=\"" + esc(lane.kind) +
          "\" data-since=\"" + since + "\" data-until=\"" + until + "\" x=\"" + left.toFixed(1) +
          "\" y=\"" + (y + laneH - h - 2).toFixed(1) + "\" width=\"" + Math.max(1.2, right - left - 1).toFixed(1) +
          "\" height=\"" + h.toFixed(1) + "\" fill=\"" + (INK[lane.kind] || INK.other) + "\"><title>" +
          esc(title) + "</title></rect>";
      });
    });
    var yAxis = top + cov.lanes.length * (laneH + gap) + 14;
    [1000, 10000, 60000, 600000, 3600000, 6 * 3600000, 86400000, 7 * 86400000, 30 * 86400000].forEach(function (age) {
      if (age < cov.minAge || age > cov.maxAge) return;
      var x = xOf(age);
      if (x1 - x < 28) return;
      html += "<text font-size=\"11\" text-anchor=\"middle\" x=\"" + x.toFixed(1) + "\" y=\"" + yAxis + "\">" + ageWord(age) + "</text>";
    });
    html += "<text font-size=\"11\" text-anchor=\"end\" x=\"" + x1 + "\" y=\"" + yAxis + "\">now</text>";
    host.innerHTML = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Saved rows on a log-time axis. Now is at the right.\">" + html + "</svg>";
  }

  function refresh() {
    var status = document.getElementById("status");
    var snap = null;
    return get("/health").then(function (health) {
      snap = health;
      return get("/verify").then(function (chain) {
        var line = health.rows + " rows. Broker " + (health.mqtt ? "connected" : "not connected") + ".";
        line += chain.ok ? " Chain holds." : " Chain broken at row " + chain.id + ".";
        if (health.topics && health.topics.length) line += " Hearing " + health.topics.join(", ") + ".";
        status.textContent = line;
        return Promise.all([get("/devices"), get("/coverage")]);
      });
    }).then(function (pair) {
      paintBoards(pair[0].devices || []);
      paintSpan(pair[1], snap);
    }).catch(function () {
      status.textContent = "Recorder is not running. From this folder: node log/record.mjs. This page can stay closed. The log still fills.";
      document.getElementById("boards").innerHTML = "";
      document.getElementById("span").innerHTML = "";
      showFacts(null);
    });
  }

  document.getElementById("span").addEventListener("click", function (ev) {
    var bin = ev.target.closest(".bin");
    if (!bin) return;
    var params = new URLSearchParams();
    params.set("device", bin.getAttribute("data-device"));
    params.set("kind", bin.getAttribute("data-kind"));
    params.set("since", bin.getAttribute("data-since"));
    params.set("until", bin.getAttribute("data-until"));
    document.getElementById("q-device").value = bin.getAttribute("data-device");
    document.getElementById("q").kind.value = bin.getAttribute("data-kind");
    get("/q?" + params.toString()).then(function (pack) {
      showRows(pack.rows || []);
    });
  });

  document.getElementById("boards").addEventListener("click", function (ev) {
    var button = ev.target.closest("button");
    if (!button) return;
    picked = button.getAttribute("data-device");
    document.getElementById("q-device").value = picked;
    refresh();
  });

  document.getElementById("rows").addEventListener("click", function (ev) {
    var tr = ev.target.closest("tr");
    if (!tr) return;
    var row = (document.getElementById("rows")._rows || [])[Number(tr.getAttribute("data-i"))];
    var raw = document.getElementById("body");
    if (!row) return;
    raw.hidden = false;
    raw.textContent = row.body;
  });

  document.getElementById("q").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var data = new FormData(ev.target);
    var params = new URLSearchParams();
    data.forEach(function (value, key) {
      if (!value) return;
      if ((key === "since" || key === "until") && value) {
        var t = Date.parse(value);
        if (!Number.isNaN(t)) params.set(key, String(t));
        return;
      }
      params.set(key, value);
    });
    get("/q?" + params.toString()).then(function (pack) {
      showRows(pack.rows || []);
    }).catch(function () {
      document.getElementById("status").textContent = "Query failed. Is the recorder on 127.0.0.1:8732?";
    });
  });

  refresh();
  setInterval(refresh, 5000);
})();
