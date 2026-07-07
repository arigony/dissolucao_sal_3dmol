
const $ = (id) => document.getElementById(id);

/* ============================================================
   3Dmol V5 — chemically controlled manual animation
   ------------------------------------------------------------
   We do NOT use addModel/addModelsAsFrames for the animation.
   XYZ/PDB automatic bond perception is deliberately avoided.
   Only these are drawn:
   - Na+ / Cl- / O / H as spheres
   - O-H covalent bonds inside each water molecule as cylinders
   - ion-dipole interactions as dotted visual guides
   ============================================================ */

const sceneInfo = {
  movie: {
    title: "Filme: hidratação controlada",
    explanation: "<p><strong>Filme:</strong> cristal pequeno, água orientada, saída de Na⁺ e Cl⁻ da superfície e formação de hidratação. As ligações são controladas manualmente.</p>"
  },
  crystal: {
    title: "Cristal de NaCl",
    explanation: "<p><strong>Cristal:</strong> rede iônica simplificada. Não há ligações covalentes entre Na⁺ e Cl⁻; são íons em rede cristalina.</p>"
  },
  na: {
    title: "Na⁺ hidratado",
    explanation: "<p><strong>Na⁺ hidratado:</strong> somente ligações O–H da água são desenhadas. A orientação O···Na⁺ é interação íon–dipolo.</p>"
  },
  cl: {
    title: "Cl⁻ hidratado",
    explanation: "<p><strong>Cl⁻ hidratado:</strong> somente ligações O–H da água são desenhadas. A orientação H···Cl⁻ é interação íon–dipolo.</p>"
  },
  final: {
    title: "Cena final hidratada",
    explanation: "<p><strong>Cena final:</strong> Na⁺ e Cl⁻ separados da superfície e hidratados, com interações pontilhadas.</p>"
  }
};

let viewer = null;
let currentScene = "movie";
let labelsOn = false;
let spinning = false;
let moviePlaying = true;
let movieTimer = null;
let movieFrame = 0;
const movieFrameCount = 60;

const COLORS = {
  Na: "#7c4dff",
  Cl: "#20a85e",
  O: "#e84135",
  H: "#f4f7fb",
  OHBond: "#d7e3ef",
  interaction: "#ffd166",
  highlight: "#ffffff"
};

const RADII = {
  Na: 0.42,
  Cl: 0.58,
  O: 0.24,
  H: 0.14
};

function status(msg) {
  const el = $("viewerStatus");
  if (el) el.textContent = msg;
}

function v(x, y, z) { return { x, y, z }; }
function add(a, b) { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
function sub(a, b) { return v(a.x - b.x, a.y - b.y, a.z - b.z); }
function mul(a, s) { return v(a.x * s, a.y * s, a.z * s); }
function lerp(a, b, t) { return v(a.x * (1 - t) + b.x * t, a.y * (1 - t) + b.y * t, a.z * (1 - t) + b.z * t); }
function len(a) { return Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z); }
function norm(a) { const n = len(a) || 1; return v(a.x/n, a.y/n, a.z/n); }
function cross(a, b) { return v(a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x); }
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t*t*(3 - 2*t); }

function directionFromAngles(theta, phi = 0.25) {
  return norm(v(Math.cos(theta)*Math.cos(phi), Math.sin(theta)*Math.cos(phi), Math.sin(phi)));
}

/* Small crystal: deliberately smaller than previous versions */
function buildCrystal() {
  const atoms = [];
  const d = 2.82;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 2; k++) {
        const elem = ((i + j + k) % 2 === 0) ? "Na" : "Cl";
        atoms.push({
          elem,
          pos: v((i - 1) * d, (j - 1) * d, (k - 0.5) * d),
          crystal: true
        });
      }
    }
  }
  return atoms;
}

const crystalAtoms = buildCrystal();
const naSurfaceStart = v(2.82, 2.82, -1.41);
const clSurfaceStart = v(2.82, -2.82, 1.41);
const naReleased = v(6.4, 2.6, 1.2);
const clReleased = v(6.6, -2.8, -1.0);

