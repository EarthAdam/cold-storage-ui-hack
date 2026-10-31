/* Supply chain around each cold store.
   Named places are OpenStreetMap. Boats, fish grounds, and the moving
   courier or truck are simulated and labeled that way. */
(function () {
  window.HOLD_CHAIN = {
    landing: {
      blurb: "Kilifi creek. Docks, the market, and kitchens are OpenStreetMap. Boats stay in the mapped creek or offshore of the coast. Fish grounds are simulated.",
      places: [
        { name: "Pier", kind: "dock", at: [39.85314, -3.63911], note: "OpenStreetMap pier" },
        { name: "Pier", kind: "dock", at: [39.84505, -3.63812], note: "OpenStreetMap pier" },
        { name: "Pier", kind: "dock", at: [39.84582, -3.63839], note: "OpenStreetMap pier" },
        { name: "Boatyard pier", kind: "dock", at: [39.84061, -3.63563], note: "OpenStreetMap pier, by Kilifi Boatyard" },
        { name: "Kilifi Market", kind: "market", at: [39.85330, -3.63225], note: "OpenStreetMap marketplace" },
        { name: "Old Ferry", kind: "kitchen", at: [39.84531, -3.63431], note: "OpenStreetMap restaurant" },
        { name: "Nautilus", kind: "kitchen", at: [39.84457, -3.63390], note: "OpenStreetMap restaurant" },
        { name: "Village Dishes", kind: "kitchen", at: [39.85230, -3.63352], note: "OpenStreetMap restaurant" },
        { name: "The Terrace", kind: "kitchen", at: [39.84839, -3.63837], note: "OpenStreetMap restaurant" },
        { name: "Kilifi Boatyard", kind: "kitchen", at: [39.84051, -3.63591], note: "OpenStreetMap restaurant" },
        { name: "Shore ice", kind: "cold", at: [39.84640, -3.63435], note: "Simulated ice crib on the land side of the pier" },
        { name: "Market chill", kind: "cold", at: [39.85355, -3.63255], note: "Simulated cold box at Kilifi Market" }
      ],
      areas: [
        {
          name: "Creek school",
          note: "Simulated. Sits in the OpenStreetMap creek.",
          color: "#3d8eb0",
          ring: [[39.85024, -3.63607], [39.84958, -3.63595], [39.84834, -3.63616], [39.84971, -3.63594], [39.85024, -3.63607]]
        },
        {
          name: "Inshore ground",
          note: "Simulated. Offshore of the OpenStreetMap coast.",
          color: "#2f6f92",
          ring: [[39.86696, -3.64958], [39.86873, -3.65473], [39.86983, -3.65473], [39.86860, -3.65209], [39.86696, -3.64958]]
        }
      ],
      links: [
        [[39.84915, -3.63400], [39.85330, -3.63225]],
        [[39.84915, -3.63400], [39.84531, -3.63431]],
        [[39.85330, -3.63225], [39.85230, -3.63352]],
        [[39.84640, -3.63435], [39.84505, -3.63812]]
      ],
      craft: [
        { name: "Hera", kind: "boat", phase: 0.1, berth: 0, hold: 0.96, duty: { leave: 4.7, out: 5.6, turn: 10.35, land: 11.2 }, track: [[39.84505, -3.63812], [39.84520, -3.63655], [39.84545, -3.63658], [39.84738, -3.63811], [39.84834, -3.63616], [39.84958, -3.63595]] },
        { name: "Tufani", kind: "boat", phase: 0.4, berth: 1, hold: 0.84, duty: { leave: 4.9, out: 5.8, turn: 10.45, land: 11.35 }, track: [[39.84505, -3.63812], [39.84520, -3.63655], [39.84545, -3.63658], [39.84738, -3.63811], [39.84834, -3.63616], [39.84958, -3.63595]] },
        { name: "Amani", kind: "boat", phase: 0.7, berth: 2, hold: 0.72, duty: { leave: 5.1, out: 6.0, turn: 10.55, land: 11.5 }, track: [[39.84582, -3.63839], [39.84545, -3.63658], [39.84738, -3.63811], [39.84834, -3.63616], [39.84958, -3.63595]] },
        { name: "Umoja", kind: "boat", phase: 0.2, berth: 0, hold: 0.95, duty: { leave: 4.8, out: 5.7, turn: 10.4, land: 11.25 }, track: [[39.84582, -3.63839], [39.84834, -3.63616], [39.84971, -3.63594], [39.84987, -3.63596], [39.85024, -3.63607], [39.85171, -3.63598]] },
        { name: "Bahati", kind: "boat", phase: 0.55, berth: 1, hold: 0.8, duty: { leave: 5.0, out: 5.9, turn: 10.5, land: 11.4 }, track: [[39.84582, -3.63839], [39.84834, -3.63616], [39.84971, -3.63594], [39.84987, -3.63596], [39.85024, -3.63607], [39.85171, -3.63598]] },
        { name: "Pwani", kind: "boat", phase: 0.85, berth: 2, hold: 0.66, duty: { leave: 5.2, out: 6.1, turn: 10.65, land: 11.6 }, track: [[39.85314, -3.63911], [39.85171, -3.63598], [39.85024, -3.63607], [39.84987, -3.63596], [39.84971, -3.63594], [39.84834, -3.63616]] },
        { name: "Kaskazi", kind: "boat", phase: 0.15, berth: 0, hold: 0.97, duty: { leave: 4.75, out: 5.7, turn: 10.3, land: 11.15 }, track: [[39.85314, -3.63911], [39.85617, -3.63858], [39.85701, -3.63922], [39.85771, -3.63947], [39.85881, -3.63956], [39.86091, -3.63961]] },
        { name: "Samaki", kind: "boat", phase: 0.45, berth: 1, hold: 0.82, duty: { leave: 4.95, out: 5.9, turn: 10.42, land: 11.3 }, track: [[39.85314, -3.63911], [39.85617, -3.63858], [39.85701, -3.63922], [39.85771, -3.63947], [39.85881, -3.63956], [39.86091, -3.63961]] },
        { name: "Rai", kind: "boat", phase: 0.75, berth: 2, hold: 0.68, duty: { leave: 5.15, out: 6.05, turn: 10.6, land: 11.55 }, track: [[39.85314, -3.63911], [39.85617, -3.63858], [39.85701, -3.63922], [39.85771, -3.63947], [39.85881, -3.63956], [39.86091, -3.63961]] },
        { name: "Bahari", kind: "boat", phase: 0.3, berth: 0, hold: 0.98, duty: { leave: 4.6, out: 5.8, turn: 10.5, land: 11.45 }, track: [[39.85314, -3.63911], [39.86091, -3.63961], [39.86223, -3.64147], [39.86403, -3.64454], [39.86517, -3.64696], [39.86696, -3.64958], [39.86873, -3.65473]] },
        { name: "Maji", kind: "boat", phase: 0.6, berth: 1, hold: 0.84, duty: { leave: 4.85, out: 6.0, turn: 10.58, land: 11.55 }, track: [[39.85314, -3.63911], [39.86091, -3.63961], [39.86223, -3.64147], [39.86403, -3.64454], [39.86517, -3.64696], [39.86696, -3.64958], [39.86873, -3.65473]] },
        { name: "Kobe", kind: "boat", phase: 0.9, berth: 2, hold: 0.7, duty: { leave: 5.05, out: 6.15, turn: 10.7, land: 11.7 }, track: [[39.85314, -3.63911], [39.86091, -3.63961], [39.86223, -3.64147], [39.86403, -3.64454], [39.86517, -3.64696], [39.86696, -3.64958], [39.86873, -3.65473]] },
        { name: "Usiku", kind: "boat", phase: 0.25, berth: 3, hold: 0.9, duty: { leave: 16.8, out: 18.6, turn: 5.15, land: 6.4 }, track: [[39.84505, -3.63812], [39.84520, -3.63655], [39.84545, -3.63658], [39.84738, -3.63811], [39.84834, -3.63616], [39.84958, -3.63595]] },
        { name: "Mwezi", kind: "boat", phase: 0.5, berth: 3, hold: 0.76, duty: { leave: 17.1, out: 19.0, turn: 5.3, land: 6.55 }, track: [[39.84582, -3.63839], [39.84834, -3.63616], [39.84971, -3.63594], [39.84987, -3.63596], [39.85024, -3.63607], [39.85171, -3.63598]] },
        { name: "Alfajiri", kind: "boat", phase: 0.8, berth: 3, hold: 0.88, duty: { leave: 16.9, out: 18.8, turn: 5.05, land: 6.3 }, track: [[39.85314, -3.63911], [39.86091, -3.63961], [39.86223, -3.64147], [39.86403, -3.64454], [39.86517, -3.64696], [39.86696, -3.64958], [39.86806, -3.64958]] }
      ]
    },
    clinic: {
      blurb: "Butali Chegulo. The markets and the school are OpenStreetMap. The boda run between them is simulated.",
      places: [
        { name: "Nambilima Market", kind: "market", at: [34.76492, 0.51946], note: "OpenStreetMap marketplace" },
        { name: "Shivakala Market", kind: "market", at: [34.75677, 0.50078], note: "OpenStreetMap marketplace" },
        { name: "Namushiya Primary", kind: "care", at: [34.77735, 0.51326], note: "OpenStreetMap school. Outreach stop." }
      ],
      areas: [],
      links: [
        [[34.7682, 0.5144], [34.76492, 0.51946]],
        [[34.7682, 0.5144], [34.75677, 0.50078]],
        [[34.7682, 0.5144], [34.77735, 0.51326]]
      ],
      craft: [
        { name: "Boda", kind: "rider", speed: 0.03, phase: 0, track: [[34.7682, 0.5144], [34.76492, 0.51946], [34.7682, 0.5144], [34.77735, 0.51326], [34.7682, 0.5144], [34.75677, 0.50078]] }
      ]
    },
    packhouse: {
      blurb: "Hells Gate. Farmland and the kitchens are OpenStreetMap. The truck between field and kitchen is simulated.",
      places: [
        { name: "Field", kind: "farm", at: [36.43374, -0.74940], note: "OpenStreetMap farmland" },
        { name: "Field", kind: "farm", at: [36.43787, -0.75040], note: "OpenStreetMap farmland" },
        { name: "Mother's Kitchen", kind: "kitchen", at: [36.43404, -0.72006], note: "OpenStreetMap restaurant" },
        { name: "Olive", kind: "kitchen", at: [36.43555, -0.72542], note: "OpenStreetMap restaurant" },
        { name: "Heritage Club", kind: "kitchen", at: [36.45428, -0.73354], note: "OpenStreetMap restaurant" }
      ],
      areas: [],
      links: [
        [[36.4355, -0.7354], [36.43374, -0.74940]],
        [[36.4355, -0.7354], [36.43404, -0.72006]],
        [[36.4355, -0.7354], [36.43555, -0.72542]]
      ],
      craft: [
        { name: "Truck", kind: "truck", speed: 0.025, phase: 0.2, track: [[36.43374, -0.74940], [36.4355, -0.7354], [36.43404, -0.72006], [36.4355, -0.7354]] }
      ]
    }
  };
})();
