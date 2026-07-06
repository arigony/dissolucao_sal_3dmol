
const $ = (id) => document.getElementById(id);

const sceneInfo = {
  movie: { title: "Filme: dissociação e hidratação", path: "models/nacl_hydration_movie.xyz", type: "movie", explanation: "<p><strong>Filme:</strong> águas se aproximam da superfície do cristal; Na⁺ e Cl⁻ de superfície se separam e ficam estabilizados por hidratação.</p>" },
  crystal: { title: "Cristal de NaCl", path: "models/nacl_crystal.xyz", type: "single", explanation: "<p><strong>Cristal:</strong> fragmento didático da rede rock-salt de NaCl. Na⁺ é menor/roxo; Cl⁻ é maior/verde.</p>" },
  na: { title: "Na⁺ hidratado", path: "models/na_hydrated.xyz", type: "single", explanation: "<p><strong>Na⁺ hidratado:</strong> o oxigênio da água, região mais rica em densidade eletrônica, aponta para o cátion.</p>" },
  cl: { title: "Cl⁻ hidratado", path: "models/cl_hydrated.xyz", type: "single", explanation: "<p><strong>Cl⁻ hidratado:</strong> os hidrogênios parcialmente positivos da água apontam para o ânion.</p>" },
  final: { title: "Cena final hidratada", path: "models/hydrated_ions_final.xyz", type: "single", explanation: "<p><strong>Cena final:</strong> íons de superfície já separados e hidratados. É uma representação didática do produto microscópico da dissolução.</p>" }
};

let viewer = null;
let currentScene = "movie";
let currentStyle = "hydration";
let labelsOn = false;
let spinning = true;
let moviePlaying = true;

function status(msg) {
  const el = $("viewerStatus");
  if (el) el.textContent = msg;
}

async function fetchText(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Não foi possível carregar ${path}`);
  return await res.text();
}

function applyHydrationStyle() {
  if (!viewer) return;
  viewer.setStyle({}, {});
  viewer.removeAllLabels();

  if (currentStyle === "spacefill") {
    viewer.setStyle({ elem: "Na" }, { sphere: { scale: 0.58, color: "#7c4dff" } });
    viewer.setStyle({ elem: "Cl" }, { sphere: { scale: 0.72, color: "#20a85e" } });
    viewer.setStyle({ elem: "O" }, { sphere: { scale: 0.34, color: "#e84135" } });
    viewer.setStyle({ elem: "H" }, { sphere: { scale: 0.22, color: "#f4f7fb" } });
  } else {
    viewer.setStyle({ elem: "Na" }, { sphere: { scale: 0.58, color: "#7c4dff" } });
    viewer.setStyle({ elem: "Cl" }, { sphere: { scale: 0.72, color: "#20a85e" } });
    viewer.setStyle({ elem: "O" }, {
      sphere: { scale: 0.28, color: "#e84135" },
      stick: { radius: 0.11, color: "#d7e3ef" }
    });
    viewer.setStyle({ elem: "H" }, {
      sphere: { scale: 0.18, color: "#f4f7fb" },
      stick: { radius: 0.11, color: "#d7e3ef" }
    });
  }

  if (labelsOn) {
    const atoms = viewer.selectedAtoms({});
    atoms.forEach((a, idx) => {
      if (a.elem === "Na" || a.elem === "Cl" || (a.elem === "O" && idx % 9 === 0)) {
        const label = a.elem === "Na" ? "Na⁺" : a.elem === "Cl" ? "Cl⁻" : "O";
        viewer.addLabel(label, {
          position: { x: a.x, y: a.y, z: a.z },
          backgroundColor: "rgba(0,0,0,0.38)",
          fontColor: "white",
          fontSize: 12,
          inFront: true
        });
      }
    });
  }

  viewer.spin(spinning);
  viewer.render();
}

function safeResize() {
  if (!viewer) return;
  try {
    viewer.resize();
    viewer.zoomTo();
    viewer.render();
  } catch (e) {
    console.warn("resize skipped", e);
  }
}

async function setScene(scene) {
  if (!viewer || !sceneInfo[scene]) return;
  currentScene = scene;
  const info = sceneInfo[scene];

  $("viewerTitle").textContent = info.title;
  $("sceneExplanation").innerHTML = info.explanation;
  document.querySelectorAll(".scene-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.scene === scene));

  viewer.clear();
  viewer.stopAnimate();

  const data = await fetchText(info.path);

  if (info.type === "movie") {
    viewer.addModelsAsFrames(data, "xyz");
    applyHydrationStyle();
    viewer.zoomTo();
    if (moviePlaying) viewer.animate({ loop: "forward", interval: 260 });
    status(moviePlaying ? "Filme multi-frame em execução." : "Filme carregado e pausado.");
  } else {
    viewer.addModel(data, "xyz");
    applyHydrationStyle();
    viewer.zoomTo();
    status(`Cena carregada: ${info.title}.`);
  }

  setTimeout(() => {
    try { viewer.resize(); viewer.render(); } catch (e) {}
  }, 80);
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

  setScene("movie").catch(err => {
    console.error(err);
    status("Erro ao carregar modelo molecular.");
  });

  setTimeout(safeResize, 150);
  window.addEventListener("resize", () => setTimeout(() => {
    if (viewer) {
      try { viewer.resize(); viewer.render(); } catch (e) {}
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

    if (style === "hydration" || style === "spacefill") {
      currentStyle = style;
      applyHydrationStyle();
    }

    if (style === "labels") {
      labelsOn = !labelsOn;
      applyHydrationStyle();
    }

    if (style === "spin") {
      spinning = !spinning;
      applyHydrationStyle();
    }

    if (style === "play") {
      moviePlaying = !moviePlaying;
      if (currentScene === "movie") {
        if (moviePlaying) {
          viewer.animate({ loop: "forward", interval: 260 });
          status("Filme multi-frame em execução.");
        } else {
          viewer.stopAnimate();
          status("Filme pausado.");
        }
      } else {
        status("Play/pause atua apenas na cena Filme.");
      }
    }

    if (style === "reset" && viewer) {
      viewer.zoomTo();
      viewer.render();
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
