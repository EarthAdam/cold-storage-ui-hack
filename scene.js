/* Live OpenStreetMap, OpenFreeMap dark. Buildings extrude from zoom 14. */
(function () {
  var STYLE = "https://tiles.openfreemap.org/styles/dark";
  var PLACE = {
    clinic: "Butali Chegulo, Malava, Kakamega",
    landing: "Kilifi",
    packhouse: "Nigeria packhouse · illustrative Abuja setting"
  };
  var CLOSE = { clinic: 17, landing: 17, packhouse: 16.4 };
  var BEARING = { clinic: -28, landing: 170, packhouse: -18 };
  var frameGen = 0;
  var DOT = {
    dock: "#9fd0e4",
    market: "#e7c56a",
    kitchen: "#e7a090",
    cold: "#9ddec0",
    care: "#c4b6f0",
    farm: "#c5d68a",
    fish: "#7ec8e3"
  };
  var TRAIL = { boat: "#7ec8e3", truck: "#e6c56a", rider: "#e7a0c4", ship: "#f4efe6" };
  var GLYPH = {
    boat: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 2l6.2 11 1.6 14.2h-15.6L9.8 13z"/><path fill="#071016" d="M16 7.2l2.4 5.2h-4.8z"/></svg>',
    truck: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="10" y="5" width="12" height="20" rx="2" fill="currentColor"/><rect x="12.2" y="7.2" width="7.6" height="5" fill="#071016"/></svg>',
    rider: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="7" r="3" fill="currentColor"/><path fill="currentColor" d="M13.5 11h5l2.2 11h-9.4z"/><circle cx="11.5" cy="25" r="2.3" fill="currentColor"/><circle cx="20.5" cy="25" r="2.3" fill="currentColor"/></svg>',
    ship: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="4" width="14" height="22" rx="2" fill="currentColor"/><path fill="#8f1d2c" d="M15 9h2v4h4v2h-4v4h-2v-4h-4v-2h4z"/></svg>'
  };

  var map = null;
  var ready = false;
  var pending = null;
  var shown = null;
  var wide = false;
  var markers = {};
  var metaEl = null;
  var wideBtn = null;
  var reduce = false;
  var trackShip = false;
  var flying = false;
  var followPt = null;
  var hands = 0;
  var followBtn = null;
  var focusLL = null;
  var orbit = false;
  var chainMarkers = [];
  var batMarker = null;
  var craftList = [];
  var craftMarkers = {};
  var motion = 0;
  var pop = null;
  var shipView = null;
  var routeLine = null;
  var shipHist = [];
  var trailDirty = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function duration() {
    return reduce ? 0 : 900;
  }

  function hub(rooms) {
    var pts = (rooms || []).filter(function (r) { return r.lng != null && r.id !== "route"; });
    if (!pts.length) pts = (rooms || []).filter(function (r) { return r.lng != null; });
    if (!pts.length) return [36.85, -1.32];
    var lng = 0, lat = 0;
    pts.forEach(function (r) { lng += r.lng; lat += r.lat; });
    return [lng / pts.length, lat / pts.length];
  }

  function emptyFc() {
    return { type: "FeatureCollection", features: [] };
  }

  function addPt(bounds, lng, lat) {
    if (lng == null || lat == null || !isFinite(lng) || !isFinite(lat)) return false;
    bounds.extend([lng, lat]);
    return true;
  }

  function itemBounds(opts) {
    var bounds = new maplibregl.LngLatBounds();
    var n = 0;
    function add(lng, lat) { if (addPt(bounds, lng, lat)) n++; }
    (opts.rooms || []).forEach(function (room) { add(room.lng, room.lat); });
    (opts.route || []).forEach(function (p) { add(p[0], p[1]); });
    var chain = window.HOLD_CHAIN && window.HOLD_CHAIN[opts.profileId];
    if (chain) {
      (chain.places || []).forEach(function (p) { add(p.at[0], p.at[1]); });
      (chain.areas || []).forEach(function (area) {
        (area.ring || []).forEach(function (p) { add(p[0], p[1]); });
      });
      (chain.links || []).forEach(function (line) {
        line.forEach(function (p) { add(p[0], p[1]); });
      });
      (chain.craft || []).forEach(function (craft) {
        (craft.track || []).forEach(function (p) { add(p[0], p[1]); });
      });
    }
    if (!n) return null;
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();
    var dx = Math.max(ne.lng - sw.lng, 0.004);
    var dy = Math.max(ne.lat - sw.lat, 0.003);
    var cx = (ne.lng + sw.lng) / 2;
    var cy = (ne.lat + sw.lat) / 2;
    return new maplibregl.LngLatBounds([cx - dx / 2, cy - dy / 2], [cx + dx / 2, cy + dy / 2]);
  }

  function expandBounds(bounds, frac) {
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();
    var dx = (ne.lng - sw.lng) * frac;
    var dy = (ne.lat - sw.lat) * frac;
    return [[sw.lng - dx, sw.lat - dy], [ne.lng + dx, ne.lat + dy]];
  }

  /* Widest view is every mapped point filling the scene. Zoom cannot go past that. */
  function frameItems(opts) {
    var bounds = itemBounds(opts);
    if (!bounds) return;
    frameGen++;
    var bearing = BEARING[opts.profileId] || 0;
    map.setMaxBounds(null);
    map.setMinZoom(0);
    var cam = map.cameraForBounds(bounds, { padding: 40, bearing: bearing });
    var z = cam && isFinite(cam.zoom) ? cam.zoom : 3;
    map.setMinZoom(z);
    map.setMaxBounds(expandBounds(bounds, 0.22));
    map.fitBounds(bounds, {
      padding: 40,
      pitch: 48,
      bearing: bearing,
      duration: duration()
    });
  }

  function go(opts) {
    if (!map || !opts) return;
    var id = opts.profileId;
    if (wide) {
      frameItems(opts);
      return;
    }
    frameGen++;
    map.flyTo({
      center: hub(opts.rooms),
      zoom: CLOSE[id] || 16,
      pitch: id === "landing" ? 48 : 60,
      bearing: BEARING[id] || 0,
      duration: duration()
    });
  }

  function shipOf(opts) {
    var rooms = opts && opts.rooms || [];
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].id === "route") return rooms[i];
    }
    return null;
  }

  var flyGen = 0;

  function flyShip(room) {
    if (!map || !room || room.lng == null) return;
    var gen = ++flyGen;
    flying = true;
    wide = false;
    orbit = false;
    map.flyTo({
      center: [room.lng, room.lat],
      zoom: 17.6,
      pitch: 62,
      bearing: map.getBearing(),
      duration: duration(),
      essential: true
    });
    map.once("moveend", function () {
      if (gen !== flyGen) return;
      flying = false;
      followPt = null;
    });
  }

  function roomById(opts, id) {
    var rooms = opts && opts.rooms || [];
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].id === id) return rooms[i];
    }
    return null;
  }

  function setFocus(ll) {
    focusLL = ll;
    var src = map && map.getSource("hold-focus");
    if (!src) return;
    if (!ll) {
      src.setData(emptyFc());
      return;
    }
    src.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: ll }
    });
  }

  /* Close 3D look at one cold store. A slow turn until the user takes the camera. */
  function focusPlant(room) {
    if (!map || !room || room.lng == null) return;
    trackShip = false;
    wide = false;
    orbit = false;
    showFollow(false);
    flying = true;
    followPt = null;
    setFocus([room.lng, room.lat]);
    var gen = ++flyGen;
    flying = true;
    map.flyTo({
      center: [room.lng, room.lat],
      zoom: 18.05,
      pitch: 66,
      bearing: map.getBearing(),
      duration: duration(),
      essential: true
    });
    map.once("moveend", function () {
      if (gen !== flyGen) return;
      flying = false;
      orbit = !reduce;
    });
  }

  function holdCamera() { hands++; }
  function releaseCamera() { hands = Math.max(0, hands - 1); followPt = null; }

  function userZoom(startName, endName) {
    var held = false;
    map.on(startName, function (e) {
      if (!e.originalEvent || held) return;
      held = true;
      holdCamera();
    });
    map.on(endName, function () {
      if (!held) return;
      held = false;
      releaseCamera();
    });
  }

  /* Follow a mapped mover only when a route is on screen. Pan, zoom, and tilt stay with the user. */
  function glideFollow(p) {
    if (!trackShip) {
      followPt = null;
      return;
    }
    if (flying || hands > 0 || !followPt) {
      followPt = [p[0], p[1]];
      return;
    }
    var dlng = p[0] - followPt[0];
    var dlat = p[1] - followPt[1];
    followPt = [p[0], p[1]];
    if (Math.hypot(dlng, dlat) < 1e-10 || Math.hypot(dlng, dlat) > 0.02) return;
    var c = map.getCenter();
    map.jumpTo({ center: [c.lng + dlng, c.lat + dlat] });
  }

  function showFollow(on) {
    if (followBtn) followBtn.hidden = !on;
  }

  function shipNow(now) {
    if (!shipView) return null;
    var dur = shipView.dur || 1;
    var u = dur ? Math.max(0, Math.min(1, (now - shipView.t0) / dur)) : 1;
    return [
      shipView.fromLng + (shipView.toLng - shipView.fromLng) * u,
      shipView.fromLat + (shipView.toLat - shipView.fromLat) * u
    ];
  }

  function noteShip(ship) {
    if (!ship || ship.lng == null) {
      shipView = null;
      shipHist = [];
      trailDirty = true;
      return;
    }
    var now = performance.now();
    if (!shipView || reduce) {
      shipView = {
        fromLng: ship.lng, fromLat: ship.lat,
        toLng: ship.lng, toLat: ship.lat,
        t0: now, dur: reduce ? 0 : 1000
      };
      return;
    }
    if (ship.lng === shipView.toLng && ship.lat === shipView.toLat) return;
    var cur = shipNow(now);
    var jump = Math.hypot(ship.lng - cur[0], ship.lat - cur[1]);
    if (jump > 0.02) {
      shipView.fromLng = ship.lng;
      shipView.fromLat = ship.lat;
      shipHist = [[ship.lng, ship.lat]];
    } else {
      shipView.fromLng = cur[0];
      shipView.fromLat = cur[1];
    }
    shipView.toLng = ship.lng;
    shipView.toLat = ship.lat;
    shipView.t0 = now;
    shipView.dur = 1000;
  }

  function pushHist(bucket, pt) {
    var last = bucket[bucket.length - 1];
    if (last && Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 0.00008) return;
    bucket.push([pt[0], pt[1]]);
    if (bucket.length > 70) bucket.shift();
    trailDirty = true;
  }

  function head(a, b) {
    var dlng = b[0] - a[0];
    var dlat = b[1] - a[1];
    if (dlng * dlng + dlat * dlat < 1e-14) return null;
    return Math.atan2(dlng, dlat) * 180 / Math.PI;
  }

  function aim(marker, prev, next) {
    if (!marker || !marker._glyph) return;
    var h = prev ? head(prev, next) : null;
    if (h != null) marker._head = h;
    if (marker._head == null || !map) return;
    marker._glyph.style.transform = "rotate(" + (marker._head - map.getBearing()) + "deg)";
  }

  function setRoute(route) {
    var src = map.getSource("hold-route");
    if (!src) return;
    if (route && route.length > 1) {
      src.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: route }
      });
    } else {
      src.setData(emptyFc());
    }
  }

  function vehEl(kind, label) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "veh " + kind;
    el.innerHTML = "<i class=\"glyph\">" + (GLYPH[kind] || GLYPH.truck) + "</i><span>" + esc(label) + "</span>";
    return el;
  }

  function tagEl(dot, html, extra) {
    var el = document.createElement("button");
    el.type = "button";
    el.className = "map-tag" + (extra ? " " + extra : "");
    el.innerHTML = "<i></i><span>" + html + "</span>";
    el.querySelector("i").style.background = dot;
    return el;
  }

  function pins(opts) {
    var keep = {};
    var now = performance.now();
    (opts.rooms || []).forEach(function (room) {
      if (room.lng == null || room.lat == null) return;
      keep[room.id] = true;
      var marker = markers[room.id];
      if (room.id === "route") {
        if (!marker) {
          var shipEl = vehEl("ship", "Shipper");
          shipEl.addEventListener("click", function (ev) {
            ev.stopPropagation();
            ev.preventDefault();
            if (window.HoldScene.onPick) window.HoldScene.onPick(room.id);
          });
          marker = new maplibregl.Marker({ element: shipEl, anchor: "center" })
            .setLngLat([room.lng, room.lat])
            .addTo(map);
          marker._el = shipEl;
          marker._glyph = shipEl.querySelector(".glyph");
          markers[room.id] = marker;
        }
        if (!shipView || reduce) marker.setLngLat([room.lng, room.lat]);
        else marker.setLngLat(shipNow(now));
        return;
      }
      if (!marker) {
        var el = tagEl(room.fill || "#9ddec0", "");
        el.addEventListener("click", function (ev) {
          ev.stopPropagation();
          ev.preventDefault();
          if (window.HoldScene.onPick) window.HoldScene.onPick(room.id);
        });
        marker = new maplibregl.Marker({ element: el, anchor: "left" })
          .setLngLat([room.lng, room.lat])
          .addTo(map);
        marker._el = el;
        markers[room.id] = marker;
      }
      marker.setLngLat([room.lng, room.lat]);
      var eln = marker._el;
      eln.querySelector("i").style.background = room.fill || "#9ddec0";
      eln.classList.toggle("on", !!room.selected);
      eln.querySelector("span").innerHTML = "<b>" + esc(room.name) + "</b><em>" + esc(room.text) + (room.door ? " open" : "") + "</em>";
    });
    Object.keys(markers).forEach(function (id) {
      if (keep[id]) return;
      markers[id].remove();
      delete markers[id];
    });
  }

  function showPop(lnglat, title, note) {
    if (pop) pop.remove();
    pop = new maplibregl.Popup({ offset: 14, maxWidth: "240px" })
      .setLngLat(lnglat)
      .setHTML("<strong>" + esc(title) + "</strong><br>" + esc(note))
      .addTo(map);
  }

  function centroid(ring) {
    var x = 0, y = 0, n = Math.max(1, ring.length - 1);
    for (var i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
    return [x / n, y / n];
  }

  function pointAt(track, u) {
    if (!track || !track.length) return [0, 0];
    if (track.length === 1) return track[0];
    var lens = [];
    var total = 0;
    for (var i = 1; i < track.length; i++) {
      var d = Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1]);
      lens.push(d);
      total += d;
    }
    var target = ((u % 1) + 1) % 1 * (total || 1);
    var acc = 0;
    for (var j = 0; j < lens.length; j++) {
      if (acc + lens[j] >= target || j === lens.length - 1) {
        var f = lens[j] ? Math.max(0, Math.min(1, (target - acc) / lens[j])) : 0;
        return [
          track[j][0] + (track[j + 1][0] - track[j][0]) * f,
          track[j][1] + (track[j + 1][1] - track[j][1]) * f
        ];
      }
      acc += lens[j];
    }
    return track[track.length - 1];
  }

  function paintTrails() {
    if (!trailDirty) return;
    var src = map.getSource("chain-trails");
    if (!src) return;
    var features = [];
    craftList.forEach(function (c) {
      if (!c.hist || c.hist.length < 2) return;
      features.push({
        type: "Feature",
        properties: { color: TRAIL[c.kind] || "#d5e9f6" },
        geometry: { type: "LineString", coordinates: c.hist }
      });
    });
    if (shipHist.length > 1) {
      features.push({
        type: "Feature",
        properties: { color: TRAIL.ship },
        geometry: { type: "LineString", coordinates: shipHist }
      });
    }
    src.setData({ type: "FeatureCollection", features: features });
    trailDirty = false;
  }

  function pointAlong(track, u) {
    if (!track || !track.length) return [0, 0];
    if (track.length === 1) return track[0];
    var lens = [];
    var total = 0;
    var i;
    for (i = 1; i < track.length; i++) {
      var d = Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1]);
      lens.push(d);
      total += d;
    }
    var target = Math.max(0, Math.min(1, u)) * (total || 1);
    var acc = 0;
    for (i = 0; i < lens.length; i++) {
      if (acc + lens[i] >= target || i === lens.length - 1) {
        var f = lens[i] ? Math.max(0, Math.min(1, (target - acc) / lens[i])) : 0;
        return [
          track[i][0] + (track[i + 1][0] - track[i][0]) * f,
          track[i][1] + (track[i + 1][1] - track[i][1]) * f
        ];
      }
      acc += lens[i];
    }
    return track[track.length - 1];
  }

  function sinceHour(h, from) {
    return (h - from + 24) % 24;
  }

  function boatLeg(duty, h, station) {
    var t = sinceHour(h, duty.leave);
    var toOut = sinceHour(duty.out, duty.leave);
    var toTurn = sinceHour(duty.turn, duty.leave);
    var toLand = sinceHour(duty.land, duty.leave);
    var far = station == null ? 1 : station;
    if (t >= toLand) return { u: 0, dir: 1, hold: false };
    if (t < toOut) return { u: far * (t / toOut), dir: 1, hold: false };
    if (t < toTurn) return { u: far, dir: 1, hold: true };
    return { u: far * (1 - (t - toTurn) / (toLand - toTurn)), dir: -1, hold: false };
  }
  function alongDay(name, h) {
    var span = {
      Boda: [9, 16],
      Truck: [14, 18.5]
    }[name];
    if (!span) return null;
    var len = (span[1] - span[0] + 24) % 24;
    var at = (h - span[0] + 24) % 24;
    if (!len || at > len) return 0;
    return at / len;
  }

  function roadAlong(h) {
    var len = 15.5 - 8;
    var at = (h - 8 + 24) % 24;
    if (at > len) return 0;
    return at / len;
  }

  function tickMotion(now) {
    motion = requestAnimationFrame(tickMotion);
    var t = now / 1000;
    var h = window.HoldDay && window.HoldDay.hour ? window.HoldDay.hour() : null;
    craftList.forEach(function (c) {
      var marker = craftMarkers[c.name];
      if (!marker) return;
      var here;
      var back;
      if (h != null && c.duty) {
        var leg = boatLeg(c.duty, h, c.hold);
        if (leg.hold) {
          var center = pointAlong(c.track, leg.u);
          var sea = center[1] < -3.645;
          var rl = sea ? 0.00062 : 0.00018;
          var ra = sea ? 0.00048 : 0.00012;
          var ang = (h * 0.9 + (c.phase || 0)) * Math.PI * 2;
          here = [center[0] + Math.cos(ang) * rl, center[1] + Math.sin(ang) * ra];
          var bang = ang - 0.55;
          back = [center[0] + Math.cos(bang) * rl, center[1] + Math.sin(bang) * ra];
        } else {
          var u = leg.u;
          if (u < 0.04) u = Math.min(0.04, (c.berth || 0) * 0.012);
          here = pointAlong(c.track, u);
          var behindU = leg.dir < 0 ? Math.min(1, u + 0.045) : Math.max(0, u - 0.045);
          back = pointAlong(c.track, behindU);
        }
      } else {
        var paced = h == null ? null : alongDay(c.name, h);
        var uu = paced == null ? t * c.speed + (c.phase || 0) : paced;
        here = pointAt(c.track, uu);
        back = pointAt(c.track, uu - 0.012);
      }
      marker.setLngLat(here);
      aim(marker, back, here);
      if (!c.hist) c.hist = [];
      pushHist(c.hist, here);
    });
    if (batMarker && h != null && window.HoldBattery) {
      var pack = window.HoldBattery(h);
      var charging = pack.flow > 0;
      batMarker._el.classList.toggle("charge", charging);
      batMarker._fill.style.width = Math.round(pack.soc * 100) + "%";
      batMarker._word.textContent = Math.round(pack.soc * 100) + "% " + (charging ? "charging" : "discharging");
    }
    if (h != null && routeLine && markers.route) {
      var su = roadAlong(h);
      var shipHere = pointAt(routeLine, su);
      var shipBack = pointAt(routeLine, Math.max(0, su - 0.008));
      markers.route.setLngLat(shipHere);
      aim(markers.route, shipBack, shipHere);
      pushHist(shipHist, shipHere);
      glideFollow(shipHere);
    } else if (shipView && markers.route) {
      var p = shipNow(now);
      var prev = shipHist.length ? shipHist[shipHist.length - 1] : null;
      markers.route.setLngLat(p);
      aim(markers.route, prev, p);
      pushHist(shipHist, p);
      glideFollow(p);
    } else if (markers.route) {
      aim(markers.route, null, null);
    }
    if (orbit && focusLL && hands === 0 && !flying && !trackShip) {
      map.jumpTo({
        center: focusLL,
        bearing: map.getBearing() + 0.07
      });
    } else if (hands > 0) {
      orbit = false;
    }
    if (focusLL && map.getLayer("hold-focus")) {
      var pulse = reduce ? 0.4 : (0.5 + 0.5 * Math.sin(now / 320));
      map.setPaintProperty("hold-focus", "circle-radius", 16 + pulse * 26);
      map.setPaintProperty("hold-focus", "circle-opacity", 0.12 + pulse * 0.28);
    }
    paintTrails();
  }

  function kickMotion() {
    if (reduce || motion) return;
    motion = requestAnimationFrame(tickMotion);
  }

  function armCraft(list) {
    var keep = {};
    craftList = list || [];
    craftList.forEach(function (c) { keep[c.name] = true; });
    Object.keys(craftMarkers).forEach(function (name) {
      if (keep[name]) return;
      craftMarkers[name].remove();
      delete craftMarkers[name];
    });
    var tracks = [];
    craftList.forEach(function (c) {
      if (!c.hist) c.hist = [];
      if (c.track && c.track.length > 1) {
        tracks.push({
          type: "Feature",
          properties: { color: TRAIL[c.kind] || "#d5e9f6" },
          geometry: { type: "LineString", coordinates: c.track }
        });
      }
      if (craftMarkers[c.name]) return;
      var el = vehEl(c.kind, c.name);
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var ll = craftMarkers[c.name].getLngLat();
        var note = c.kind === "boat" ? "Simulated vessel. Trail is the recent track, not AIS." : "Simulated run. Trail is the recent track.";
        showPop([ll.lng, ll.lat], c.name, note);
      });
      var here = pointAt(c.track, (c.phase || 0));
      var marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(here).addTo(map);
      marker._glyph = el.querySelector(".glyph");
      craftMarkers[c.name] = marker;
    });
    var src = map.getSource("chain-tracks");
    if (src) src.setData({ type: "FeatureCollection", features: tracks });
    if (reduce) {
      craftList.forEach(function (c) {
        var marker = craftMarkers[c.name];
        if (!marker) return;
        var here = pointAt(c.track, (performance.now() / 1000) * c.speed + (c.phase || 0));
        marker.setLngLat(here);
      });
    } else {
      kickMotion();
    }
  }

  function showChain(id) {
    var chain = (window.HOLD_CHAIN && window.HOLD_CHAIN[id]) || { places: [], areas: [], links: [], craft: [] };
    if (pop) { pop.remove(); pop = null; }
    chainMarkers.forEach(function (m) { m.remove(); });
    chainMarkers = [];
    batMarker = null;
    var areas = {
      type: "FeatureCollection",
      features: (chain.areas || []).map(function (a) {
        return {
          type: "Feature",
          properties: { name: a.name, note: a.note, color: a.color },
          geometry: { type: "Polygon", coordinates: [a.ring] }
        };
      })
    };
    var links = {
      type: "FeatureCollection",
      features: (chain.links || []).map(function (line) {
        return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } };
      })
    };
    var areaSrc = map.getSource("chain-areas");
    var linkSrc = map.getSource("chain-links");
    if (areaSrc) areaSrc.setData(areas);
    if (linkSrc) linkSrc.setData(links);
    (chain.places || []).forEach(function (p) {
      var el = tagEl(DOT[p.kind] || "#f4efe6", esc(p.name));
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        showPop(p.at, p.name, p.note);
      });
      chainMarkers.push(new maplibregl.Marker({ element: el, anchor: "left" }).setLngLat(p.at).addTo(map));
    });
    (chain.areas || []).forEach(function (a) {
      var c = centroid(a.ring);
      var el = tagEl(a.color || DOT.fish, esc(a.name), "fish");
      el.addEventListener("click", function (ev) {
        ev.stopPropagation();
        showPop(c, a.name, a.note);
      });
      chainMarkers.push(new maplibregl.Marker({ element: el, anchor: "left" }).setLngLat(c).addTo(map));
    });
    armCraft(chain.craft || []);
    if (id === "landing") {
      var el = document.createElement("div");
      el.className = "bat-pin";
      el.innerHTML = "<b>Battery</b><i><s></s></i><em></em>";
      batMarker = new maplibregl.Marker({ element: el, anchor: "left" })
        .setLngLat([39.8464, -3.63395])
        .addTo(map);
      batMarker._el = el;
      batMarker._fill = el.querySelector("s");
      batMarker._word = el.querySelector("em");
      chainMarkers.push(batMarker);
    }
  }

  function apply(opts) {
    if (!map || !ready) {
      pending = opts;
      return;
    }
    var changed = opts.profileId !== shown;
    shown = opts.profileId;
    routeLine = opts.route || null;
    var ship = shipOf(opts);
    if (changed) {
      shipView = null;
      shipHist = [];
      craftList.forEach(function (c) { c.hist = []; });
      trailDirty = true;
      orbit = false;
      setFocus(null);
    }
    if (opts.look === "route" && ship) {
      trackShip = true;
      followPt = null;
      orbit = false;
      setFocus(null);
      flyShip(ship);
    } else if (opts.look) {
      var hit = roomById(opts, opts.look);
      if (hit) focusPlant(hit);
    } else if (!ship || !ship.selected) {
      trackShip = false;
    }
    noteShip(ship);
    if (changed) {
      wide = !opts.look;
      if (!opts.look) go(opts);
      showChain(opts.profileId);
      requestAnimationFrame(function () { if (map) map.resize(); });
    }
    setRoute(opts.route);
    pins(opts);
    if (metaEl) {
      var chain = window.HOLD_CHAIN && window.HOLD_CHAIN[opts.profileId];
      metaEl.textContent = chain ? chain.blurb : (PLACE[opts.profileId] || "");
    }
    if (wideBtn) wideBtn.textContent = wide ? "At the rooms" : "Wider map";
    showFollow(trackShip);
    kickMotion();
  }

  function lineLayer(id, source, paint) {
    map.addLayer({
      id: id,
      type: "line",
      source: source,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: paint
    });
  }

  function attach(container, _labels, meta, button) {
    metaEl = meta;
    wideBtn = button;
    reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!window.maplibregl) {
      if (metaEl) metaEl.textContent = "Map library did not load. The plan below still works.";
      return;
    }
    map = new maplibregl.Map({
      container: container,
      style: STYLE,
      center: [34.7682, 0.5144],
      zoom: 16,
      pitch: 60,
      bearing: -28,
      attributionControl: true,
      fadeDuration: reduce ? 0 : 300
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.on("dragstart", holdCamera);
    map.on("dragend", releaseCamera);
    userZoom("zoomstart", "zoomend");
    userZoom("rotatestart", "rotateend");
    userZoom("pitchstart", "pitchend");
    map.on("load", function () {
      map.addLayer({
        id: "building-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#3a414c",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 0],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.9
        }
      });
      map.addSource("hold-route", { type: "geojson", data: emptyFc() });
      map.addSource("chain-areas", { type: "geojson", data: emptyFc() });
      map.addSource("chain-links", { type: "geojson", data: emptyFc() });
      map.addSource("chain-tracks", { type: "geojson", data: emptyFc() });
      map.addSource("chain-trails", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "chain-areas",
        type: "fill",
        source: "chain-areas",
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.38 }
      });
      lineLayer("chain-area-line", "chain-areas", {
        "line-color": ["get", "color"],
        "line-width": 1.2,
        "line-opacity": 0.8
      });
      lineLayer("chain-links", "chain-links", {
        "line-color": "#b7b2a8",
        "line-width": 1.4,
        "line-opacity": 0.55,
        "line-dasharray": [1.2, 1.4]
      });
      lineLayer("chain-tracks", "chain-tracks", {
        "line-color": ["get", "color"],
        "line-width": 1.4,
        "line-opacity": 0.35,
        "line-dasharray": [0.6, 1.6]
      });
      lineLayer("chain-trails-glow", "chain-trails", {
        "line-color": ["get", "color"],
        "line-width": 8,
        "line-opacity": 0.28,
        "line-blur": 2
      });
      lineLayer("chain-trails", "chain-trails", {
        "line-color": ["get", "color"],
        "line-width": 2.6,
        "line-opacity": 0.95
      });
      lineLayer("hold-route", "hold-route", {
        "line-color": "#9ddec0",
        "line-width": 3,
        "line-opacity": 0.85
      });
      map.addSource("hold-focus", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "hold-focus",
        type: "circle",
        source: "hold-focus",
        paint: {
          "circle-radius": 22,
          "circle-color": "#9ddec0",
          "circle-opacity": 0.28,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#e7eee8",
          "circle-stroke-opacity": 0.8
        }
      });
      map.on("click", "chain-areas", function (ev) {
        var f = ev.features && ev.features[0];
        if (!f) return;
        showPop(ev.lngLat, f.properties.name, f.properties.note);
      });
      map.on("mouseenter", "chain-areas", function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "chain-areas", function () { map.getCanvas().style.cursor = ""; });
      ready = true;
      map.resize();
      if (pending) apply(pending);
    });
    map.on("error", function () {
      if (metaEl && !ready) metaEl.textContent = "OpenStreetMap tiles did not load. Check the network.";
    });
    if (wideBtn) {
      wideBtn.addEventListener("click", function () {
        wide = !wide;
        if (wide) {
          trackShip = false;
          orbit = false;
          setFocus(null);
          showFollow(false);
        }
        if (pending) go(pending);
        if (wideBtn) wideBtn.textContent = wide ? "At the rooms" : "Wider map";
      });
    }
    followBtn = document.getElementById("scene-follow");
    if (followBtn) {
      followBtn.addEventListener("click", function () {
        trackShip = false;
        followPt = null;
        showFollow(false);
      });
    }
    window.addEventListener("resize", function () {
      if (map) map.resize();
    });
  }

  function sync(opts) {
    pending = opts;
    apply(opts);
  }

  window.HoldScene = { attach: attach, sync: sync, onPick: null };
})();