function waterMolecule(center, toward, mode) {
  // mode "Na": O near Na+, H away from Na+
  // mode "Cl": H near Cl-, O farther from Cl-
  const d = norm(toward);
  const ref = Math.abs(d.z) < 0.85 ? v(0,0,1) : v(0,1,0);
  const p = norm(cross(d, ref));
  const oh = 0.96;
  const cosh = Math.cos(52.25 * Math.PI / 180);
  const sinh = Math.sin(52.25 * Math.PI / 180);

  let O, H1, H2;
  if (mode === "Na") {
    O = center;
    H1 = add(O, add(mul(d, oh*cosh), mul(p, oh*sinh)));
    H2 = add(O, add(mul(d, oh*cosh), mul(p, -oh*sinh)));
  } else {
    O = center;
    H1 = add(O, add(mul(d, -oh*cosh), mul(p, oh*sinh)));
    H2 = add(O, add(mul(d, -oh*cosh), mul(p, -oh*sinh)));
  }
  return { O, H1, H2, mode };
}

function shellWaters(ionPos, mode, count = 6) {
  const waters = [];
  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * i / count;
    const phi = (i % 2 === 0) ? 0.38 : -0.38;
    const d = directionFromAngles(theta, phi);
    if (mode === "Na") {
      const O = add(ionPos, mul(d, 2.15));
      waters.push(waterMolecule(O, d, "Na"));
    } else {
      // for Cl-, place O farther; H point toward Cl-
      const O = add(ionPos, mul(d, 2.85));
      waters.push(waterMolecule(O, d, "Cl"));
    }
  }
  return waters;
}

function approachWaters() {
  const starts = [];
  for (let i = 0; i < 12; i++) {
    const theta = 2 * Math.PI * i / 12;
    const center = v(8.6 + 0.35*Math.sin(i), 4.8*Math.sin(theta), 4.5*Math.cos(theta));
    const d = directionFromAngles(theta, 0.2*Math.sin(i));
    starts.push(waterMolecule(center, d, i < 6 ? "Na" : "Cl"));
  }
  return starts;
}

function waterParts(water) {
  return [
    { elem: "O", pos: water.O },
    { elem: "H", pos: water.H1 },
    { elem: "H", pos: water.H2 }
  ];
}

function lerpWater(a, b, t) {
  return { O: lerp(a.O, b.O, t), H1: lerp(a.H1, b.H1, t), H2: lerp(a.H2, b.H2, t), mode: b.mode };
}

function movieState(frameIndex) {
  const t = frameIndex / (movieFrameCount - 1);
  const waterT = smooth(t);
  const releaseT = smooth((t - 0.25) / 0.55);
  const interactionT = smooth((t - 0.35) / 0.45);

  const naPos = lerp(naSurfaceStart, naReleased, releaseT);
  const clPos = lerp(clSurfaceStart, clReleased, releaseT);

  const startWaters = approachWaters();
  const finalWaters = shellWaters(naPos, "Na", 6).concat(shellWaters(clPos, "Cl", 6));
  const waters = finalWaters.map((w, i) => lerpWater(startWaters[i], w, waterT));

  return {
    crystalAtoms: crystalAtoms.map(a => {
      if (a.elem === "Na" && Math.abs(a.pos.x - naSurfaceStart.x) < 0.01 && Math.abs(a.pos.y - naSurfaceStart.y) < 0.01 && Math.abs(a.pos.z - naSurfaceStart.z) < 0.01) {
        return { ...a, pos: naPos, released: true, highlight: true };
      }
      if (a.elem === "Cl" && Math.abs(a.pos.x - clSurfaceStart.x) < 0.01 && Math.abs(a.pos.y - clSurfaceStart.y) < 0.01 && Math.abs(a.pos.z - clSurfaceStart.z) < 0.01) {
        return { ...a, pos: clPos, released: true, highlight: true };
      }
      return a;
    }),
    waters,
    interactionsOn: interactionT > 0.2,
    naPos,
    clPos
  };
}

