/* Hypothetical technical plans. Schematic, not a survey. */
(function () {
  function zone(id, x, y, w, h, name) {
    var doorW = Math.max(28, Math.min(52, w * 0.28));
    return (
      '<g class="zone" data-room="' + id + '" transform="translate(' + x + ',' + y + ')">' +
        '<rect class="zone-fill" width="' + w + '" height="' + h + '"/>' +
        '<rect class="frost" width="' + w + '" height="' + h + '"/>' +
        '<rect class="mist" width="' + w + '" height="' + h + '"/>' +
        '<g class="parch">' +
          '<path d="M14 24 H' + (w - 14) + ' M14 40 H' + (w - 20) + ' M18 56 H' + (w - 16) + '"/>' +
        '</g>' +
        '<rect class="zone-wall" width="' + w + '" height="' + h + '"/>' +
        '<g class="hinge" transform="translate(' + Math.round(w * 0.42) + ',' + h + ')">' +
          '<g class="door"><rect x="0" y="0" width="' + doorW + '" height="5"/></g>' +
        '</g>' +
        '<path class="feeder" d="M' + (w - 28) + ',0 V-18"/>' +
        '<g class="fan-mount" transform="translate(' + (w - 26) + ',26)">' +
          '<g class="fan">' +
            '<circle r="9"/>' +
            '<path d="M0,-6.5 V6.5 M-6.5,0 H6.5 M-4.5,-4.5 L4.5,4.5 M-4.5,4.5 L4.5,-4.5"/>' +
          '</g>' +
        '</g>' +
        '<text class="zone-name" x="12" y="22">' + name + '</text>' +
        '<text class="readout" x="12" y="52">—</text>' +
        '<text class="subread" x="12" y="72"></text>' +
      '</g>'
    );
  }

  function legend(y) {
    return (
      '<g class="legend" transform="translate(28,' + (y || 458) + ')">' +
        '<rect width="12" height="12" fill="#1e3a30"/>' +
        '<text x="16" y="10">in band</text>' +
        '<rect x="78" width="12" height="12" fill="#3f341c"/>' +
        '<text x="94" y="10">watch</text>' +
        '<rect x="150" width="12" height="12" fill="#4a2a24"/>' +
        '<text x="166" y="10">act</text>' +
        '<rect x="210" width="12" height="12" fill="#2a3a4e"/>' +
        '<text x="226" y="10">freeze</text>' +
        '<text x="300" y="10">door swings · fan spins while the compressor draws · tint is humidity</text>' +
      '</g>'
    );
  }

  function shell(title, note, body) {
    return (
      '<svg class="plan" viewBox="0 0 760 488" role="img" aria-label="' + title + '">' +
        '<rect class="sheet" width="760" height="488"/>' +
        '<text class="sheet-kicker" x="28" y="28">HYPOTHETICAL TECHNICAL PLAN</text>' +
        '<text class="sheet-title" x="28" y="50">' + title + '</text>' +
        '<text class="sheet-sub" x="28" y="68">' + note + '</text>' +
        '<text class="sheet-note" x="560" y="32">schematic</text>' +
        '<text class="sheet-note" x="560" y="48">not to scale</text>' +
        body +
        legend() +
      '</svg>'
    );
  }

  function cabinet(id, x, base, w, h, name, stock) {
    var head = 86;
    var doorTop = -h + head;
    var doorH = h - head - 10;
    var doorW = w - 16;
    var rail = 236 - base;
    return (
      '<g class="zone" data-room="' + id + '" transform="translate(' + x + ',' + base + ')">' +
        '<polygon class="cab-side" points="' + w + ',0 ' + (w + 26) + ',-14 ' + (w + 26) + ',' + (-h - 14) + ' ' + w + ',' + (-h) + '"/>' +
        '<polygon class="cab-top" points="0,' + (-h) + ' ' + w + ',' + (-h) + ' ' + (w + 26) + ',' + (-h - 14) + ' 26,' + (-h - 14) + '"/>' +
        '<rect class="zone-fill" y="' + (-h) + '" width="' + w + '" height="' + h + '"/>' +
        '<rect class="frost" x="8" y="' + doorTop + '" width="' + doorW + '" height="' + doorH + '"/>' +
        '<rect class="mist" x="8" y="' + doorTop + '" width="' + doorW + '" height="' + doorH + '"/>' +
        '<g class="shelf"><path d="M12 ' + (doorTop + doorH * 0.38).toFixed(1) + ' H' + (w - 12) +
          ' M12 ' + (doorTop + doorH * 0.7).toFixed(1) + ' H' + (w - 12) + '"/></g>' +
        '<g class="parch" transform="translate(14,' + (doorTop + 10) + ')">' +
          '<path d="M0 0 H' + (w - 40) + ' M0 12 H' + (w - 48) + '"/>' +
        '</g>' +
        '<rect class="zone-wall" y="' + (-h) + '" width="' + w + '" height="' + h + '"/>' +
        '<g class="hinge" transform="translate(8,' + doorTop + ')">' +
          '<g class="door">' +
            '<rect width="' + doorW + '" height="' + doorH + '"/>' +
            '<rect class="handle" x="' + (doorW - 16) + '" y="' + Math.round(doorH / 2 - 9) + '" width="3" height="18"/>' +
          '</g>' +
        '</g>' +
        '<g class="fan-mount" transform="translate(' + (w - 22) + ',' + (-h + 22) + ')">' +
          '<g class="fan">' +
            '<circle r="8"/>' +
            '<path d="M0,-5.5 V5.5 M-5.5,0 H5.5 M-4,-4 L4,4 M-4,4 L4,-4"/>' +
          '</g>' +
        '</g>' +
        '<path class="feeder" d="M' + (w / 2) + ',' + (-h) + ' V' + rail + '"/>' +
        '<text class="zone-name" x="12" y="' + (-h + 22) + '">' + name + '</text>' +
        '<text class="readout" x="12" y="' + (-h + 48) + '">—</text>' +
        '<text class="subread" x="12" y="' + (-h + 66) + '"></text>' +
        '<text class="dim" x="0" y="18">' + stock + '</text>' +
      '</g>'
    );
  }

  function clinic() {
    return (
      '<svg class="plan doll" viewBox="0 0 920 640" role="img" aria-label="Rural post cutaway">' +
        '<rect class="sheet" width="920" height="640"/>' +
        '<text class="sheet-kicker" x="28" y="32">CLINIC CUTAWAY</text>' +
        '<text class="sheet-title" x="28" y="58">Rural post</text>' +
        '<text class="sheet-sub" x="28" y="78">Front wall off. Three cabinets in one room. Click a lid.</text>' +
        '<text class="sheet-note" x="760" y="36">schematic</text>' +
        '<text class="sheet-note" x="760" y="52">not a survey</text>' +
        '<g class="house">' +
          '<polygon class="floor" points="150,508 830,508 890,562 210,562"/>' +
          '<polygon class="wall" points="150,188 210,146 210,562 150,508"/>' +
          '<polygon class="wall-back" points="150,188 830,188 830,508 150,508"/>' +
          '<polygon class="wall" points="830,188 890,146 890,250 830,292"/>' +
          '<polygon class="roof" points="128,196 852,196 920,132 196,132"/>' +
          '<rect class="window" x="158" y="250" width="28" height="46"/>' +
        '</g>' +
        '<g class="pv" transform="translate(250,138)">' +
          '<polygon points="0,36 460,36 500,8 40,8"/>' +
          '<path d="M70 36 L98 8 M150 36 L178 8 M230 36 L258 8 M310 36 L338 8 M390 36 L418 8"/>' +
          '<text x="8" y="28">PV</text>' +
        '</g>' +
        '<g class="node" transform="translate(390,204)">' +
          '<rect width="78" height="24"/>' +
          '<text x="8" y="16">MeshEMS</text>' +
        '</g>' +
        '<path class="bus" d="M429 168 V236 H305 M429 236 H520 M429 236 H715"/>' +
        '<text class="dim" x="158" y="420">consult</text>' +
        cabinet("vaccine", 210, 500, 190, 240, "Vaccine cabinet", "measles doses") +
        cabinet("oxy", 440, 500, 160, 210, "Oxytocin", "vials") +
        cabinet("insulin", 650, 500, 130, 170, "Insulin box", "vials") +
        '<text class="dim" x="230" y="584">one room · lids face you · tint is the cabinet</text>' +
        legend(612) +
      '</svg>'
    );
  }

  function landing() {
    return shell(
      "Landing",
      "Quay, ice hold, the day’s catch, blast at the back.",
      '<clipPath id="sea-clip"><rect x="0" y="84" width="156" height="340"/></clipPath>' +
      '<g clip-path="url(#sea-clip)">' +
        '<rect class="sea" x="0" y="84" width="156" height="340"/>' +
        '<g class="wave">' +
          '<path d="M-30 120 q 18 -8 36 0 t 36 0 t 36 0 t 36 0 t 36 0"/>' +
          '<path d="M-30 160 q 18 -8 36 0 t 36 0 t 36 0 t 36 0 t 36 0"/>' +
          '<path d="M-30 200 q 18 -8 36 0 t 36 0 t 36 0 t 36 0 t 36 0"/>' +
          '<path d="M-30 250 q 18 -8 36 0 t 36 0 t 36 0 t 36 0 t 36 0"/>' +
          '<path d="M-30 300 q 18 -8 36 0 t 36 0 t 36 0 t 36 0 t 36 0"/>' +
        '</g>' +
        '<path class="hull" d="M28 340 L48 368 H108 L124 340 Z"/>' +
      '</g>' +
      '<path class="quay" d="M156 84 V424"/>' +
      '<text class="dim" x="18" y="108">sea</text>' +
      zone("ice", 180, 100, 250, 250, "Ice hold") +
      zone("day", 450, 100, 250, 150, "Day catch") +
      zone("blast", 450, 270, 250, 130, "Blast") +
      '<text class="dim" x="180" y="372">hatches face the quay</text>'
    );
  }

  function packhouse() {
    return shell(
      "Packhouse",
      "Leaf wants wet air. Tomato has its own band. The market run is the end room.",
      '<rect class="shed" x="36" y="88" width="688" height="300"/>' +
      zone("leaf", 52, 108, 210, 220, "Leafy room") +
      zone("tomato", 280, 108, 210, 220, "Tomato room") +
      zone("out", 508, 108, 196, 180, "Market cooler") +
      '<g id="dock" transform="translate(508,360)">' +
        '<rect class="apron" width="196" height="52"/>' +
        '<g class="truck">' +
          '<rect x="28" y="16" width="70" height="22"/>' +
          '<rect x="98" y="22" width="28" height="16"/>' +
          '<circle cx="48" cy="40" r="5"/>' +
          '<circle cx="112" cy="40" r="5"/>' +
        '</g>' +
        '<text class="dim" x="8" y="14">dock</text>' +
      '</g>'
    );
  }

  var PLANS = { clinic: clinic, landing: landing, packhouse: packhouse };

  window.HoldPlan = {
    markup: function (id) {
      var fn = PLANS[id] || clinic;
      return fn();
    }
  };
})();
