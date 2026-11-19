/* preview.js â€” window.WallPreview: procedural 3D concept preview (Three.js r128 global). */
(function () {
  'use strict';

  /* ---------- constants & fallbacks (config.js OPTIONS hex wins when present) ---------- */
  var W = 5.6, H = 2.6, D = 6, PZ = 0.04, TVW = 1.66, TVH = 0.93;
  var DEF = {
    wallColor: 'white', floor: 'lightOak', ceiling: 'flat', fireplace: 'none', fireplaceFrame: 'flush',
    layout: 'full', facing: 'paint', panelColor: 'white', niches: 'none', cabinetry: 'none',
    cabinetFinish: 'white', nicheInterior: 'match', led: 'off', slats: 'none', slatTone: 'oak', reveals: 'none'
  };
  var FALLBACK = {
    wallColor: { white: '#EEEAE3', greige: '#CFC6B8', sage: '#A9B3A0', charcoal: '#4A4A48', navy: '#2E3A4F' },
    floor: { lightOak: '#C9A97C', walnut: '#6B4A32', greyTile: '#9A9893', carpet: '#BDB5A8' },
    panelColor: { white: '#EEEAE3', greige: '#CFC6B8', charcoal: '#3F3F3D', black: '#1E1E1E', oak: '#B88A5A', walnut: '#5E3F2B' },
    cabinetFinish: { white: '#EDEBE6', black: '#232323', oak: '#B88A5A', walnut: '#5E3F2B' },
    nicheInterior: { dark: '#2B2A28', wood: '#A8784C' },
    led: { warm: '#FFC98A', neutral: '#FFF1DC', cool: '#DDE9FF' },
    slatTone: { oak: '#B88A5A', walnut: '#5E3F2B', black: '#1E1E1E' },
    reveals: { brass: '#B08D57', black: '#151515' }
  };
  // lighting presets: ambient/key/exposure/env + glow strengths
  var LIGHT = {
    bright:  { hemi: 0.72, key: 0.85, exp: 0.95, env: 1.0,  led: 0.5, glow: 0.45, cove: 0.3, fire: 0.3, bg: 0x2a2825 },
    ambient: { hemi: 0.4,  key: 0.3,  exp: 0.95, env: 0.55, led: 1.0, glow: 0.85, cove: 0.75, fire: 0.6, bg: 0x1d1c1a },
    dim:     { hemi: 0.1,  key: 0.04, exp: 0.9,  env: 0.14, led: 1.7, glow: 1.0,  cove: 1.0,  fire: 1.0, bg: 0x100f0e }
  };

  /* ---------- module state ---------- */
  var renderer, scene, camera, container, ro, hemi, key, ledLight, fireLight, envTex, maxAniso = 4;
  var root, props, mats = [], envMats = [], dyn = {}, S = null, sig = '', Lay = null;
  var lightMode = 'bright', viewName = 'front', ready = false, raf = 0, tween = null;
  var cur = { px: 0, py: 1.35, pz: 4.7, lx: 0, ly: 1.3, lz: 0, fov: 38, zoom: 1 };
  var tgt = {};
  // Free orbit on top of the preset view: yaw/pitch offsets (radians), damped toward orbT, with inertia.
  var orb = { yaw: 0, pitch: 0 }, orbT = { yaw: 0, pitch: 0 }, vel = { yaw: 0, pitch: 0 };
  var YAW_MAX = 1.2, PITCH_MIN = -0.12, PITCH_MAX = 0.8, ZMIN = 0.45, ZMAX = 1.6;
  var pointers = new Map(), dragging = false, pinch0 = 0, zoom0 = 1, lastT = 0, orbitNotified = false;
  var canv = {}, texs = {}, special = {};

  /* ---------- colour + random helpers ---------- */
  function hexOf(k, id) {
    var l = (window.OPTIONS && window.OPTIONS[k]) || [];
    for (var i = 0; i < l.length; i++) if (l[i].id === id && l[i].hex) return l[i].hex;
    return (FALLBACK[k] && FALLBACK[k][id]) || null;
  }
  function parse(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(h, f, a) {
    var c = parse(h).map(function (v) { return Math.max(0, Math.min(255, Math.round(v * f))); });
    return a == null ? 'rgb(' + c + ')' : 'rgba(' + c + ',' + a + ')';
  }
  function mixHex(a, b, t) {
    var x = parse(a), y = parse(b), o = '#';
    for (var i = 0; i < 3; i++) o += ('0' + Math.round(x[i] + (y[i] - x[i]) * t).toString(16)).slice(-2);
    return o;
  }
  function C(h) { return new THREE.Color(h).convertSRGBToLinear(); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------- procedural canvas textures ---------- */
  function paintWood(c, hex, vertical, rows, seed) { // planks with grain + butt joints
    var g = c.getContext('2d'), w = c.width, h = c.height, r = rng(seed), s = c.width / 512; // s keeps line weights resolution-independent
    if (vertical) { g.translate(0, h); g.rotate(-Math.PI / 2); var t = w; w = h; h = t; }
    var rh = h / rows;
    for (var i = 0; i < rows; i++) {
      var y = i * rh;
      g.fillStyle = shade(hex, 0.9 + r() * 0.2); g.fillRect(0, y, w, rh);
      for (var k = 0; k < 28; k++) {
        var gy = y + r() * rh;
        g.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,' + (0.03 + r() * 0.07) + ')' : 'rgba(255,255,255,' + (0.02 + r() * 0.05) + ')';
        g.lineWidth = (0.5 + r() * 1.5) * s; g.beginPath(); g.moveTo(0, gy);
        g.bezierCurveTo(w * 0.3, gy + (r() - 0.5) * 5 * s, w * 0.6, gy + (r() - 0.5) * 5 * s, w, gy + (r() - 0.5) * 3 * s); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, w, 1.5 * s); g.fillRect(r() * w, y, 1.5 * s, rh);
    }
  }
  function paintTile(c, hex) { // 2x2 porcelain tiles with grout
    var g = c.getContext('2d'), w = c.width, s = w / 2, r = rng(7), i, j, k = w / 512;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) {
      g.fillStyle = shade(hex, 0.95 + r() * 0.1); g.fillRect(i * s, j * s, s, s);
      for (var n = 0; n < 400 * k * k; n++) { g.fillStyle = 'rgba(' + (r() < 0.5 ? '0,0,0' : '255,255,255') + ',0.05)'; g.fillRect(i * s + r() * s, j * s + r() * s, 2 * k, 2 * k); }
    }
    g.fillStyle = shade(hex, 0.7);
    for (i = 0; i < 2; i++) { g.fillRect(i * s - 2 * k, 0, 4 * k, w); g.fillRect(0, i * s - 2 * k, w, 4 * k); }
  }
  function paintCarpet(c, hex) { // dense fibre speckle
    var g = c.getContext('2d'), r = rng(11);
    g.fillStyle = hex; g.fillRect(0, 0, c.width, c.height);
    for (var i = 0; i < 11000; i++) { g.fillStyle = shade(hex, 0.86 + r() * 0.28); g.fillRect(r() * c.width, r() * c.height, 1.6, 1.6); }
  }
  function blob(g, w, h, x, y, rad, col) { // soft blob, wrapped so the tile repeats cleanly
    for (var dx = -w; dx <= w; dx += w) for (var dy = -h; dy <= h; dy += h) {
      var gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  function paintCement(c, hex) { // mottled microcement clouds
    var g = c.getContext('2d'), w = c.width, h = c.height, r = rng(5), s = w / 512;
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 80; i++) blob(g, w, h, r() * w, r() * h, (60 + r() * 120) * s, r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)');
    for (var k = 0; k < 3000 * s * s; k++) { g.fillStyle = 'rgba(0,0,0,0.035)'; g.fillRect(r() * w, r() * h, 2 * s, 2 * s); }
  }
  function paintStone(c, hex) { // porcelain slab: veins, clouds, joint lines
    var g = c.getContext('2d'), w = c.width, h = c.height, r = rng(3), i, s = w / 256;
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    for (i = 0; i < 30; i++) blob(g, w, h, r() * w, r() * h, (40 + r() * 90) * s, r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.09)');
    for (i = 0; i < 14; i++) {
      g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.2)' : 'rgba(50,45,40,0.2)'; g.lineWidth = (0.6 + r() * 1.6) * s;
      g.beginPath(); g.moveTo(r() * w, 0);
      g.bezierCurveTo(r() * w, h * 0.3, r() * w, h * 0.6, r() * w, h); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 3 * s; g.strokeRect(0, 0, w, h);
  }
  function paint(kind, hex) { // build the canvas for a texture kind (1024px for crisp close-ups)
    var c = kind === 'stone' ? cv(512, 1120) : kind === 'carpet' ? cv(512, 512) : cv(1024, 1024);
    if (kind === 'woodV') paintWood(c, hex, true, 6, 21);
    else if (kind === 'woodH') paintWood(c, hex, false, 4, 22);
    else if (kind === 'floorWood') paintWood(c, hex, false, 8, 23);
    else if (kind === 'tile') paintTile(c, hex);
    else if (kind === 'carpet') paintCarpet(c, hex);
    else if (kind === 'cement') paintCement(c, hex);
    else paintStone(c, hex);
    return c;
  }
  function getTex(kind, hex, rx, ry) { // cached CanvasTexture with the repeat baked in
    var ck = kind + '|' + hex;
    if (!canv[ck]) canv[ck] = paint(kind, hex);
    var tk = ck + '|' + rx.toFixed(2) + '|' + ry.toFixed(2);
    if (!texs[tk]) {
      var t = new THREE.CanvasTexture(canv[ck]);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
      t.encoding = THREE.sRGBEncoding; t.anisotropy = maxAniso; texs[tk] = t;
    }
    return texs[tk];
  }
  function specialTex(name) { // glow / flame / screen sheen, built once
    if (special[name]) return special[name];
    var c, g, i, r = rng(9), gr;
    if (name === 'glow') {
      c = cv(256, 256); g = c.getContext('2d'); gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    } else if (name === 'flame') {
      c = cv(256, 96); g = c.getContext('2d'); g.globalCompositeOperation = 'lighter';
      for (i = 0; i < 34; i++) {
        var x = r() * 256, fh = 30 + r() * 56, fw = 10 + r() * 16;
        gr = g.createLinearGradient(0, 96, 0, 96 - fh);
        gr.addColorStop(0, 'rgba(255,210,120,0.9)'); gr.addColorStop(0.5, 'rgba(255,120,30,0.6)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - fw / 2, 96);
        g.quadraticCurveTo(x - fw / 4, 96 - fh * 0.5, x + (r() - 0.5) * 10, 96 - fh);
        g.quadraticCurveTo(x + fw / 4, 96 - fh * 0.5, x + fw / 2, 96); g.fill();
      }
    } else if (name === 'ao') { // soft contact shadow: opaque black at the bottom edge fading to clear
      c = cv(8, 128); g = c.getContext('2d'); gr = g.createLinearGradient(0, 128, 0, 0);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    } else {
      c = cv(256, 144); g = c.getContext('2d'); gr = g.createLinearGradient(0, 0, 256, 144);
      gr.addColorStop(0.3, 'rgba(255,255,255,0)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      gr.addColorStop(0.62, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.72, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 144);
    }
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; special[name] = t; return t;
  }

  /* ---------- materials + mesh helpers ---------- */
  function M(o) { // PBR material; textured ones are tinted white so the map carries the colour
    var m = new THREE.MeshStandardMaterial({
      color: o.map ? new THREE.Color(1, 1, 1) : C(o.hex || '#ffffff'),
      roughness: o.r == null ? 0.8 : o.r, metalness: o.m || 0, map: o.map || null
    });
    if (o.bump && o.map) { m.bumpMap = o.map; m.bumpScale = o.bump; } // grain relief from the colour map
    if (envTex) m.envMap = envTex;
    m.userData.env = o.env == null ? 0.3 : o.env; m.envMapIntensity = m.userData.env;
    mats.push(m); envMats.push(m); return m;
  }
  function B(hex, o) { // unlit / emissive-looking material
    o = o || {};
    var m = new THREE.MeshBasicMaterial({
      color: C(hex), map: o.map || null, transparent: !!o.add || (o.op != null && o.op < 1), opacity: o.op == null ? 1 : o.op,
      blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.add
    });
    mats.push(m); return m;
  }
  function box(p, w, h, d, x, y, z, m, cast) {
    var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); o.castShadow = cast !== false; o.receiveShadow = true; p.add(o); return o;
  }
  function pln(p, w, h, x, y, z, m) {
    var o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    o.position.set(x, y, z); o.receiveShadow = true; p.add(o); return o;
  }
  function facingMat(facing, hex, w, h) { // wall facing material by type
    if (facing === 'woodVeneer') return M({ map: getTex('woodV', hex, w / 1.2, h / 2.6), r: 0.5, env: 0.25, bump: 0.0015 });
    if (facing === 'stone') return M({ map: getTex('stone', hex, w / 1.2, 1), r: 0.42, env: 0.45 });
    if (facing === 'microcement') return M({ map: getTex('cement', hex, w / 1.6, h / 1.6), r: 0.85, env: 0.15, bump: 0.002 });
    return M({ hex: hex, r: 0.9, env: 0.15 });
  }
  function finishMat(hex, id) { // cabinet / shelf finish: wood grain for oak/walnut
    if (id === 'oak' || id === 'walnut') return M({ map: getTex('woodH', hex, 1, 1), r: 0.55, env: 0.25, bump: 0.001 });
    return M({ hex: hex, r: 0.72, env: 0.2 });
  }
  function decor(p, i, x, y, z) { // small props on a surface at height y
    var k = i % 3, o;
    if (k === 0) {
      o = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 18), M({ hex: '#D9D1C3', r: 0.4 })); o.position.set(x, y + 0.11, z);
    } else if (k === 1) {
      o = new THREE.Group();
      box(o, 0.22, 0.035, 0.15, 0, 0.0175, 0, M({ hex: '#7A6A58', r: 0.8 }));
      box(o, 0.2, 0.03, 0.14, 0.01, 0.05, 0, M({ hex: '#CDBFA9', r: 0.8 }));
      o.position.set(x, y, z);
    } else {
      o = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.06, 20), M({ hex: '#3A3632', r: 0.5 })); o.position.set(x, y + 0.03, z);
    }
    o.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    p.add(o);
  }

  /* ---------- layout maths (positions shared by all builders) ---------- */
  function computeLayout(s) {
    var L = {}, fire = s.fireplace !== 'none';
    L.fire = fire; L.fw = s.fireplace === 'linear72' ? 1.83 : 1.52;
    L.cabTop = s.cabinetry === 'none' ? 0 : 0.55;
    L.pad = !fire ? 0 : s.fireplaceFrame === 'stone' ? 0.14 : s.fireplaceFrame === 'metal' ? 0.06 : 0;
    L.openBottom = (s.cabinetry === 'none' ? 0.35 : L.cabTop + 0.06) + L.pad;
    L.openTop = L.openBottom + 0.4;
    L.tvY = fire ? L.openTop + L.pad + 0.15 + TVH / 2 : 1.3;
    L.tvTop = L.tvY + TVH / 2;
    L.full = s.layout === 'full';
    L.nicheOn = s.layout === 'niches' || s.niches === 'side' || s.niches === 'both';
    L.shelvesOn = s.niches === 'shelves' || s.niches === 'both';
    return L;
  }

  /* ---------- builders: room shell (floor, walls, ceiling, props) ---------- */
  function buildFloor(s) {
    var hex = hexOf('floor', s.floor) || '#C9A97C', m;
    if (s.floor === 'carpet') m = M({ map: getTex('carpet', hex, 5, 5), r: 1, env: 0.05 });
    else if (s.floor === 'greyTile') m = M({ map: getTex('tile', hex, W / 1.2, D / 1.2), r: 0.3, env: 0.5 });
    else m = M({ map: getTex('floorWood', hex, W / 1.4, D / 1.4), r: s.floor === 'walnut' ? 0.45 : 0.55, env: 0.3, bump: 0.001 });
    var f = pln(root, W, D, 0, 0, D / 2, m); f.rotation.x = -Math.PI / 2;
  }
  function buildWalls(s, wallHex) {
    var m = M({ hex: wallHex, r: 0.95, env: 0.15 }), l, r;
    pln(root, W, H, 0, H / 2, 0, m);
    l = pln(root, D, H, -W / 2, H / 2, D / 2, m); l.rotation.y = Math.PI / 2;
    r = pln(root, D, H, W / 2, H / 2, D / 2, m); r.rotation.y = -Math.PI / 2;
    var sk = M({ hex: mixHex(wallHex, '#FFFFFF', 0.35), r: 0.6, env: 0.2 });
    box(root, 0.02, 0.09, D, -W / 2 + 0.01, 0.045, D / 2, sk, false);
    box(root, 0.02, 0.09, D, W / 2 - 0.01, 0.045, D / 2, sk, false);
  }
  function glowPlane(w, d, x, z, hex) { // additive light spill on the ceiling
    var m = B(hex, { map: specialTex('glow'), add: true, op: 0 });
    var p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.position.set(x, H - 0.012, z); p.rotation.x = Math.PI / 2; root.add(p);
    (dyn.cove = dyn.cove || []).push(m);
  }
  function buildCeiling(s, wallHex) {
    var cm = M({ hex: mixHex(wallHex, '#F2EFEA', 0.65), r: 0.95, env: 0.1 }), c, i;
    c = pln(root, W, D, 0, H, D / 2, cm); c.rotation.x = Math.PI / 2;
    if (s.ceiling === 'beam') {
      var bm = M({ map: getTex('woodH', '#5E3F2B', 3, 0.3), r: 0.6, env: 0.2 });
      for (i = 0; i < 4; i++) box(root, W, 0.16, 0.2, 0, H - 0.08, 0.9 + i * 1.2, bm);
    } else if (s.ceiling === 'cove') {
      var led = s.led !== 'off' ? hexOf('led', s.led) : '#FFC98A';
      box(root, W, 0.14, 0.3, 0, H - 0.07, 0.15, cm, false);
      box(root, 0.3, 0.14, D, -W / 2 + 0.15, H - 0.07, D / 2, cm, false);
      box(root, 0.3, 0.14, D, W / 2 - 0.15, H - 0.07, D / 2, cm, false);
      glowPlane(W, 1.4, 0, 0.75, led); glowPlane(1.4, D, -W / 2 + 0.75, D / 2, led); glowPlane(1.4, D, W / 2 - 0.75, D / 2, led);
    }
  }
  function aoStrip(w, h, x, y, z, rx, rz, op) { // gradient plane; its dark edge sits in the corner
    var m = B('#000000', { map: specialTex('ao'), op: op });
    m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2;
    var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z); p.rotation.set(rx, 0, rz); p.renderOrder = 1; root.add(p);
  }
  function buildAO() { // fake ambient occlusion along room junctions: grounds the wall visually
    var f = 0.004, zw = PZ + 0.002;
    // Narrow, fairly dense strips: corners read as crisp creases rather than soft smudges.
    aoStrip(W, 0.28, 0, f, 0.14, -Math.PI / 2, Math.PI, 0.42);               // floor, along the wall
    aoStrip(W, 0.12, 0, 0.06, zw, 0, 0, 0.3);                                 // wall, just above the floor
    aoStrip(W, 0.16, 0, H - 0.08, zw, 0, Math.PI, 0.3);                       // wall, under the ceiling
    aoStrip(W, 0.26, 0, H - f, 0.13, Math.PI / 2, 0, 0.32);                   // ceiling, along the wall
    aoStrip(H, 0.14, W / 2 - 0.07, H / 2, zw, 0, Math.PI / 2, 0.34);          // right corner
    aoStrip(H, 0.14, -W / 2 + 0.07, H / 2, zw, 0, -Math.PI / 2, 0.34);        // left corner
  }
  function buildProps() { // sofa, table + rug: shown in the Room view only
    props = new THREE.Group(); root.add(props);
    var fab = M({ hex: '#8D8578', r: 1, env: 0.05 }), wd = M({ hex: '#4A3A2D', r: 0.6, env: 0.2 });
    var rug = pln(props, 3.2, 2.3, 0, 0.006, 2.7, M({ hex: '#CFC7B8', r: 1, env: 0.03 })); rug.rotation.x = -Math.PI / 2;
    box(props, 2.2, 0.38, 0.9, 0, 0.19, 4.35, fab); box(props, 2.2, 0.5, 0.2, 0, 0.62, 4.75, fab);
    box(props, 0.2, 0.28, 0.9, -1.1, 0.5, 4.35, fab); box(props, 0.2, 0.28, 0.9, 1.1, 0.5, 4.35, fab);
    box(props, 1.0, 0.04, 0.55, 0, 0.38, 3.0, wd);
    [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]].forEach(function (q) { box(props, 0.04, 0.36, 0.04, q[0], 0.18, 3.0 + q[1], wd); });
    props.visible = viewName === 'room';
  }

  /* ---------- builders: wall (panel, niches, shelves, cabinets) ---------- */
  function buildPanel(s, L, wallHex, panelHex) {
    var pw = L.full ? W : 2.8;
    if (!L.full) pln(root, W, H, 0, H / 2, 0.001, M({ hex: wallHex, r: 0.95, env: 0.15 }));
    box(root, pw, H, 0.04, 0, H / 2, 0.02, facingMat(s.facing, panelHex, pw, H), false);
  }
  function nicheMat(s, L, wallHex, panelHex) { // interior colour for niches
    if (s.nicheInterior === 'dark') return M({ hex: hexOf('nicheInterior', 'dark'), r: 0.8, env: 0.15 });
    if (s.nicheInterior === 'wood') return M({ map: getTex('woodH', hexOf('nicheInterior', 'wood'), 1, 1), r: 0.55, env: 0.25 });
    return L.full ? facingMat(s.facing, panelHex, 0.6, 1.9) : M({ hex: wallHex, r: 0.95, env: 0.15 });
  }
  function buildShelfSet(s, L, x, y0, nh, inNiche, fin, k) { // shelves + decor for one side
    var hs = inNiche ? (L.shelvesOn ? [0.25, 0.5, 0.75] : [0.5]).map(function (f) { return y0 + nh * f; }) : [0.95, 1.45, 1.95];
    var z = (L.full || inNiche ? PZ : 0) + (inNiche ? 0.12 : 0.11) + (inNiche && !L.full ? 0.005 : 0);
    hs.forEach(function (y, i) {
      box(root, 0.58, 0.028, inNiche ? 0.22 : 0.22, x, y, z, fin);
      if (i !== 1 || !inNiche) decor(root, i + k, x + (i % 2 ? 0.1 : -0.1), y + 0.014, z);
    });
  }
  function buildNiches(s, L, wallHex, panelHex) {
    if (!L.nicheOn && !L.shelvesOn) return;
    var y0 = s.cabinetry !== 'none' ? 0.7 : 0.35, y1 = 2.25, nh = y1 - y0, nw = 0.6, dp = 0.24;
    var base = L.full ? PZ : 0, im = nicheMat(s, L, wallHex, panelHex);
    var fin = finishMat(hexOf('cabinetFinish', s.cabinetFinish), s.cabinetFinish);
    [-1, 1].forEach(function (sx, k) {
      var x = sx * 1.8;
      if (L.nicheOn) {
        pln(root, nw, nh, x, y0 + nh / 2, base + 0.004, im);
        box(root, nw + 0.06, 0.03, dp, x, y1 + 0.015, base + dp / 2, im);
        box(root, nw + 0.06, 0.03, dp, x, y0 - 0.015, base + dp / 2, im);
        box(root, 0.03, nh + 0.06, dp, x - nw / 2 - 0.015, y0 + nh / 2, base + dp / 2, im);
        box(root, 0.03, nh + 0.06, dp, x + nw / 2 + 0.015, y0 + nh / 2, base + dp / 2, im);
      }
      if (L.nicheOn || L.shelvesOn) buildShelfSet(s, L, x, y0, nh, L.nicheOn, fin, k);
    });
  }
  function buildCabinets(s, L) {
    if (s.cabinetry === 'none') return;
    var fin = finishMat(hexOf('cabinetFinish', s.cabinetFinish), s.cabinetFinish), fl = s.cabinetry === 'floating';
    var w = fl ? 2.4 : W - 0.02, h = fl ? 0.36 : 0.55, y = fl ? 0.2 + h / 2 : h / 2, dep = 0.42, z = PZ + dep / 2;
    box(root, w, h, dep, 0, y, z, fin);
    var n = fl ? 4 : 8, gap = B('#000000', { op: 0.55, add: false });
    for (var i = 1; i < n; i++) pln(root, 0.006, h - 0.02, -w / 2 + w * i / n, y, PZ + dep + 0.001, gap);
    decor(root, 0, -w / 2 + 0.35, y + h / 2, z); decor(root, 1, w / 2 - 0.4, y + h / 2, z);
  }

  /* ---------- builders: fireplace, TV, LED band, slats, reveals ---------- */
  function buildFireplace(s, L) {
    if (!L.fire) return;
    var fw = L.fw, oy = (L.openBottom + L.openTop) / 2, bz = PZ + 0.035;
    var dark = M({ hex: '#0E0E0E', r: 0.4, m: 0.5, env: 0.5 });
    box(root, fw + 0.04, 0.44, 0.07, 0, oy, bz, dark);
    var glass = M({ hex: '#050505', r: 0.08, m: 0.2, env: 1 });
    pln(root, fw, 0.38, 0, oy, PZ + 0.0715, glass);
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.06, 0.3), B('#FFFFFF', { map: specialTex('flame'), add: true, op: 1 }));
    fl.position.set(0, L.openBottom + 0.03 + 0.15, PZ + 0.0725); root.add(fl);
    pln(root, fw - 0.1, 0.03, 0, L.openBottom + 0.035, PZ + 0.073, B('#FF7A2A'));
    if (L.pad > 0) buildFrame(s, L, oy);
  }
  function buildFrame(s, L, oy) { // stone surround or thin black metal frame
    var st = s.fireplaceFrame === 'stone', p = L.pad, dep = st ? 0.13 : 0.1, z = PZ + dep / 2;
    var m = st ? M({ map: getTex('stone', '#C9C2B6', 1.6, 0.5), r: 0.45, env: 0.4 }) : M({ hex: '#101010', r: 0.5, m: 0.6, env: 0.6 });
    var iw = L.fw + 0.04, ih = 0.44;
    box(root, iw + 2 * p, p, dep, 0, oy + ih / 2 + p / 2, z, m);
    box(root, iw + 2 * p, p, dep, 0, oy - ih / 2 - p / 2, z, m);
    box(root, p, ih, dep, -iw / 2 - p / 2, oy, z, m);
    box(root, p, ih, dep, iw / 2 + p / 2, oy, z, m);
  }
  function buildTV(L) {
    var y = L.tvY, z = PZ + 0.03 + 0.02;
    box(root, 0.4, 0.3, 0.03, 0, y, PZ + 0.015 + 0.002, M({ hex: '#111111', r: 0.6, m: 0.5, env: 0.3 }));
    box(root, TVW + 0.02, TVH + 0.02, 0.04, 0, y, z, M({ hex: '#0B0B0C', r: 0.35, m: 0.6, env: 0.6 }));
    pln(root, TVW, TVH, 0, y, z + 0.0205, M({ hex: '#040405', r: 0.06, m: 0.4, env: 1.0 }));
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(TVW, TVH), B('#FFFFFF', { map: specialTex('sheen'), add: true, op: 1 }));
    sh.position.set(0, y, z + 0.021); root.add(sh);
  }
  function buildLED(s, L) {
    if (s.led === 'off') return;
    var hex = hexOf('led', s.led), y = L.tvTop + 0.07;
    var strip = new THREE.Mesh(new THREE.BoxGeometry(TVW + 0.5, 0.022, 0.02), B(hex));
    strip.position.set(0, y, PZ + 0.03); root.add(strip);
    var gm = B(hex, { map: specialTex('glow'), add: true, op: 0 });
    var g = new THREE.Mesh(new THREE.PlaneGeometry(TVW + 2.0, 1.3), gm);
    g.position.set(0, y, PZ + 0.032); g.renderOrder = 2; root.add(g); dyn.glow = gm;
    dyn.ledHex = hex; dyn.ledPos = new THREE.Vector3(0, y, PZ + 0.35);
  }
  function slatBand(x0, x1, y0, y1, hex, id) { // instanced vertical slats over a dark felt backing
    var n = Math.max(1, Math.floor((x1 - x0) / 0.08)), dm = new THREE.Object3D();
    var m = id === 'black' ? M({ hex: hex, r: 0.5, env: 0.25 }) : M({ map: getTex('woodV', hex, 0.25, 1), r: 0.55, env: 0.25 });
    var im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, y1 - y0, 0.03), m, n);
    for (var i = 0; i < n; i++) {
      dm.position.set(x0 + 0.04 + i * 0.08, (y0 + y1) / 2, PZ + 0.02); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix);
    }
    im.castShadow = im.receiveShadow = true; root.add(im);
    pln(root, x1 - x0 + 0.02, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, PZ + 0.004, M({ hex: '#1D1B19', r: 1, env: 0.05 }));
  }
  function buildSlats(s, L) {
    if (s.slats === 'none') return;
    var hex = hexOf('slatTone', s.slatTone);
    if (s.slats === 'sides') { slatBand(0.95, 1.35, 0, H, hex, s.slatTone); slatBand(-1.35, -0.95, 0, H, hex, s.slatTone); }
    else slatBand(-1.05, 1.05, L.tvY - TVH / 2 - 0.25, L.tvTop + 0.25, hex, s.slatTone);
  }
  function buildReveals(s, L) {
    if (s.reveals === 'none') return;
    var hex = hexOf('reveals', s.reveals);
    var m = s.reveals === 'brass' ? M({ hex: hex, m: 0.95, r: 0.3, env: 1 }) : M({ hex: hex, m: 0.2, r: 0.5, env: 0.4 });
    var z = PZ + 0.006, hy = Math.min(L.tvTop + 0.3, 2.52);
    box(root, 0.012, H, 0.012, -1.38, H / 2, z, m, false); box(root, 0.012, H, 0.012, 1.38, H / 2, z, m, false);
    box(root, 2.76, 0.012, 0.012, 0, hy, z, m, false);
  }

  /* ---------- scene lifecycle: clear + rebuild ---------- */
  function clearRoot() {
    if (!root) return;
    root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    scene.remove(root);
    mats.forEach(function (m) { m.dispose(); });
    mats = []; envMats = []; dyn = {};
  }
  function rebuild() {
    clearRoot(); root = new THREE.Group(); scene.add(root);
    var s = S, L = Lay = computeLayout(s);
    var wallHex = hexOf('wallColor', s.wallColor) || '#EEEAE3', panelHex = hexOf('panelColor', s.panelColor) || '#EEEAE3';
    buildFloor(s); buildWalls(s, wallHex); buildCeiling(s, wallHex); buildProps();
    buildPanel(s, L, wallHex, panelHex); buildNiches(s, L, wallHex, panelHex); buildCabinets(s, L);
    buildFireplace(s, L); buildSlats(s, L); buildTV(L); buildLED(s, L); buildReveals(s, L); buildAO();
    root.traverse(function (o) { if (o.isMesh && o.castShadow === undefined) o.castShadow = false; });
    renderer.shadowMap.needsUpdate = true; // static scene: shadows re-render only when the design changes
    placeLights(L); applyLighting();
  }
  function placeLights(L) { // LED + fire point lights follow the layout
    if (dyn.ledHex) { ledLight.color.copy(C(dyn.ledHex)); ledLight.position.copy(dyn.ledPos); }
    if (L.fire) fireLight.position.set(0, (L.openBottom + L.openTop) / 2, PZ + 0.5);
  }
  function applyLighting() { // push the active lighting preset into lights + dynamic materials
    var P = LIGHT[lightMode];
    hemi.intensity = P.hemi; key.intensity = P.key; renderer.toneMappingExposure = P.exp;
    scene.background.setHex(P.bg);
    envMats.forEach(function (m) { m.envMapIntensity = (m.userData.env || 0.3) * P.env; });
    ledLight.intensity = dyn.glow ? P.led : 0;
    fireLight.intensity = Lay && Lay.fire ? P.fire : 0;
    if (dyn.glow) dyn.glow.opacity = P.glow;
    (dyn.cove || []).forEach(function (m) { m.opacity = P.cove; });
    requestRender();
  }

  /* ---------- camera: views, tween, zoom, fit-to-container ---------- */
  var KEYS = ['px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov', 'zoom'];
  function viewTarget(n) {
    var ty = Lay ? Lay.tvY : 1.3, fire = Lay && Lay.fire;
    if (n === 'angle') return { px: 2.3, py: 1.55, pz: 4.0, lx: -0.3, ly: 1.3, lz: 0, fov: 36 };
    if (n === 'detail') return { px: 0.6, py: ty + 0.1, pz: 2.6, lx: 0, ly: fire ? ty - 0.33 : ty, lz: 0, fov: 36 };
    if (n === 'room') return { px: 2.2, py: 1.85, pz: 5.7, lx: 0, ly: 1.15, lz: 0, fov: 44 };
    return { px: 0, py: 1.35, pz: 4.7, lx: 0, ly: 1.3, lz: 0, fov: 38 };
  }
  function goView(n, instant) {
    var z = tgt.zoom == null ? 1 : tgt.zoom;
    tgt = viewTarget(n); tgt.zoom = z;
    orbT.yaw = orbT.pitch = vel.yaw = vel.pitch = 0;      // preset views drop any free-orbit offset
    if (instant) { orb.yaw = orb.pitch = 0; }
    if (instant) { KEYS.forEach(function (k) { cur[k] = tgt[k]; }); tween = null; applyCam(); requestRender(); }
    else startTween(600);
  }
  function startTween(ms) {
    tween = { from: Object.assign({}, cur), t0: performance.now(), ms: ms };
    requestRender();
  }
  function stepTween() { // eased interpolation toward tgt
    if (!tween) return;
    var k = Math.min(1, (performance.now() - tween.t0) / tween.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    KEYS.forEach(function (n) { if (!(n === 'zoom' && tween.userZoom)) cur[n] = tween.from[n] + (tgt[n] - tween.from[n]) * e; });
    if (k >= 1) tween = null;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function aspect() {
    var w = container ? container.clientWidth || 1 : 1, h = container ? container.clientHeight || 1 : 1;
    return w / h;
  }
  // Spherical camera around the look-at point, with angle limits that keep the camera INSIDE the room:
  // above the floor, below the ceiling and between the side walls (one function for clamp + placement).
  function orbitFrame(v, zoom) {
    var a = aspect(), fit = a < 1.4 ? Math.min(2.2, 1.4 / a) : 1, f = zoom * fit;  // narrow containers pull back
    var x = (v.px - v.lx) * f, y = (v.py - v.ly) * f, z = (v.pz - v.lz) * f;
    var r = Math.sqrt(x * x + y * y + z * z) || 1, M = 0.15;
    var elMin = Math.max(PITCH_MIN, Math.asin(clamp((0.2 - v.ly) / r, -1, 1)));
    var elMax = Math.min(PITCH_MAX, Math.asin(clamp((H - M - v.ly) / r, -1, 1)));
    return { r: r, az: Math.atan2(x, z), el: Math.asin(clamp(y / r, -1, 1)), elMin: elMin, elMax: Math.max(elMin, elMax), lx: v.lx };
  }
  function azRange(o, el) { // yaw range that keeps x inside the side walls at this elevation
    var rc = o.r * Math.cos(el), E = W / 2 - 0.15;
    function side(v) { return v >= 1 ? Math.PI / 2 : v <= -1 ? -Math.PI / 2 : Math.asin(v); }
    var lo = Math.max(-YAW_MAX, side((-E - o.lx) / rc)), hi = Math.min(YAW_MAX, side((E - o.lx) / rc));
    return lo <= hi ? [lo, hi] : [0, 0];
  }
  function clampOrb() { // clamp the target offset to the reachable arc; kill fling velocity at a limit
    var o = orbitFrame(tgt.px == null ? cur : tgt, tgt.zoom == null ? cur.zoom : tgt.zoom);
    var p = clamp(orbT.pitch, o.elMin - o.el, o.elMax - o.el);
    if (p !== orbT.pitch) { orbT.pitch = p; vel.pitch = 0; }
    var lim = azRange(o, o.el + orbT.pitch), y = clamp(orbT.yaw, lim[0] - o.az, lim[1] - o.az);
    if (y !== orbT.yaw) { orbT.yaw = y; vel.yaw = 0; }
  }
  function applyCam() {
    var o = orbitFrame(cur, cur.zoom);
    var el = clamp(o.el + orb.pitch, o.elMin, o.elMax), lim = azRange(o, el), az = clamp(o.az + orb.yaw, lim[0], lim[1]);
    camera.fov = cur.fov; camera.aspect = aspect();
    camera.position.set(cur.lx + o.r * Math.cos(el) * Math.sin(az), cur.ly + o.r * Math.sin(el), cur.lz + o.r * Math.cos(el) * Math.cos(az));
    camera.lookAt(cur.lx, cur.ly, cur.lz); camera.updateProjectionMatrix();
  }

  /* ---------- render loop (on demand) + resize ---------- */
  function requestRender() { if (ready && !raf) raf = requestAnimationFrame(frame); }
  function stepOrbit(dt) { // inertia + damping; returns true while still moving
    var still = 1e-4;
    if (!dragging && (Math.abs(vel.yaw) > still || Math.abs(vel.pitch) > still)) {
      orbT.yaw += vel.yaw * dt; orbT.pitch += vel.pitch * dt; clampOrb();
      var d = Math.exp(-dt * 5); vel.yaw *= d; vel.pitch *= d;
    } else if (!dragging) { vel.yaw = vel.pitch = 0; }
    var k = 1 - Math.exp(-dt * 16);
    orb.yaw += (orbT.yaw - orb.yaw) * k; orb.pitch += (orbT.pitch - orb.pitch) * k;
    var dampZoom = (!tween || tween.userZoom) && tgt.zoom != null; // wheel/pinch zoom is damped, not tweened
    if (dampZoom) cur.zoom += (tgt.zoom - cur.zoom) * k;
    return dragging || vel.yaw !== 0 || vel.pitch !== 0 || Math.abs(orbT.yaw - orb.yaw) > still ||
      Math.abs(orbT.pitch - orb.pitch) > still || (dampZoom && Math.abs(tgt.zoom - cur.zoom) > still);
  }
  function frame(now) {
    raf = 0;
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60; lastT = now;
    stepTween(); var moving = stepOrbit(dt); applyCam(); renderer.render(scene, camera);
    if (tween || moving) requestRender(); else lastT = 0;
  }
  function resize() {
    if (!container || !renderer) return;
    var w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    // Render at an exact integer multiple of the device pixel ratio so the browser never resamples by a
    // fractional factor (Windows 125%/150% scaling blurred edges): 1x→2x, 1.25x→2.5x (2x supersampled);
    // 1.5x and up render at native resolution with MSAA, capped at 3 for performance.
    var dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(dpr <= 1.25 ? dpr * 2 : Math.min(dpr, 3));
    renderer.setSize(w, h, false); requestRender();
  }

  /* ---------- pointer orbit: drag to look around, wheel/pinch to zoom, double-click to recentre ---------- */
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  function pinchDist() { var p = Array.from(pointers.values()); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1; }
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    if (pointers.size === 2) { pinch0 = pinchDist(); zoom0 = tgt.zoom == null ? 1 : tgt.zoom; }
    dragging = true; orbitNotified = false; vel.yaw = vel.pitch = 0;
    container.classList.add('dragging');
  }
  function onMove(e) {
    var p = pointers.get(e.pointerId); if (!p) return;
    var now = performance.now(), dx = e.clientX - p.x, dy = e.clientY - p.y, dt = Math.max(8, now - p.t) / 1000;
    p.x = e.clientX; p.y = e.clientY; p.t = now;
    if (pointers.size === 1) {
      var s = 2.6 / (container.clientHeight || 500), dyaw = -dx * s, dp = dy * s * 0.75;
      orbT.yaw += dyaw; orbT.pitch += dp; clampOrb();
      vel.yaw = 0.7 * (dyaw / dt) + 0.3 * vel.yaw; vel.pitch = 0.7 * (dp / dt) + 0.3 * vel.pitch;
      if (!orbitNotified && (Math.abs(dx) + Math.abs(dy) > 2)) { orbitNotified = true; container.dispatchEvent(new CustomEvent('wallpreview:orbit')); }
    } else if (pointers.size === 2 && pinch0) {
      tgt.zoom = clamp(zoom0 * pinch0 / pinchDist(), ZMIN, ZMAX); userZoom();
    }
    requestRender();
  }
  function userZoom() { if (tween) tween.userZoom = true; } // the tween stops driving zoom; damping takes over
  function onUp(e) {
    var p = pointers.get(e.pointerId);
    if (!p) return;                       // already handled (pointerup followed by lostpointercapture)
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = 0;
    if (pointers.size) return;
    dragging = false; container.classList.remove('dragging');
    // No fling if the pointer rested before release, or the user prefers reduced motion.
    if (performance.now() - p.t > 90 || (reducedMotion && reducedMotion.matches)) vel.yaw = vel.pitch = 0;
    requestRender();
  }
  // Wheel zooms only when intended: Ctrl/⌘ + scroll (also what trackpad pinch sends), or after the user
  // clicked into the preview. Plain scrolling over the preview otherwise scrolls the page, and the
  // page also scrolls once the zoom limit is reached.
  var wheelArmed = false;
  function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey || wheelArmed)) return;
    var z = tgt.zoom == null ? 1 : tgt.zoom;
    var nz = clamp(z * Math.exp(clamp(e.deltaY, -100, 100) * 0.0015), ZMIN, ZMAX);
    if (nz === z && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    tgt.zoom = nz; userZoom(); requestRender();
  }
  function onDblClick() { orbT.yaw = orbT.pitch = vel.yaw = vel.pitch = 0; requestRender(); }
  function bindPointer(el) {
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
    el.addEventListener('pointerdown', function () { wheelArmed = true; });
    el.addEventListener('pointerleave', function () { if (!dragging) wheelArmed = false; });
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDblClick);
  }

  /* ---------- environment map (soft studio reflections for glass + metal) ---------- */
  function makeEnv() {
    try {
      var es = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
      es.add(new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), new THREE.MeshBasicMaterial({ color: 0x5a564f, side: THREE.BackSide })));
      function panel(w, h, x, y, z, rx, ry, v) {
        var m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); m.color.setScalar(v);
        var p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); es.add(p);
      }
      panel(4, 2, 0, 2.9, 1, Math.PI / 2, 0, 5); panel(3, 2, 0, 0.5, 5.9, 0, Math.PI, 4); panel(3, 2, -5.9, 0.8, 1, 0, Math.PI / 2, 3);
      envTex = pm.fromScene(es, 0.04).texture; pm.dispose();
      es.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    } catch (e) { envTex = null; }
  }

  /* ---------- init: renderer, lights, listeners ---------- */
  function setupLights() {
    hemi = new THREE.HemisphereLight(0xfff4e6, 0x8a7f72, 0.7); scene.add(hemi);
    key = new THREE.DirectionalLight(0xfff0dc, 0.85); key.position.set(-1.6, 2.4, 4.2); key.target.position.set(0, 1.3, 0);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    var c = key.shadow.camera; c.left = -3.5; c.right = 3.5; c.top = 3.5; c.bottom = -3.5; c.near = 0.5; c.far = 10;
    scene.add(key); scene.add(key.target);
    ledLight = new THREE.PointLight(0xffc98a, 0, 3.5, 2); scene.add(ledLight);
    fireLight = new THREE.PointLight(0xff8a3a, 0, 2.6, 2); scene.add(fireLight);
  }
  function init(el) {
    if (!el || typeof el.appendChild !== 'function') return false;
    if (ready) return true;
    if (!window.THREE) return false;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      if (!renderer.getContext()) return false;
    } catch (e) { return false; }
    container = el;
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    container.appendChild(renderer.domElement);
    scene = new THREE.Scene(); scene.background = new THREE.Color(LIGHT.bright.bg);
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    makeEnv(); setupLights(); ready = true;
    renderer.domElement.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });
    renderer.domElement.addEventListener('webglcontextrestored', function () { renderer.shadowMap.needsUpdate = true; requestRender(); });
    bindPointer(renderer.domElement);
    if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(container); }
    else window.addEventListener('resize', resize);
    resize(); tgt = viewTarget('front'); tgt.zoom = 1;
    if (S) rebuild(); else update({});
    goView(viewName, true);
    return true;
  }

  /* ---------- public API ---------- */
  function update(state) {
    var s = Object.assign({}, DEF), k;
    for (k in DEF) if (state && state[k]) s[k] = state[k];
    var sg = JSON.stringify(s);
    if (sg === sig && S) return;
    sig = sg; S = s;
    if (!ready) return;
    rebuild();
    if (viewName === 'detail') goView('detail', true);
    requestRender();
  }
  function setLighting(m) { if (!LIGHT[m]) return; lightMode = m; if (ready && S) applyLighting(); }
  function setView(n) {
    viewName = n;
    if (!ready) return;
    if (props) { props.visible = n === 'room'; renderer.shadowMap.needsUpdate = true; }
    goView(n, false);
  }
  function zoom(d) {
    if (!ready) return;
    tgt.zoom = clamp((tgt.zoom == null ? 1 : tgt.zoom) * (d > 0 ? 0.8 : 1.25), ZMIN, ZMAX);
    startTween(300);
  }
  function reset() {
    viewName = 'front'; lightMode = 'bright';
    if (!ready) return;
    if (props) { props.visible = false; renderer.shadowMap.needsUpdate = true; }
    tgt = viewTarget('front'); tgt.zoom = 1;
    orbT.yaw = orbT.pitch = vel.yaw = vel.pitch = 0; startTween(600);
    if (S) applyLighting();
  }
  function snapshot(scale) { // scale > 1 supersamples: renders ~2400px wide for a crisp summary image
    if (!ready) return '';
    var pr = renderer.getPixelRatio(), w = container.clientWidth || 1, h = container.clientHeight || 1, url;
    var maxSide = (renderer.capabilities.maxTextureSize || 4096) * 0.9;
    var ratio = scale > 1 ? clamp(2400 / w, Math.min(pr, 3), 3) : pr;
    ratio = Math.min(ratio, maxSide / Math.max(w, h));
    tween = null; KEYS.forEach(function (k) { if (tgt[k] != null) cur[k] = tgt[k]; }); orb.yaw = orbT.yaw; orb.pitch = orbT.pitch;
    try {
      if (ratio !== pr) { renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); }
      applyCam(); renderer.render(scene, camera);
      url = renderer.domElement.toDataURL('image/png');
    } finally {
      if (ratio !== pr) { renderer.setPixelRatio(pr); renderer.setSize(w, h, false); }
      requestRender();
    }
    return url;
  }

  window.WallPreview = { init: init, update: update, setLighting: setLighting, setView: setView, zoom: zoom, reset: reset, snapshot: snapshot };
})();