function sceneState(scene) {
  if (scene === "crystal") {
    return { crystalAtoms, waters: [], interactionsOn: false };
  }
  if (scene === "na") {
    return { crystalAtoms: [{ elem: "Na", pos: v(0,0,0), released: true, highlight: true }], waters: shellWaters(v(0,0,0), "Na", 6), interactionsOn: true, naPos: v(0,0,0) };
  }
  if (scene === "cl") {
    return { crystalAtoms: [{ elem: "Cl", pos: v(0,0,0), released: true, highlight: true }], waters: shellWaters(v(0,0,0), "Cl", 6), interactionsOn: true, clPos: v(0,0,0) };
  }
  if (scene === "final") {
    return movieState(movieFrameCount - 1);
  }
  return movieState(movieFrame);
}

function addSphere(atom) {
  const radius = atom.highlight ? (RADII[atom.elem] + 0.08) : RADII[atom.elem];
  viewer.addSphere({
    center: atom.pos,
    radius,
    color: COLORS[atom.elem] || "#cccccc",
    alpha: 1.0
  });

  if (atom.highlight) {
    viewer.addSphere({
      center: atom.pos,
      radius: radius + 0.20,
      color: COLORS.highlight,
      alpha: 0.18
    });
  }

  if (labelsOn && (atom.elem === "Na" || atom.elem === "Cl")) {
    viewer.addLabel(atom.elem === "Na" ? "Na⁺" : "Cl⁻", {
      position: atom.pos,
      backgroundColor: "rgba(0,0,0,0.38)",
      fontColor: "white",
      fontSize: 13,
      inFront: true
    });
  }
}

function addOHBond(a, b) {
  viewer.addCylinder({
    start: a,
    end: b,
    radius: 0.055,
    color: COLORS.OHBond,
    fromCap: true,
    toCap: true
  });
}

function addDottedInteraction(start, end) {
  const segments = 7;
  for (let i = 0; i < segments; i += 2) {
    const a = i / segments;
    const b = (i + 1) / segments;
    viewer.addCylinder({
      start: lerp(start, end, a),
      end: lerp(start, end, b),
      radius: 0.030,
      color: COLORS.interaction,
      alpha: 0.78,
      fromCap: true,
      toCap: true
    });
  }
}

function drawWater(water, interactionsOn, naPos, clPos) {
  // Draw only covalent O-H bonds in water.
  addOHBond(water.O, water.H1);
  addOHBond(water.O, water.H2);

  waterParts(water).forEach(addSphere);

  if (interactionsOn) {
    if (water.mode === "Na" && naPos) {
      addDottedInteraction(water.O, naPos);
    }
    if (water.mode === "Cl" && clPos) {
      addDottedInteraction(water.H1, clPos);
      addDottedInteraction(water.H2, clPos);
    }
  }
}

function renderManualScene(scene = currentScene) {
  if (!viewer) return;
  const state = sceneState(scene);
  viewer.clear();
  viewer.removeAllLabels();

  // Important: no addModel, no inferred sticks.
  state.crystalAtoms.forEach(addSphere);
  state.waters.forEach(w => drawWater(w, state.interactionsOn, state.naPos, state.clPos));

  viewer.setBackgroundColor("#1f3148");
  if (scene === "movie") {
    viewer.spin(false);
  } else {
    viewer.spin(spinning);
  }
  viewer.render();
}

function setCamera(scene) {
  if (!viewer) return;
  viewer.zoomTo();
  if (scene === "movie" || scene === "final") {
    viewer.rotate(20, "y");
    viewer.zoom(1.18);
  }
  viewer.render();
}

function startMovie() {
  stopMovie();
  moviePlaying = true;
  status("Filme controlado em execução: somente O–H é ligação; pontilhado = interação íon–dipolo.");
  movieTimer = setInterval(() => {
    movieFrame = (movieFrame + 1) % movieFrameCount;
    renderManualScene("movie");
  }, 95);
}

