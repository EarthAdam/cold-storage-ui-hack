/* One local day. Noon at the top, midnight at the bottom, clockwise.
   Sun times are computed for the site (East Africa Time, UTC+3).
   Work and cold arcs are an illustrative routine, not a log. */
(function () {
  var TZ = 3;
  var CX = 250;
  var CY = 250;
  var X0 = 118;
  var X1 = 988;
  var YT = 46;
  var YB = 188;

  var PROFILES = {
    landing: {
      name: "Kilifi",
      lat: -3.634,
      lng: 39.849,
      line: "The day fleet circles the grounds through the fast morning, then comes alongside the pier around 10:30. The night fleet is at the pier by dawn.",
      rings: [
        { id: "pv", name: "PV", color: "#e6c56a", sun: "day", watch: true, label: "Compressors can run on the sun" },
        { id: "bat", name: "Battery", color: "#7eb0c8", sun: "night", watch: true, label: "Night hold. The rooms ride the battery" },
        { id: "dayfleet", name: "Day fleet", color: "#5bb3d0", label: "Circling the grounds. Pier around 10:30", spans: [{ from: 5.2, to: 11.5 }] },
        { id: "nightfleet", name: "Night fleet", color: "#3d7ea0", label: "Alongside the pier by dawn", spans: [{ from: 16.8, to: 6.5 }] },
        { id: "off", name: "Offload", color: "#e0b09a", watch: true, label: "Catch onto the quay, into ice", spans: [{ from: 5.5, to: 7.2 }, { from: 10.2, to: 11.6 }] },
        { id: "hold", name: "In the hold", color: "#7dcea0", label: "Ice hold and blast", spans: [{ from: 5.7, to: 16 }] },
        { id: "sell", name: "Sell", color: "#e7a090", label: "Market, then kitchens", spans: [{ from: 8, to: 21 }] },
        { id: "ice", name: "Ice aboard", color: "#efc6b2", label: "Ice on before they leave", spans: [{ from: 5.0, to: 6.2 }, { from: 15.0, to: 17.2 }] }
      ]
    },
    clinic: {
      name: "Butali Chegulo",
      lat: 0.514,
      lng: 34.768,
      line: "The front door, the vaccine lid, and the oxytocin lid take turns. A cabinet opens for one draw, then shuts. Freeze and heat are both losses.",
      rings: [
        { id: "pv", name: "PV", color: "#e6c56a", sun: "day", label: "Sun on the roof" },
        { id: "bat", name: "Battery", color: "#7eb0c8", sun: "night", watch: true, label: "Closed cabinet. This is the autonomy watch" },
        { id: "door", name: "Hours", color: "#e36b52", watch: true, window: true, label: "Staff here. One door at a time", spans: [{ from: 8, to: 17 }] },
        { id: "in", name: "Receipt", color: "#b7a6e6", label: "Vaccine and oxytocin in", spans: [{ from: 7.5, to: 9.5 }] },
        { id: "out", name: "Issue", color: "#c8baf0", label: "Issue, outreach, markets, school", spans: [{ from: 9, to: 16 }] }
      ]
    },
    packhouse: {
      name: "Hells Gate",
      lat: -0.735,
      lng: 36.436,
      line: "Harvest in the cool. The hard hours are midday: field heat, a full room, and the strongest sun at the same time.",
      rings: [
        { id: "pv", name: "PV", color: "#e6c56a", sun: "day", label: "Sun covers the cooling load" },
        { id: "bat", name: "Battery", color: "#7eb0c8", sun: "night", label: "Night hold after the shed empties" },
        { id: "cut", name: "Harvest", color: "#a8c96e", label: "Cut while the field is cool", spans: [{ from: 6, to: 10 }] },
        { id: "pre", name: "Precool", color: "#bdd98a", watch: true, label: "Intake and pull the field heat", spans: [{ from: 7, to: 12 }] },
        { id: "heat", name: "Heat of day", color: "#e08a62", watch: true, label: "Full rooms through the hottest hours", spans: [{ from: 10, to: 16 }] },
        { id: "truck", name: "Truck", color: "#c4a574", label: "Out to the kitchens", spans: [{ from: 14, to: 18.5 }] }
      ]
    },
    desk: {
      name: "COLD-EMS",
      lat: 0,
      lng: 0,
      line: "The hand is Eastern time. The lines are phase volts and leakage from the node.",
      rings: []
    }
  };

  var metricR0 = 56;
  var metricR1 = 118;
  var handIn = 50;
  var handOut = 214;
  var drawn = "";
  var metricKey = "";
  var metricPack = null;
  var handEl = null;
  var tipEl = null;
  var handHit = null;
  var tipHit = null;
  var timeEl = null;
  var readTemp = null;
  var readRest = null;
  var rows = [];

  function eatNow() {
    return new Date(Date.now() + TZ * 3600000);
  }

  function easternParts(ts) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(ts));
  }

  function easternNum(parts, type) {
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i].type === type) return Number(parts[i].value);
    }
    return 0;
  }

  function easternHour(ts) {
    var parts = easternParts(ts);
    var h = easternNum(parts, "hour");
    if (h === 24) h = 0;
    return h + easternNum(parts, "minute") / 60 + easternNum(parts, "second") / 3600;
  }

  function easternDateKey(ts) {
    var parts = easternParts(ts);
    return easternNum(parts, "year") + "-" + easternNum(parts, "month") + "-" + easternNum(parts, "day");
  }

  function hoursNow() {
    var t = eatNow();
    return t.getUTCHours() + t.getUTCMinutes() / 60 + t.getUTCSeconds() / 3600;
  }

  function dateParts() {
    var t = eatNow();
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  function fmt(h) {
    var x = ((h % 24) + 24) % 24;
    var hh = Math.floor(x);
    var mm = Math.round((x - hh) * 60);
    if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
    return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
  }

  function clock(h) {
    var x = ((h % 24) + 24) % 24;
    var hh = Math.floor(x);
    var mm = Math.floor((x - hh) * 60);
    var ss = Math.floor((x * 3600) % 60);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(hh) + ":" + p(mm) + ":" + p(ss);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function xAt(h) {
    var x = h >= 24 ? 24 : ((h % 24) + 24) % 24;
    return X0 + (x / 24) * (X1 - X0);
  }

  function pieces(from, to) {
    if (to === from) return [];
    if (to > from) return [[from, to]];
    return [[from, 24], [0, to]];
  }

  function band(cls, from, to, y, h) {
    var out = "";
    pieces(from, to).forEach(function (seg) {
      var x = xAt(seg[0]);
      var w = Math.max(2, xAt(seg[1]) - x);
      out += '<rect class="wash ' + cls + '" x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + h + '"/>';
    });
    return out;
  }

  function polar(h, r) {
    var a = ((h - 12 + 24) % 24) / 24 * Math.PI * 2;
    return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
  }

  function spanLen(from, to) {
    return (to - from + 24) % 24;
  }

  function contains(from, to, h) {
    return spanLen(from, h) <= spanLen(from, to) + 1e-6;
  }

  function arc(r0, r1, from, to) {
    var len = spanLen(from, to);
    if (len < 0.02) return "";
    var large = len > 12 ? 1 : 0;
    var a = polar(from, r1);
    var b = polar(to, r1);
    var c = polar(to, r0);
    var d = polar(from, r0);
    return "M" + a[0].toFixed(2) + " " + a[1].toFixed(2) +
      " A" + r1 + " " + r1 + " 0 " + large + " 1 " + b[0].toFixed(2) + " " + b[1].toFixed(2) +
      " L" + c[0].toFixed(2) + " " + c[1].toFixed(2) +
      " A" + r0 + " " + r0 + " 0 " + large + " 0 " + d[0].toFixed(2) + " " + d[1].toFixed(2) + " Z";
  }

  /* SunCalc-style solar times. Returns fractional hours in East Africa Time. */
  function sun(lat, lng, y, m, d) {
    var PI = Math.PI;
    var rad = PI / 180;
    var dayMs = 86400000;
    var J1970 = 2440588;
    var J2000 = 2451545;
    var date = Date.UTC(y, m - 1, d, 12, 0, 0);
    function toDays(ms) { return (ms / dayMs - 0.5 + J1970) - J2000; }
    function fromJ(j) { return (j + 0.5 - J1970) * dayMs; }
    var lw = rad * -lng;
    var phi = rad * lat;
    var days = toDays(date);
    var n = Math.round(days - 0.0009 - lw / (2 * PI));
    var ds = 0.0009 + lw / (2 * PI) + n;
    var M = rad * (357.5291 + 0.98560028 * ds);
    var L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + PI;
    var dec = Math.asin(Math.sin(L) * Math.sin(rad * 23.4397));
    var Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    function edge(alt) {
      var h = alt * rad;
      var w = Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
      var a = 0.0009 + (w + lw) / (2 * PI) + n;
      var Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
      var Jrise = Jnoon - (Jset - Jnoon);
      return [fromJ(Jrise), fromJ(Jset)];
    }
    function eat(ms) {
      var t = new Date(ms + TZ * 3600000);
      return t.getUTCHours() + t.getUTCMinutes() / 60 + t.getUTCSeconds() / 3600;
    }
    var day = edge(-0.833);
    var civil = edge(-6);
    return {
      rise: eat(day[0]),
      set: eat(day[1]),
      noon: eat(fromJ(Jnoon)),
      civil0: eat(civil[0]),
      civil1: eat(civil[1])
    };
  }

  function ringsFor(profile, light) {
    return profile.rings.map(function (ring) {
      var spans = ring.spans;
      if (ring.sun === "day") spans = [{ from: light.rise, to: light.set }];
      if (ring.sun === "night") spans = [{ from: light.set, to: light.rise }];
      return {
        id: ring.id,
        name: ring.name,
        color: ring.color,
        watch: !!ring.watch,
        window: !!ring.window,
        label: ring.label,
        marks: ring.marks || null,
        spans: spans || []
      };
    });
  }

  function ticks() {
    var out = "";
    for (var i = 0; i < 24; i++) {
      var major = i % 6 === 0;
      var a = polar(i, major ? 196 : 202);
      var b = polar(i, 210);
      out += '<line class="tick' + (major ? " major" : "") + '" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) +
        '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>';
    }
    [[12, "12"], [18, "18"], [0, "00"], [6, "06"]].forEach(function (pair) {
      var p = polar(pair[0], 226);
      out += '<text class="hour" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + pair[1] + "</text>";
    });
    return out;
  }

  function build(id) {
    var host = document.getElementById("day-face");
    var lead = document.getElementById("day-lead");
    var sunEl = document.getElementById("day-sun");
    var key = document.getElementById("day-key");
    if (!host) return;
    var profile = PROFILES[id] || PROFILES.clinic;
    var parts = dateParts();
    var light = sun(profile.lat, profile.lng, parts.y, parts.m, parts.d);
    var rings = ringsFor(profile, light);
    if (id === "clinic" && window.CLINIC_DOORS) {
      rings.push(
        { id: "front", name: "Front door", color: "#e7a090", watch: true, window: false, label: "Patients. Not a cabinet", marks: window.CLINIC_DOORS.front, spans: [] },
        { id: "vax", name: "Vaccine lid", color: "#f4efe6", watch: true, window: false, label: "One draw, then shut", marks: window.CLINIC_DOORS.vaccine, spans: [] },
        { id: "oxylid", name: "Oxytocin lid", color: "#e24b4b", watch: true, window: false, label: "A different draw", marks: window.CLINIC_DOORS.oxy, spans: [] }
      );
    }
    if (lead) lead.textContent = profile.line;
    if (sunEl) {
      sunEl.textContent = id === "desk"
        ? "Eastern time · America/New_York"
        : profile.name + " · rise " + fmt(light.rise) + " · noon " + fmt(light.noon) + " · set " + fmt(light.set);
    }
    var thick = 10;
    var gap = 2;
    var r1 = 198;
    var arcs = "";
    rings.forEach(function (ring) {
      var r0 = r1 - thick;
      ring.spans.forEach(function (span) {
        pieces(span.from, span.to).forEach(function (seg) {
          var d = arc(r0, r1, seg[0], seg[1]);
          if (!d) return;
          arcs += '<path class="ring' + (ring.watch ? " watch" : "") + (ring.window ? " window" : "") + '" data-id="' + ring.id + '" data-ring="' + ring.id +
            '" d="' + d + '" fill="' + ring.color + '"><title>' + esc(ring.id) + "</title></path>";
        });
      });
      (ring.marks || []).forEach(function (h) {
        var a = polar(h, r0 - 1);
        var b = polar(h, r1 + 1);
        arcs += '<line class="hit" data-id="' + ring.id + '" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) +
          '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>';
        arcs += '<line class="open-mark" data-id="' + ring.id + '" data-ring="' + ring.id + '" stroke="' + ring.color +
          '" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) +
          '"><title>' + esc(ring.id) + "</title></line>";
      });
      r1 = r0 - gap;
    });
    metricR1 = Math.max(78, r1 - 2);
    metricR0 = 58;
    handIn = 48;
    handOut = 214;
    var wash = id === "desk" ? "" : (
      '<path class="wash civil" d="' + arc(metricR0, 198, light.civil0, light.civil1) + '"/>' +
      '<path class="wash day" d="' + arc(metricR0, 198, light.rise, light.set) + '"/>'
    );
    var noon = polar(12, handOut);
    host.innerHTML =
      '<svg class="day-svg" viewBox="0 0 500 500" role="img" aria-label="24 hour clock for ' + esc(profile.name) + '. Noon at the top, midnight at the bottom, clockwise.">' +
        wash +
        arcs +
        ticks() +
        '<g class="metrics"></g>' +
        '<line class="hand" data-hand="1" x1="' + CX + '" y1="' + CY + '" x2="' + noon[0].toFixed(1) + '" y2="' + noon[1].toFixed(1) + '"/>' +
        '<circle class="tip" data-tip="1" cx="' + noon[0].toFixed(1) + '" cy="' + noon[1].toFixed(1) + '" r="3.5"/>' +
        '<line class="hand-hit" data-hand-hit="1" x1="' + CX + '" y1="' + CY + '" x2="' + noon[0].toFixed(1) + '" y2="' + noon[1].toFixed(1) + '"/>' +
        '<circle class="tip-hit" data-tip-hit="1" cx="' + noon[0].toFixed(1) + '" cy="' + noon[1].toFixed(1) + '" r="16"/>' +
        '<circle class="hub" cx="' + CX + '" cy="' + CY + '" r="40"/>' +
        '<text class="clock" data-time="1" x="' + CX + '" y="' + (CY - 6) + '">00:00:00</text>' +
        '<text class="clock-sub" x="' + CX + '" y="' + (CY + 10) + '">' + (id === "desk" ? "Eastern" : "drag hand") + '</text>' +
        '<text class="read" data-read="temp" x="' + CX + '" y="' + (CY + 24) + '"></text>' +
        '<text class="read rest" data-read="rest" x="' + CX + '" y="492"></text>' +
        '<text class="hover-id" x="0" y="0" visibility="hidden"></text>' +
      "</svg>";
    handEl = host.querySelector("[data-hand]");
    tipEl = host.querySelector("[data-tip]");
    handHit = host.querySelector("[data-hand-hit]");
    tipHit = host.querySelector("[data-tip-hit]");
    timeEl = host.querySelector("[data-time]");
    readTemp = host.querySelector("[data-read=temp]");
    readRest = host.querySelector("[data-read=rest]");
    metricKey = "";
    rows = [];
    if (key && id === "desk") {
      key.innerHTML = [
        ["vA", "#e6c56a", "Phase A", "mains · phases.A.voltage_ln"],
        ["vB", "#7dcea0", "Phase B", "mains · phases.B.voltage_ln"],
        ["vC", "#3aa0d8", "Phase C", "mains · phases.C.voltage_ln"],
        ["W", "#f4efe6", "Power", "mains · phases.A|B|C.real_power_w"],
        ["mA", "#e08a62", "Leak A", "leakage · sensors.A.leakage_ma"],
        ["mB", "#c4a574", "Leak B", "leakage · sensors.B.leakage_ma"],
        ["mC", "#e7a090", "Leak C", "leakage · sensors.C.leakage_ma"]
      ].map(function (row) {
        return '<button type="button" class="day-row" data-trace="' + row[0] + '">' +
          '<i style="background:' + row[1] + '"></i>' +
          "<b>" + row[2] + "</b>" +
          "<span>" + row[3] + "</span>" +
          "</button>";
      }).join("");
      rows = [].slice.call(key.querySelectorAll(".day-row"));
      rows.forEach(function (row) {
        row.addEventListener("mouseenter", function () { dim(null, row.getAttribute("data-trace")); });
        row.addEventListener("mouseleave", function () { dim(null, null); });
        row.addEventListener("focus", function () { dim(null, row.getAttribute("data-trace")); });
        row.addEventListener("blur", function () { dim(null, null); });
      });
    } else if (key) {
      var work = rings.map(function (ring) {
        var rowsHtml = ring.spans.map(function (span) {
          return '<button type="button" class="day-row' + (ring.watch ? " watch" : "") + '" data-ring="' + ring.id +
            '" data-from="' + span.from + '" data-to="' + span.to + '">' +
            '<i style="background:' + ring.color + '"></i>' +
            "<b>" + esc(ring.name) + "</b>" +
            "<span>" + esc(ring.label) + "</span>" +
            '<span class="when">' + fmt(span.from) + "–" + fmt(span.to) + "</span>" +
            "</button>";
        }).join("");
        if (ring.marks && ring.marks.length) {
          rowsHtml += '<button type="button" class="day-row watch" data-ring="' + ring.id +
            '" data-marks="' + ring.marks.join(",") + '">' +
            '<i style="background:' + ring.color + '"></i>' +
            "<b>Openings</b>" +
            "<span>Each mark is one short open. Illustrative.</span>" +
            '<span class="when">' + ring.marks.length + "</span>" +
            "</button>";
        }
        return rowsHtml;
      }).join("");
      key.innerHTML =
        '<button type="button" class="day-row" data-trace="temp"><i style="background:#e08a62"></i><b>Temperature</b><span>Each cold room, its own color. Up is warmer.</span></button>' +
        '<button type="button" class="day-row" data-trace="rh"><i style="background:#3aa0d8"></i><b>Humidity</b><span>The room you have open. Up is wetter.</span></button>' +
        '<button type="button" class="day-row" data-trace="power"><i style="background:#e6c56a"></i><b>Power</b><span>The room you have open. Up is more watts.</span></button>' +
        '<button type="button" class="day-row" data-trace="door"><i style="background:#e36b52"></i><b>Door</b><span>The room you have open. A tick is open.</span></button>' +
        work;
      rows = [].slice.call(key.querySelectorAll(".day-row"));
      rows.forEach(function (row) {
        row.addEventListener("mouseenter", function () { dim(row.getAttribute("data-ring"), row.getAttribute("data-trace")); });
        row.addEventListener("mouseleave", function () { dim(null, null); });
        row.addEventListener("focus", function () { dim(row.getAttribute("data-ring"), row.getAttribute("data-trace")); });
        row.addEventListener("blur", function () { dim(null, null); });
      });
    }
  }

  function dim(ringId, traceId) {
    var svg = document.querySelector(".day-svg");
    if (!svg) return;
    svg.classList.toggle("is-dim", !!ringId || !!traceId);
    [].slice.call(svg.querySelectorAll(".ring, .open-mark")).forEach(function (path) {
      path.classList.toggle("on", !!ringId && path.getAttribute("data-ring") === ringId);
    });
    [].slice.call(svg.querySelectorAll(".trace, .door-tick")).forEach(function (path) {
      path.classList.toggle("on", !!traceId && path.getAttribute("data-trace") === traceId);
    });
  }

  var FAST_MS = 6000;
  var SLOW_MS = 12000;
  var anchorHour = 6;
  var anchorMs = Date.now();
  var scrub = null;

  function normHour(h) {
    return ((h % 24) + 24) % 24;
  }

  function restart() {
    anchorHour = 6;
    anchorMs = Date.now();
    scrub = null;
  }

  function simHour() {
    if (window.HoldDesk && window.HoldDesk()) return easternHour(Date.now());
    if (scrub != null) return normHour(scrub);
    var h = normHour(anchorHour);
    var left = Date.now() - anchorMs;
    var passedFast = h >= 10;
    var i;
    for (i = 0; i < 6 && left > 0; i++) {
      var fast = !passedFast && h >= 6 && h < 10;
      var msH = fast ? FAST_MS / 4 : SLOW_MS;
      var dest = fast ? 10 : (h < 6 ? 6 : 24);
      var need = (dest - h) * msH;
      if (need <= 0) {
        h = dest % 24;
        if (dest === 10) passedFast = true;
        continue;
      }
      if (left < need) return h + left / msH;
      left -= need;
      h = dest % 24;
      if (dest === 10) passedFast = true;
    }
    return normHour(h);
  }

  function hourFromEvent(ev) {
    var svg = document.querySelector(".day-svg");
    var p = svgPoint(svg, ev);
    if (!p) return null;
    var a = Math.atan2(p.x - CX, -(p.y - CY));
    if (a < 0) a += Math.PI * 2;
    return normHour(12 + (a / (Math.PI * 2)) * 24);
  }

  function bindHand() {
    var face = document.getElementById("day-face");
    if (!face || face.getAttribute("data-hand-drag")) return;
    face.setAttribute("data-hand-drag", "1");
    var dragging = false;
    face.addEventListener("pointerdown", function (ev) {
      if (window.HoldDesk && window.HoldDesk()) return;
      var hit = ev.target.closest && ev.target.closest("[data-hand-hit], [data-tip-hit]");
      if (!hit || !face.contains(hit)) return;
      dragging = true;
      scrub = hourFromEvent(ev);
      if (face.setPointerCapture) face.setPointerCapture(ev.pointerId);
      var svg = face.querySelector(".day-svg");
      if (svg) svg.classList.add("is-drag");
      ev.preventDefault();
    });
    face.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      var h = hourFromEvent(ev);
      if (h == null) return;
      scrub = h;
      moveHand();
      if (window.HoldRepaint) window.HoldRepaint();
    });
    function endDrag(ev) {
      if (!dragging) return;
      dragging = false;
      var h = hourFromEvent(ev);
      if (h == null) h = scrub == null ? anchorHour : scrub;
      scrub = null;
      anchorHour = h;
      anchorMs = Date.now();
      var svg = face.querySelector(".day-svg");
      if (svg) svg.classList.remove("is-drag");
      moveHand();
      if (window.HoldRepaint) window.HoldRepaint();
    }
    face.addEventListener("pointerup", endDrag);
    face.addEventListener("pointercancel", endDrag);
  }

  var ROOM_INK = {
    vaccine: "#f4efe6",
    oxy: "#e24b4b",
    insulin: "#c45b78",
    ice: "#9fd4ea",
    day: "#3aa0d8",
    blast: "#1d6a86",
    leaf: "#3d9a4a",
    tomato: "#d4532a",
    out: "#2f86c8"
  };

  function showTemp(c, unit) {
    if (c == null || isNaN(c)) return "—";
    var v = unit === "F" ? (c * 9 / 5) + 32 : c;
    return v.toFixed(1) + (unit === "F" ? "°F" : "°C");
  }

  function extent(pts, pick) {
    var lo = Infinity;
    var hi = -Infinity;
    pts.forEach(function (p) {
      var v = pick(p);
      if (v == null || isNaN(v)) return;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    });
    if (!(hi > lo) || hi - lo < 0.35) return null;
    var pad = (hi - lo) * 0.12;
    return [lo - pad, hi + pad];
  }

  function rAt(v, ext) {
    var t = 0.5;
    if (ext && v != null && !isNaN(v)) {
      t = (v - ext[0]) / (ext[1] - ext[0]);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }
    return metricR0 + t * (metricR1 - metricR0);
  }

  function poly(pts, pick, ext) {
    var d = "";
    pts.forEach(function (p) {
      var v = pick(p);
      if (v == null || isNaN(v)) return;
      var q = polar(p.h, rAt(v, ext));
      d += (d ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1);
    });
    return d;
  }

  function nearest(pts, h) {
    var best = pts[0];
    var bestD = 99;
    var i;
    for (i = 0; i < pts.length; i++) {
      var d = Math.abs(pts[i].h - h);
      d = Math.min(d, 24 - d);
      if (d < bestD) { bestD = d; best = pts[i]; }
    }
    return best;
  }

  function deskT(v, ext) {
    var t = 0;
    if (ext && v != null && !isNaN(v) && ext[1] > ext[0]) {
      t = (v - ext[0]) / (ext[1] - ext[0]);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }
    return t;
  }

  function laneRadius(i, n, t) {
    var span = (metricR1 - metricR0) / Math.max(1, n);
    var inner = metricR0 + (n - 1 - i) * span;
    var outer = inner + span - 3;
    if (outer < inner) outer = inner;
    return inner + t * (outer - inner);
  }

  function polyLane(pts, pick, ext, i, n) {
    var d = "";
    pts.forEach(function (p) {
      var v = pick(p);
      if (v == null || isNaN(v)) return;
      var q = polar(p.h, laneRadius(i, n, deskT(v, ext)));
      d += (d ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1);
    });
    return d;
  }

  function deskTrace(lane, n) {
    var d = polyLane(lane.pts, lane.pick, lane.ext, lane.i, n);
    var guide = laneRadius(lane.i, n, 0);
    var nameAt = polar(15.2, laneRadius(lane.i, n, 0.35));
    var html = '<circle class="lane-guide" cx="' + CX + '" cy="' + CY + '" r="' + guide.toFixed(1) +
      '" fill="none" stroke="' + lane.color + '" stroke-width="1"/>';
    html += '<text class="lane-label out" fill="' + lane.color + '" x="' + nameAt[0].toFixed(1) +
      '" y="' + nameAt[1].toFixed(1) + '">' + esc(lane.name) + "</text>";
    if (!d) return html;
    html += '<path class="hit" data-id="' + lane.id + '" d="' + d + '"/>';
    html += '<path class="trace pick' + (lane.leak ? " leak" : "") + '" data-id="' + lane.id + '" data-trace="' + lane.id +
      '" d="' + d + '" stroke="' + lane.color + '"><title>' + esc(lane.id) + "</title></path>";
    html += '<circle class="now-dot" data-dot="' + lane.id + '" r="2.6" fill="' + lane.color + '"/>';
    return html;
  }

  function drawDeskMetrics() {
    var g = document.querySelector(".day-svg .metrics");
    if (!g || !window.HoldDeskSeries) return;
    var pack = window.HoldDeskSeries();
    var mains = pack.mains || [];
    var leak = pack.leak || [];
    var room = pack.room || [];
    var key = "desk:" + pack.rev + ":" + room.length;
    if (key === metricKey && g.childNodes.length) return;
    metricKey = key;
    var hi = 1;
    leak.forEach(function (p) {
      [p.mA, p.mB, p.mC].forEach(function (v) {
        if (v != null && v > hi) hi = v;
      });
    });
    var lanes = [
      { id: "vA", name: "A", color: "#e6c56a", ext: [0, 260], pts: mains, pick: function (p) { return p.vA; } },
      { id: "vB", name: "B", color: "#7dcea0", ext: [0, 260], pts: mains, pick: function (p) { return p.vB; } },
      { id: "vC", name: "C", color: "#3aa0d8", ext: [0, 260], pts: mains, pick: function (p) { return p.vC; } },
      { id: "W", name: "W", color: "#f4efe6", ext: [0, 1500], pts: mains, pick: function (p) { return (p.wA || 0) + (p.wB || 0) + (p.wC || 0); } },
      { id: "mA", name: "mA", color: "#e08a62", ext: [0, hi * 1.15], pts: leak, pick: function (p) { return p.mA; }, leak: true },
      { id: "mB", name: "mB", color: "#c4a574", ext: [0, hi * 1.15], pts: leak, pick: function (p) { return p.mB; }, leak: true },
      { id: "mC", name: "mC", color: "#e7a090", ext: [0, hi * 1.15], pts: leak, pick: function (p) { return p.mC; }, leak: true }
    ];
    if (room.length) {
      lanes.push({ id: "temp", name: "°C", color: "#e08a62", ext: [-5, 30], pts: room, pick: function (p) { return p.temp; } });
      lanes.push({ id: "rh", name: "RH", color: "#3aa0d8", ext: [0, 100], pts: room, pick: function (p) { return p.rh; } });
    }
    lanes.forEach(function (lane, i) { lane.i = i; });
    pack.lanes = lanes;
    pack.laneN = lanes.length;
    metricPack = pack;
    g.innerHTML = lanes.map(function (lane) { return deskTrace(lane, lanes.length); }).join("");
  }

  function readDesk(h) {
    drawDeskMetrics();
    if (!metricPack || !metricPack.lanes) return;
    var mains = metricPack.mains || [];
    var leak = metricPack.leak || [];
    var room = metricPack.room || [];
    var m = mains.length ? mains[mains.length - 1] : null;
    var l = leak.length ? leak[leak.length - 1] : null;
    var probe = room.length ? room[room.length - 1] : null;
    if (readTemp) {
      readTemp.textContent = probe && probe.temp != null
        ? showTemp(probe.temp, metricPack.unit)
        : (m ? Math.round(m.vA) + " / " + Math.round(m.vB) + " / " + Math.round(m.vC) + " V" : "no mains yet");
    }
    if (readRest) {
      var rest = l ? "leak " + l.mA + " / " + l.mB + " / " + l.mC + " mA" : "no leakage yet";
      if (m) rest += " · " + Math.round((m.wA || 0) + (m.wB || 0) + (m.wC || 0)) + " W";
      if (probe && probe.rh != null) rest += " · " + Math.round(probe.rh) + "%";
      readRest.textContent = rest;
    }
    metricPack.lanes.forEach(function (lane) {
      if (!lane.pts.length) return;
      var last = lane.pts[lane.pts.length - 1];
      var v = lane.pick(last);
      if (v == null || isNaN(v)) return;
      placeDot(lane.id, h, laneRadius(lane.i, metricPack.laneN, deskT(v, lane.ext)));
    });
  }

  function drawMetrics() {
    if (window.HoldDesk && window.HoldDesk()) {
      drawDeskMetrics();
      return;
    }
    var g = document.querySelector(".day-svg .metrics");
    if (!g || !window.HoldCurves) return;
    var pack = window.HoldCurves();
    if (!pack || !pack.rooms.length) return;
    metricPack = pack;
    var key = pack.profile + ":" + pack.selected;
    if (key === metricKey && g.childNodes.length) return;
    metricKey = key;
    var html = "";
    var sel = null;
    pack.rooms.forEach(function (room) {
      room._temp = extent(room.pts, function (p) { return p.temp; });
      if (room.id === pack.selected) sel = room;
      var d = poly(room.pts, function (p) { return p.temp; }, room._temp);
      html += '<path class="hit" data-id="' + room.id + '" d="' + d + '"/>';
      html += '<path class="trace temp' + (room.id === pack.selected ? " pick" : "") + '" data-id="' + room.id + '" data-trace="temp" d="' + d +
        '" stroke="' + (ROOM_INK[room.id] || "#e7eee8") + '"><title>' + esc(room.id) + "</title></path>";
    });
    if (sel) {
      sel._rh = extent(sel.pts, function (p) { return p.rh; });
      sel._w = extent(sel.pts, function (p) { return p.w; });
      var rh = poly(sel.pts, function (p) { return p.rh; }, sel._rh);
      html += '<path class="hit" data-id="rh" d="' + rh + '"/>';
      html += '<path class="trace rh pick" data-id="rh" data-trace="rh" d="' + rh +
        '" stroke="#3aa0d8"><title>rh</title></path>';
      if (sel.pts.some(function (p) { return p.w != null; })) {
        var watts = poly(sel.pts, function (p) { return p.w; }, sel._w);
        html += '<path class="hit" data-id="power" d="' + watts + '"/>';
        html += '<path class="trace power pick" data-id="power" data-trace="power" d="' + watts +
          '" stroke="#e6c56a"><title>power</title></path>';
      }
      sel.pts.forEach(function (p) {
        if (!p.door) return;
        var a = polar(p.h, metricR1 - 7);
        var b = polar(p.h, metricR1 + 3);
        html += '<line class="hit" data-id="door" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) +
          '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>';
        html += '<line class="door-tick" data-id="door" data-trace="door" stroke="#e36b52" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) +
          '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"><title>door</title></line>';
      });
      html += '<circle class="now-dot" data-dot="temp" r="3.2" fill="' + (ROOM_INK[sel.id] || "#e7eee8") + '"/>';
      html += '<circle class="now-dot" data-dot="rh" r="2.5" fill="#3aa0d8"/>';
      if (sel.pts.some(function (p) { return p.w != null; })) {
        html += '<circle class="now-dot" data-dot="power" r="2.5" fill="#e6c56a"/>';
      }
    }
    if (window.HoldBattery) {
      var bat = [];
      var bi;
      for (bi = 0; bi < 96; bi++) bat.push({ h: (bi / 96) * 24, soc: window.HoldBattery((bi / 96) * 24).soc });
      var bd = poly(bat, function (p) { return p.soc; }, [0, 1]);
      html += '<path class="hit" data-id="battery" d="' + bd + '"/>';
      html += '<path class="trace battery pick" data-id="battery" data-trace="battery" d="' + bd +
        '" stroke="#7eb0c8"><title>battery</title></path>';
      html += '<circle class="now-dot" data-dot="battery" r="2.6" fill="#7eb0c8"/>';
    }
    g.innerHTML = html;
  }

  function placeDot(kind, hour, radius) {
    var dot = document.querySelector('.day-svg .now-dot[data-dot="' + kind + '"]');
    if (!dot) return;
    var q = polar(hour, radius);
    dot.setAttribute("cx", q[0].toFixed(1));
    dot.setAttribute("cy", q[1].toFixed(1));
  }

  function readNow(h) {
    if (window.HoldDesk && window.HoldDesk()) {
      readDesk(h);
      return;
    }
    drawMetrics();
    if (!metricPack || !readTemp) return;
    var sel = null;
    metricPack.rooms.forEach(function (room) {
      if (room.id === metricPack.selected) sel = room;
    });
    if (!sel) return;
    var s = nearest(sel.pts, h);
    readTemp.textContent = showTemp(s.temp, metricPack.unit);
    var rest = s.rh == null ? "—" : Math.round(s.rh) + "%";
    if (s.w != null) rest += " · " + Math.round(s.w) + " W";
    if (s.v != null && s.v < 40) rest += " · no volts";
    if (s.door) rest += " · open";
    if (window.HoldBattery) {
      var pack = window.HoldBattery(h);
      rest += " · " + Math.round(pack.soc * 100) + "% " + (pack.flow > 0 ? "charging" : "discharging");
    }
    if (readRest) readRest.textContent = rest;
    placeDot("temp", s.h, rAt(s.temp, sel._temp));
    placeDot("rh", s.h, rAt(s.rh, sel._rh));
    if (s.w != null) placeDot("power", s.h, rAt(s.w, sel._w));
    if (window.HoldBattery) placeDot("battery", h, rAt(window.HoldBattery(h).soc, [0, 1]));
  }

  function moveHand() {
    if (!handEl) return;
    var h = simHour();
    var inner = polar(h, handIn);
    var outer = polar(h, handOut);
    handEl.setAttribute("x1", inner[0].toFixed(2));
    handEl.setAttribute("y1", inner[1].toFixed(2));
    handEl.setAttribute("x2", outer[0].toFixed(2));
    handEl.setAttribute("y2", outer[1].toFixed(2));
    if (tipEl) {
      tipEl.setAttribute("cx", outer[0].toFixed(2));
      tipEl.setAttribute("cy", outer[1].toFixed(2));
    }
    if (handHit) {
      handHit.setAttribute("x1", inner[0].toFixed(2));
      handHit.setAttribute("y1", inner[1].toFixed(2));
      handHit.setAttribute("x2", outer[0].toFixed(2));
      handHit.setAttribute("y2", outer[1].toFixed(2));
    }
    if (tipHit) {
      tipHit.setAttribute("cx", outer[0].toFixed(2));
      tipHit.setAttribute("cy", outer[1].toFixed(2));
    }
    if (timeEl) timeEl.textContent = clock(h);
    readNow(h);
    rows.forEach(function (row) {
      var marks = row.getAttribute("data-marks");
      var on = false;
      if (marks) {
        on = marks.split(",").some(function (s) {
          var at = parseFloat(s);
          var d = Math.abs(h - at);
          return Math.min(d, 24 - d) < 0.22;
        });
      } else {
        on = contains(parseFloat(row.getAttribute("data-from")), parseFloat(row.getAttribute("data-to")), h);
      }
      row.classList.toggle("now", on);
    });
  }

  var hotId = "";

  function svgPoint(svg, ev) {
    var pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  function paintHot(id, ev) {
    var svg = document.querySelector(".day-svg");
    if (!svg) return;
    svg.classList.toggle("is-dim", !!id);
    [].slice.call(svg.querySelectorAll("[data-id]")).forEach(function (node) {
      node.classList.toggle("on", !!id && node.getAttribute("data-id") === id);
    });
    var lab = svg.querySelector(".hover-id");
    if (!lab) return;
    if (!id) {
      lab.setAttribute("visibility", "hidden");
      lab.textContent = "";
      return;
    }
    lab.textContent = id;
    lab.removeAttribute("visibility");
    if (!ev) return;
    var p = svgPoint(svg, ev);
    if (!p) return;
    var end = p.x > 340;
    lab.setAttribute("text-anchor", end ? "end" : "start");
    lab.setAttribute("x", (end ? p.x - 12 : p.x + 12).toFixed(1));
    lab.setAttribute("y", Math.max(16, Math.min(p.y - 8, 486)).toFixed(1));
  }

  function bindHover() {
    var face = document.getElementById("day-face");
    if (!face || face.getAttribute("data-hover")) return;
    face.setAttribute("data-hover", "1");
    face.addEventListener("pointerover", function (ev) {
      var el = ev.target.closest && ev.target.closest("[data-id]");
      if (!el || !face.contains(el)) return;
      hotId = el.getAttribute("data-id") || "";
      paintHot(hotId, ev);
    });
    face.addEventListener("pointermove", function (ev) {
      if (hotId) paintHot(hotId, ev);
    });
    face.addEventListener("pointerout", function (ev) {
      var el = ev.target.closest && ev.target.closest("[data-id]");
      if (!el) return;
      var next = ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest("[data-id]");
      if (next && next.getAttribute("data-id") === hotId) return;
      hotId = "";
      paintHot("", null);
    });
  }

  function paint(id) {
    var parts = dateParts();
    var key = id === "desk"
      ? "desk:" + easternDateKey(Date.now())
      : id + ":" + parts.y + "-" + parts.m + "-" + parts.d;
    if (drawn !== key) {
      drawn = key;
      build(id);
    }
    moveHand();
    bindHover();
    bindHand();
  }

  window.HoldDay = { paint: paint, hour: simHour, restart: restart };
  requestAnimationFrame(function spin() {
    moveHand();
    requestAnimationFrame(spin);
  });
})();
