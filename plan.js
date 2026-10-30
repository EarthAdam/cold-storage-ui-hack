/* Hypothetical technical plans. Schematic, not a survey. */
(function () {
  var SHIP = [[300, 188], [430, 150], [560, 176], [690, 248]];

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

  function legend() {
    return (
      '<g class="legend" transform="translate(28,458)">' +
        '<rect width="12" height="12" fill="#cfe3d6"/>' +
        '<text x="16" y="10">in band</text>' +
        '<rect x="78" width="12" height="12" fill="#f3ddb0"/>' +
        '<text x="94" y="10">watch</text>' +
        '<rect x="150" width="12" height="12" fill="#f0b2a4"/>' +
        '<text x="166" y="10">act</text>' +
        '<rect x="210" width="12" height="12" fill="#c5d4e8"/>' +
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

  function clinic() {
    return shell(
      "Rural post",
      "Solar, one MeshEMS node, three cabinets. Freeze is as bad as heat.",
      '<g class="pv" transform="translate(48,88)">' +
        '<rect width="250" height="34"/>' +
        '<path d="M42 0 V34 M84 0 V34 M126 0 V34 M168 0 V34 M210 0 V34"/>' +
        '<text x="8" y="22">PV</text>' +
      '</g>' +
      '<g class="node" transform="translate(330,90)">' +
        '<rect width="78" height="30"/>' +
        '<text x="8" y="20">MeshEMS</text>' +
      '</g>' +
      '<path class="bus" d="M173 122 H369 V148 H120 V168 M369 148 H400 V168 M400 148 H560 V168"/>' +
      zone("vaccine", 48, 168, 230, 210, "Vaccine cabinet") +
      zone("oxy", 300, 168, 190, 210, "Oxytocin") +
      zone("insulin", 512, 168, 180, 150, "Insulin box") +
      '<text class="dim" x="48" y="400">corridor · lids face the walk</text>'
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

  function dispatch() {
    var pts = SHIP.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    return shell(
      "Dispatch hub",
      "Two bays in the building. Route 4 is the passive box on the road.",
      '<rect class="shed" x="36" y="96" width="250" height="300"/>' +
      zone("hub", 48, 112, 220, 130, "Hub vaccines") +
      zone("blood", 48, 258, 220, 120, "Blood bay") +
      '<text class="dim" x="320" y="120">route 4</text>' +
      '<polyline class="road" points="' + pts + '"/>' +
      '<g class="drop" transform="translate(690,248)">' +
        '<circle r="7"/>' +
        '<text x="12" y="4">drop</text>' +
      '</g>' +
      '<g id="shipper" class="zone" data-room="route" transform="translate(360,170)">' +
        '<rect class="zone-fill ship-body" x="-28" y="-16" width="56" height="32"/>' +
        '<rect class="zone-wall ship-body" x="-28" y="-16" width="56" height="32"/>' +
        '<text class="zone-name" x="0" y="-2" text-anchor="middle">shipper</text>' +
        '<text class="readout" x="0" y="14" text-anchor="middle">—</text>' +
      '</g>'
    );
  }

  var PLANS = { clinic: clinic, landing: landing, packhouse: packhouse, dispatch: dispatch };

  window.HoldPlan = {
    shipPath: SHIP,
    markup: function (id) {
      var fn = PLANS[id] || clinic;
      return fn();
    }
  };
})();