function stopMovie() {
  if (movieTimer) clearInterval(movieTimer);
  movieTimer = null;
}

function setScene(scene) {
  currentScene = scene;
  const info = sceneInfo[scene];
  $("viewerTitle").textContent = info.title;
  $("sceneExplanation").innerHTML = info.explanation;
  document.querySelectorAll(".scene-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.scene === scene));

  stopMovie();
  if (scene === "movie") {
    movieFrame = 0;
    renderManualScene("movie");
    setCamera("movie");
    if (moviePlaying) startMovie();
  } else {
    renderManualScene(scene);
    setCamera(scene);
    status(`Cena carregada: ${info.title}.`);
  }
}

function initViewer() {
  const viewerEl = $("viewer3d");
  if (!viewerEl) return;

  if (!window.$3Dmol) {
    status("3Dmol.js não carregou. Verifique a conexão/CDN.");
    return;
  }

  viewer = $3Dmol.createViewer(viewerEl, {
    backgroundColor: "#1f3148",
    antialias: true
  });

  spinning = false;
  moviePlaying = true;
  setScene("movie");

  setTimeout(() => {
    try { viewer.resize(); renderManualScene(currentScene); setCamera(currentScene); } catch(e) {}
  }, 150);

  window.addEventListener("resize", () => setTimeout(() => {
    if (viewer) {
      try { viewer.resize(); renderManualScene(currentScene); } catch (e) {}
    }
  }, 150));
}

document.addEventListener("DOMContentLoaded", initViewer);

document.querySelectorAll(".scene-btn").forEach(btn => {
  btn.addEventListener("click", () => setScene(btn.dataset.scene));
});

document.querySelectorAll(".style-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const style = btn.dataset.style;

    if (style === "hydration") {
      status("Estilo rigoroso ativo: somente O–H é ligação; hidratação é pontilhada.");
      renderManualScene(currentScene);
    }

    if (style === "spacefill") {
      status("Nesta versão rigorosa, spacefill mantém ligações falsas desligadas.");
      renderManualScene(currentScene);
    }

    if (style === "labels") {
      labelsOn = !labelsOn;
      renderManualScene(currentScene);
    }

    if (style === "spin") {
      spinning = !spinning;
      if (currentScene === "movie") {
        status("No filme, a rotação automática permanece desligada para não prejudicar a leitura.");
        spinning = false;
      }
      renderManualScene(currentScene);
    }

    if (style === "play") {
      if (currentScene !== "movie") {
        status("Play/pause atua apenas na cena Filme.");
        return;
      }
      moviePlaying = !moviePlaying;
      if (moviePlaying) startMovie();
      else {
        stopMovie();
        status("Filme pausado.");
      }
    }

    if (style === "reset" && viewer) {
      setCamera(currentScene);
      renderManualScene(currentScene);
    }
  });
});


/* Pedagogical quantitative simulation */
const sim = {
  salt: $("saltMass"), water: $("waterMass"), temp: $("temperature"), ag: $("agitation"), grain: $("grainSize"),
  saltV: $("saltMassValue"), waterV: $("waterMassValue"), tempV: $("temperatureValue"), agV: $("agitationValue"),
  liquid: $("liquid"), particles: $("particleLayer"), solid: $("solidLayer"), reset: $("resetMessage")
};

let simT = 0, dissolved = 0, running = false, timer = null;
let simHistory = [{ time: 0, dissolved: 0, capacity: 0 }];
const grainFactors = { fine: 1.35, medium: 1, coarse: 0.68 };

function fmt(n, d = 1) { return n.toFixed(d).replace(".", ","); }
function inputs() { return { salt: +sim.salt.value, water: +sim.water.value, temp: +sim.temp.value, ag: +sim.ag.value, grain: sim.grain.value }; }
function sol100(t) { return 35.7 + (39.2 - 35.7) * (t / 100); }
function cap() { const x = inputs(); return sol100(x.temp) * (x.water / 100); }
function target() { const x = inputs(); return Math.min(x.salt, cap()); }

function updateLabels() {
  const x = inputs();
  sim.saltV.textContent = x.salt;
  sim.waterV.textContent = x.water;
  sim.tempV.textContent = x.temp;
  sim.agV.textContent = x.ag;
}

function reset(withMsg = false) {
  clearInterval(timer); running = false; simT = 0; dissolved = 0; simHistory = [{ time: 0, dissolved: 0, capacity: cap() }]; update();
  if (withMsg) {
    sim.reset.textContent = "Experimento reiniciado para manter coerência química.";
    setTimeout(() => sim.reset.textContent = "", 2500);
  }
}

function step() {
  const x = inputs(), tg = target();
  const k = 0.052 * (0.78 + x.temp / 100 * 0.54) * (0.62 + x.ag / 100 * 0.75) * grainFactors[x.grain] * Math.max((tg - dissolved) / Math.max(tg, 1), 0.02);
  dissolved += (tg - dissolved) * k * 2.1;
  if (Math.abs(tg - dissolved) < 0.03) dissolved = tg;
  simT += 0.11;
  simHistory.push({ time: simT, dissolved: dissolved, capacity: cap() });
  // Preserve the full curve from 0 s; do not remove the beginning of the graph.
  if (simHistory.length > 1200) simHistory = [simHistory[0], ...simHistory.slice(-1199)];
  if (dissolved >= tg) { clearInterval(timer); running = false; }
  update();
}

function update() {
  updateLabels();
  const x = inputs(), c = cap(), solidNow = Math.max(0, x.salt - dissolved), excess = Math.max(0, x.salt - c);
  const sat = Math.min(dissolved / c * 100, 100);
  const conc = (dissolved / 58.44) / (x.water / 1000);
  const cond = Math.min(dissolved / Math.max(c, 0.001), 1);

  $("timeValue").textContent = fmt(simT) + " s";
  $("capacityValue").textContent = fmt(c) + " g";
  $("dissolvedValue").textContent = fmt(dissolved) + " g";
  $("solidNowValue").textContent = fmt(solidNow) + " g";
  $("excessValue").textContent = fmt(excess) + " g";
  $("saturationValue").textContent = fmt(sat, 0) + " %";
  $("concentrationValue").textContent = fmt(conc, 2) + " mol/L";
  $("conductivityValue").textContent = cond.toFixed(2).replace(".", ",");

  $("dynamicExplanation").textContent = x.salt > c
    ? `Capacidade estimada: ${fmt(c)} g. Excesso no equilíbrio: ${fmt(excess)} g.`
    : "Condição abaixo do limite: a massa final dissolvida é limitada pela quantidade adicionada.";

  const level = 52 + ((x.water - 50) / 150) * 34;
  sim.liquid.style.height = level + "%";
  sim.solid.innerHTML = ""; sim.particles.innerHTML = "";

  for (let i = 0; i < Math.min(120, Math.round(solidNow * 1.2)); i++) {
    const e = document.createElement("div");
    e.className = "crystal";
    e.style.left = (28 + Math.random() * 44) + "%";
    e.style.top = (83 + Math.random() * 11) + "%";
    e.style.transform = `rotate(${Math.random() * 90}deg)`;
    sim.solid.appendChild(e);
  }

  const pairs = Math.round((x.salt ? dissolved / x.salt : 0) * 30);
  const top = 100 - level;
  for (let i = 0; i < pairs; i++) {
    for (const cls of ["na", "cl"]) {
      const p = document.createElement("div");
      p.className = "b-ion " + cls;
      p.textContent = cls === "na" ? "+" : "–";
      p.style.left = (20 + Math.random() * 60) + "%";
      p.style.top = (top + 8 + Math.random() * 50) + "%";
      sim.particles.appendChild(p);
    }
  }

  drawKineticsChart();
  drawSolubilityChart();
}

$("startSim").onclick = () => { if (!running) { running = true; timer = setInterval(step, 110); } };
$("pauseSim").onclick = () => { clearInterval(timer); running = false; };
$("resetSim").onclick = () => reset(false);
[sim.salt, sim.water, sim.temp].forEach(e => e.addEventListener("input", () => reset(true)));
sim.grain.addEventListener("change", () => reset(true));
sim.ag.addEventListener("input", update);
update();


/* Dynamic charts */
function setupCanvas(canvas) {
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(320, rect.width || canvas.parentElement?.clientWidth || 760);
  const cssH = Math.max(260, rect.height || 320);
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);

  // Resize only when the real displayed size changes.
  // Resizing the canvas on every simulation tick clears the drawing and causes flicker.
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssW, h: cssH };
}

function drawAxes(ctx, w, h, opts) {
  const left = 58, right = 24, top = 28, bottom = 50;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f8fcff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d9e9f5";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = top + (h - top - bottom) * i / 4;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
  }
  ctx.strokeStyle = "#7db3cd";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, h - bottom); ctx.lineTo(w - right, h - bottom); ctx.stroke();
  ctx.fillStyle = "#5d7288";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(opts.xLabel, (left + w - right) / 2, h - 14);
  ctx.save();
  ctx.translate(17, (top + h - bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(opts.yLabel, 0, 0);
  ctx.restore();
  return { left, right, top, bottom, plotW: w - left - right, plotH: h - top - bottom };
}

function drawKineticsChart() {
  const setup = setupCanvas($("kineticsChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const x = inputs();
  const c = cap();
  if (!simHistory.length || simHistory[0].time !== 0) simHistory.unshift({ time: 0, dissolved: 0, capacity: c });
  if (simHistory[0].capacity === 0) simHistory[0].capacity = c;
  const maxMass = Math.max(x.salt, c, 1);
  const maxTime = Math.max(10, Math.ceil(Math.max(...simHistory.map(p => p.time)) / 5) * 5);
  const a = drawAxes(ctx, w, h, { xLabel: "Tempo de simulação", yLabel: "Massa dissolvida (g)" });
  const px = t => a.left + (t / maxTime) * a.plotW;
  const py = m => a.top + a.plotH - (m / maxMass) * a.plotH;

  ctx.strokeStyle = "rgba(34,91,214,.55)";
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(a.left, py(c)); ctx.lineTo(w - a.right, py(c)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#173f9b"; ctx.font = "12px system-ui"; ctx.textAlign = "right";
  ctx.fillText("capacidade", w - a.right - 6, py(c) - 7);

  ctx.strokeStyle = "#05a6a6";
  ctx.lineWidth = 3;
  ctx.beginPath();
  simHistory.forEach((p, i) => {
    const xx = px(p.time), yy = py(p.dissolved);
    if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  });
  ctx.stroke();

  const last = simHistory[simHistory.length - 1] || { time: 0, dissolved: 0 };
  ctx.fillStyle = "#05a6a6";
  ctx.beginPath(); ctx.arc(px(last.time), py(last.dissolved), 5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#5d7288"; ctx.font = "12px system-ui"; ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const value = maxMass * i / 4;
    ctx.fillText(fmt(value, 0), a.left - 8, py(value) + 4);
  }
  ctx.textAlign = "center";
  for (let i = 0; i <= 4; i++) {
    const value = maxTime * i / 4;
    ctx.fillText(fmt(value, 0) + " s", px(value), h - a.bottom + 22);
  }
  ctx.fillStyle = "#10263d"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "left";
  ctx.fillText("Dissolvido agora: " + fmt(dissolved) + " g", a.left, a.top - 9);
}

function drawSolubilityChart() {
  const setup = setupCanvas($("solubilityChart"));
  if (!setup) return;
  const { ctx, w, h } = setup;
  const x = inputs();
  const a = drawAxes(ctx, w, h, { xLabel: "Temperatura (°C)", yLabel: "Solubilidade (g/100 g H₂O)" });
  const minS = 35, maxS = 40.2;
  const px = t => a.left + (t / 100) * a.plotW;
  const py = s => a.top + a.plotH - ((s - minS) / (maxS - minS)) * a.plotH;

  ctx.strokeStyle = "#225bd6"; ctx.lineWidth = 3; ctx.beginPath();
  for (let t = 0; t <= 100; t += 2) {
    const xx = px(t), yy = py(sol100(t));
    if (t === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  }
  ctx.stroke();

  const currentS = sol100(x.temp);
  ctx.strokeStyle = "rgba(16,38,61,.35)";
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(px(x.temp), a.top); ctx.lineTo(px(x.temp), h - a.bottom); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#225bd6";
  ctx.beginPath(); ctx.arc(px(x.temp), py(currentS), 6, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#10263d"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "left";
  ctx.fillText("Temperatura atual: " + x.temp + " °C", a.left, a.top - 9);

  ctx.fillStyle = "#5d7288"; ctx.font = "12px system-ui"; ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const value = minS + (maxS - minS) * i / 4;
    ctx.fillText(fmt(value, 1), a.left - 8, py(value) + 4);
  }
  ctx.textAlign = "center";
  for (let t = 0; t <= 100; t += 25) {
    ctx.fillText(t + "°", px(t), h - a.bottom + 22);
  }
}

window.addEventListener("resize", () => {
  drawKineticsChart();
  drawSolubilityChart();
});


/* Quiz */
const quiz = [
  ["O que a visualização 3D representa?", ["Uma trajetória MC/MD quantitativa real", "Um modelo didático 3D coerente com a hidratação", "Uma prova de que todo NaCl dissolve", "Um cálculo de potencial químico"], 1],
  ["Na hidratação de Na⁺, que átomo da água aponta para o cátion?", ["H", "O", "Cl", "Na"], 1],
  ["Na hidratação de Cl⁻, que parte da água aponta para o ânion?", ["Oxigênio", "Hidrogênios", "Sódio", "Carbono"], 1],
  ["O critério termodinâmico de solubilidade é:", ["agitação máxima", "μ do sal em solução igual ao μ do sólido", "mais temperatura sempre dissolve tudo", "cor do cristal"], 1],
  ["Agitação aumenta principalmente:", ["a velocidade de dissolução", "a massa máxima em equilíbrio", "o tamanho do íon", "a carga do cloreto"], 0]
];

const answers = Array(quiz.length).fill(null);

function renderQuiz() {
  const q = $("quizContainer");
  q.innerHTML = "";
  quiz.forEach((it, i) => {
    const card = document.createElement("article");
    card.className = "card quiz-card";
    card.innerHTML = `<h3>${i + 1}. ${it[0]}</h3>`;
    const list = document.createElement("div");
    list.className = "option-list";
    it[1].forEach((op, j) => {
      const b = document.createElement("button");
      b.className = "option-btn";
      b.textContent = op;
      b.onclick = () => {
        if (answers[i] !== null) return;
        answers[i] = j === it[2];
        [...list.children].forEach((x, k) => { x.disabled = true; if (k === it[2]) x.classList.add("correct"); });
        if (j !== it[2]) b.classList.add("incorrect");
        const fb = document.createElement("div");
        fb.className = "feedback " + (answers[i] ? "correct" : "incorrect");
        fb.textContent = answers[i] ? "Correto." : "Revise a orientação da água e a diferença entre visualização e cálculo.";
        card.appendChild(fb);
      };
      list.appendChild(b);
    });
    card.appendChild(list);
    q.appendChild(card);
  });
}

$("finishQuiz").onclick = () => {
  const s = answers.filter(Boolean).length;
  $("quizResult").classList.remove("hidden");
  $("quizResult").innerHTML = `<h3>Resultado</h3><p>${s}/${quiz.length}</p>`;
};

renderQuiz();
