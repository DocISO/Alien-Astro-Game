"use strict";

/**
 * Quest Panel UI – renders interactive mini-quests inside the mission logbook.
 * Each quest type has its own renderer. All renderers call onComplete(correct)
 * when the player finishes so the logbook animation can resume.
 */

const QuestPanel = (() => {

  // ── Public entry point ────────────────────────────────────────────────────────

  function show(entry, containerEl, onComplete) {
    containerEl.innerHTML = "";
    containerEl.style.display = "block";

    const def     = entry.questDef;
    const wrapper = document.createElement("div");
    wrapper.className = "quest-panel";

    const header = document.createElement("div");
    header.className = "quest-header";
    header.innerHTML = `
      <span class="quest-title">${def.title}</span>
      <span class="quest-badge">Mission Quest</span>
    `;
    wrapper.appendChild(header);

    if (def.story) {
      const story = document.createElement("p");
      story.className = "quest-story";
      story.textContent = def.story;
      wrapper.appendChild(story);
    }

    containerEl.appendChild(wrapper);

    const done = (correct) => {
      entry.resolved = true;
      entry.correct  = correct;
      onComplete(correct);
    };

    switch (def.type) {
      case "mcq":          renderMCQ(wrapper, entry, done);          break;
      case "pulsar":       renderPulsar(wrapper, entry, done);       break;
      case "reactor":      renderReactor(wrapper, entry, done);      break;
      case "food_calc":    renderFoodCalc(wrapper, entry, done);     break;
      case "swingby":      renderSwingby(wrapper, entry, done);      break;
      case "data_storage": renderDataStorage(wrapper, entry, done);  break;
      case "government":   renderGovernment(wrapper, entry, done);   break;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function makeBtn(text, cls) {
    const b = document.createElement("button");
    b.className = cls || "quest-btn";
    b.textContent = text;
    return b;
  }

  function showExplanation(parent, correct, text) {
    const el = document.createElement("div");
    el.className = `quest-explanation ${correct ? "quest-exp-correct" : "quest-exp-wrong"}`;
    el.innerHTML = text;
    parent.appendChild(el);
    return el;
  }

  function continueBtn(parent, done, correct) {
    const btn = makeBtn("Weiter →", "quest-continue");
    btn.onclick = () => done(correct);
    parent.appendChild(btn);
  }

  // ── Quest 1: MCQ (Dosimeter) ──────────────────────────────────────────────────

  function renderMCQ(wrapper, entry, done) {
    const def = entry.questDef;

    const q = document.createElement("p");
    q.className = "quest-question";
    q.textContent = def.question;
    wrapper.appendChild(q);

    const opts = document.createElement("div");
    opts.className = "quest-options";

    def.options.forEach(opt => {
      const btn = makeBtn(opt.label);
      btn.onclick = () => {
        opts.querySelectorAll(".quest-btn").forEach(b => b.disabled = true);
        const correct = opt.value === def.correct;
        btn.classList.add(correct ? "quest-btn-correct" : "quest-btn-wrong");
        if (!correct) {
          opts.querySelectorAll(".quest-btn").forEach(b => {
            if (b.textContent === def.options.find(o => o.value === def.correct).label) {
              b.classList.add("quest-btn-correct");
            }
          });
        }
        showExplanation(wrapper, correct, def.explanations[opt.value]);
        continueBtn(wrapper, done, correct);
      };
      opts.appendChild(btn);
    });
    wrapper.appendChild(opts);
  }

  // ── Quest 2: Pulsar Navigation ────────────────────────────────────────────────

  function renderPulsar(wrapper, entry, done) {
    const def      = entry.questDef;
    const N        = def.nStars;
    const NPULSARS = def.nPulsars;
    const W = 370, H = 240;

    // Generate stars
    const stars = Array.from({ length: N }, (_, i) => ({
      x: 12 + Math.random() * (W - 24),
      y: 12 + Math.random() * (H - 24),
      r: 1.2 + Math.random() * 1.8,
      alpha: 0.4 + Math.random() * 0.6,
      isPulsar: i < NPULSARS,
    }));
    // Shuffle so pulsars aren't always at indices 0..N-1
    for (let i = stars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stars[i], stars[j]] = [stars[j], stars[i]];
    }

    // Drift for non-pulsars (applied to OLD map)
    const drift = stars.map(s => ({
      dx: s.isPulsar ? 0 : (Math.random() < 0.5 ? 1 : -1) * (6 + Math.random() * 10),
      dy: s.isPulsar ? 0 : (Math.random() < 0.5 ? 1 : -1) * (6 + Math.random() * 10),
    }));

    const task = document.createElement("p");
    task.className = "quest-task";
    task.textContent = def.task;
    wrapper.appendChild(task);

    const mapsRow = document.createElement("div");
    mapsRow.className = "pulsar-maps";
    mapsRow.innerHTML = `
      <div>
        <div class="pulsar-label">📅 Vor 10 Jahren</div>
        <canvas id="pul-old" width="${W}" height="${H}" class="pulsar-canvas"></canvas>
      </div>
      <div>
        <div class="pulsar-label">🔭 Heute — klicke die unbewegten Sterne!</div>
        <canvas id="pul-new" width="${W}" height="${H}" class="pulsar-canvas"></canvas>
      </div>
    `;
    wrapper.appendChild(mapsRow);

    const statusEl = document.createElement("div");
    statusEl.className = "pulsar-status";
    statusEl.innerHTML = `Gefunden: <span id="pul-found">0</span>/${NPULSARS} &nbsp;|&nbsp; Falsch: <span id="pul-err">0</span>`;
    wrapper.appendChild(statusEl);

    function drawMap(id, shifted) {
      const cvs = document.getElementById(id);
      const ctx = cvs.getContext("2d");
      ctx.fillStyle = "#030312";
      ctx.fillRect(0, 0, W, H);
      stars.forEach((s, i) => {
        const x = shifted ? s.x + drift[i].dx : s.x;
        const y = shifted ? s.y + drift[i].dy : s.y;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,215,255,${s.alpha})`;
        ctx.fill();
      });
    }
    drawMap("pul-old", true);
    drawMap("pul-new", false);

    let found = 0, errors = 0;
    const clicked = new Set();
    const newCvs  = document.getElementById("pul-new");

    newCvs.style.cursor = "crosshair";
    newCvs.onclick = (e) => {
      if (found >= NPULSARS) return;
      const rect = newCvs.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best = -1, bestD = 14;
      stars.forEach((s, i) => {
        if (clicked.has(i)) return;
        const d = Math.hypot(s.x - mx, s.y - my);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best === -1) return;
      clicked.add(best);

      const ctx  = newCvs.getContext("2d");
      const s    = stars[best];
      if (s.isPulsar) {
        found++;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 2;
        ctx.stroke();
        document.getElementById("pul-found").textContent = found;
      } else {
        errors++;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = 2;
        ctx.stroke();
        document.getElementById("pul-err").textContent = errors;
      }

      if (found >= NPULSARS) {
        newCvs.style.cursor = "default";
        const correct = errors <= 2;
        showExplanation(wrapper, correct,
          correct
            ? `✅ Navigation erfolgreich! Pulsare rotieren mit unglaublicher Präzision — manche senden ${(100 + Math.floor(Math.random()*600))} Impulse pro Sekunde. Sie sind die genauesten Uhren im Universum und dienen als kosmisches GPS.`
            : `⚠️ Kalibrierung mit ${errors} Fehlern abgeschlossen. Beim nächsten Mal: Vergleiche beide Karten ruhig Sektor für Sektor — die Pulsare stehen immer exakt gleich.`
        );
        continueBtn(wrapper, done, correct);
      }
    };
  }

  // ── Quest 3: Fusion Reactor Balance ──────────────────────────────────────────

  function renderReactor(wrapper, entry, done) {
    const targets  = entry.reactorTargets;
    let stableTime = 0;
    let stableInterval = null;
    let finished = false;

    const body = document.createElement("div");
    body.className = "reactor-body";
    body.innerHTML = `
      <div class="reactor-viz">
        <canvas id="react-cvs" width="180" height="180"></canvas>
        <div id="react-status" class="reactor-status-label">⚠️ Instabil</div>
      </div>
      <div class="reactor-controls">
        <div class="reactor-row">
          <label>🌡️ Temperatur &nbsp;<span id="rv-t">50</span></label>
          <input type="range" id="rsl-t" class="config-slider" min="0" max="100" value="50">
        </div>
        <div class="reactor-row">
          <label>🧲 Magnetfeld &nbsp;<span id="rv-m">50</span></label>
          <input type="range" id="rsl-m" class="config-slider" min="0" max="100" value="50">
        </div>
        <div class="reactor-row">
          <label>⚗️ Brennstoff &nbsp;<span id="rv-f">50</span></label>
          <input type="range" id="rsl-f" class="config-slider" min="0" max="100" value="50">
        </div>
        <div id="react-hint" class="reactor-hint"></div>
        <div id="react-stable-bar" class="reactor-stable-bar" style="display:none">
          <div id="react-stable-fill" class="reactor-stable-fill"></div>
        </div>
      </div>
    `;
    wrapper.appendChild(body);

    // Timeout give-up button after 90 s
    let giveUpTimer = setTimeout(() => {
      if (finished) return;
      const btn = makeBtn("⚠️ Notabschaltung (Treibstoff −8%)", "quest-btn quest-btn-warn");
      btn.onclick = () => { finished = true; done(false); };
      wrapper.appendChild(btn);
    }, 90000);

    function drawReactor(t, m, f, stable) {
      const cvs = document.getElementById("react-cvs");
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      const cx = 90, cy = 90;
      ctx.clearRect(0, 0, 180, 180);
      ctx.fillStyle = "#07071a";
      ctx.fillRect(0, 0, 180, 180);

      // Magnetic coils (rings)
      for (let r = 55; r <= 80; r += 8) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80,130,255,${0.15 + m / 250})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Plasma core
      const pSize = 18 + f * 0.28;
      const hue   = stable ? 170 : 20 + t * 0.8;
      const grad  = ctx.createRadialGradient(cx, cy, 0, cx, cy, pSize);
      grad.addColorStop(0, `hsla(${hue},100%,75%,1)`);
      grad.addColorStop(0.5, `hsla(${hue},100%,55%,0.7)`);
      grad.addColorStop(1, `hsla(${hue},100%,40%,0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, pSize, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Stability ring
      if (stable) {
        ctx.beginPath();
        ctx.arc(cx, cy, 45, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,255,140,0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    function check() {
      const t  = parseInt(document.getElementById("rsl-t").value);
      const m  = parseInt(document.getElementById("rsl-m").value);
      const f  = parseInt(document.getElementById("rsl-f").value);
      document.getElementById("rv-t").textContent = t;
      document.getElementById("rv-m").textContent = m;
      document.getElementById("rv-f").textContent = f;

      const tOk = t >= targets.temp[0] && t <= targets.temp[1];
      const mOk = m >= targets.mag[0]  && m <= targets.mag[1];
      const fOk = f >= targets.fuel[0] && f <= targets.fuel[1];
      const stable = tOk && mOk && fOk;

      drawReactor(t, m, f, stable);

      const statusEl = document.getElementById("react-status");
      const hintEl   = document.getElementById("react-hint");
      const barWrap  = document.getElementById("react-stable-bar");
      const barFill  = document.getElementById("react-stable-fill");

      if (stable) {
        statusEl.textContent  = "✅ STABIL — Fusion läuft!";
        statusEl.style.color  = "var(--success)";
        barWrap.style.display = "block";
        hintEl.textContent    = "Halte die Balance für 3 Sekunden …";
        if (!stableInterval) {
          stableTime = 0;
          stableInterval = setInterval(() => {
            stableTime += 100;
            barFill.style.width = (stableTime / 3000 * 100) + "%";
            if (stableTime >= 3000) {
              clearInterval(stableInterval);
              clearTimeout(giveUpTimer);
              finished = true;
              showExplanation(wrapper, true,
                "✅ Perfekt! Ein Fusionsreaktor braucht genug Hitze (≥ 100 Mio. °C), ein starkes Magnetfeld das Plasma einzuschließen (Tokamak-Prinzip), und exakt die richtige Brennstoffmenge — zu viel und er wird unkontrollierbar!"
              );
              continueBtn(wrapper, done, true);
            }
          }, 100);
        }
      } else {
        statusEl.textContent  = "⚠️ INSTABIL";
        statusEl.style.color  = "var(--danger)";
        barWrap.style.display = "none";
        if (stableInterval) { clearInterval(stableInterval); stableInterval = null; }
        const hints = [];
        if (!tOk) hints.push(t < targets.temp[0] ? "Temperatur zu niedrig" : "Temperatur zu hoch");
        if (!mOk) hints.push(m < targets.mag[0]  ? "Magnetfeld zu schwach"  : "Magnetfeld zu stark");
        if (!fOk) hints.push(f < targets.fuel[0] ? "Brennstoff zu wenig"    : "Brennstoff zu viel");
        hintEl.textContent = hints.join("  ·  ");
      }
    }

    ["rsl-t", "rsl-m", "rsl-f"].forEach(id =>
      document.getElementById(id).addEventListener("input", check)
    );
    check();
  }

  // ── Quest 4: Food Calculation ─────────────────────────────────────────────────

  function renderFoodCalc(wrapper, entry, done) {
    const d = entry.foodCalc;

    const prob = document.createElement("div");
    prob.className = "calc-problem";
    prob.innerHTML = `
      <p>Eure Crew besteht aktuell aus <strong>${d.initialCrew} Personen</strong>.</p>
      <p>Jede Person braucht <strong>${d.kgPerPerson} kg Kartoffeln</strong> pro Jahr.</p>
      <p>Jedes Jahr werden <strong>${d.births} Kinder</strong> geboren und <strong>${d.deaths} Mensch</strong> stirbt.</p>
      <p class="calc-question">❓ Wie viele Tonnen Kartoffeln braucht ihr in <strong>Jahr 5</strong>?</p>
      <p class="calc-hint">Tipp: Berechne zuerst, wie viele Menschen dann an Bord sind. (1&nbsp;Tonne&nbsp;=&nbsp;1000&nbsp;kg)</p>
    `;
    wrapper.appendChild(prob);

    const row = document.createElement("div");
    row.className = "calc-input-row";
    const input = document.createElement("input");
    input.type        = "number";
    input.id          = "calc-inp";
    input.className   = "calc-input";
    input.placeholder = "Deine Antwort in Tonnen";
    input.min = 0; input.max = 99999;
    const btn = makeBtn("Prüfen ✓");
    row.appendChild(input);
    row.appendChild(btn);
    wrapper.appendChild(row);

    const resultEl = document.createElement("div");
    wrapper.appendChild(resultEl);

    const submit = () => {
      const val     = parseInt(input.value, 10);
      const correct = !isNaN(val) && Math.abs(val - d.answerTons) <= 1;
      btn.disabled  = true;
      input.disabled = true;

      showExplanation(resultEl, correct,
        correct
          ? `✅ Richtig! Jahr 5: ${d.finalPop} Personen × ${d.kgPerPerson} kg ÷ 1000 = <strong>${d.answerTons} t</strong>`
          : `❌ Nicht ganz. In Jahr 5 seid ihr ${d.finalPop} Personen (${d.initialCrew} + ${d.births - d.deaths}×5). Das ergibt ${d.finalPop} × ${d.kgPerPerson} = <strong>${d.answerTons} t</strong>.`
      );
      continueBtn(wrapper, done, correct);
    };
    btn.onclick = submit;
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  }

  // ── Quest 5: Swing-by Manöver ─────────────────────────────────────────────────

  function renderSwingby(wrapper, entry, done) {
    const W = 400, H = 300;
    const CX = W / 2, CY = H / 2;
    const STAR_R    = 18;
    const ORBIT_R   = 95;
    const SAFE_MIN  = STAR_R + 14;  // min approach: 32 px
    const SAFE_MAX  = 85;           // max approach: 85 px
    const planetAng = 2.2;          // fixed planet position

    const hint = document.createElement("p");
    hint.className = "quest-task";
    hint.textContent = "Ziehe den Schieberegler, um den Einflugskorridor zu wählen. Starte dann!";
    wrapper.appendChild(hint);

    const cvs = document.createElement("canvas");
    cvs.width  = W;
    cvs.height = H;
    cvs.id = "swingby-cvs";
    cvs.className = "swingby-canvas";
    wrapper.appendChild(cvs);

    const ctrl = document.createElement("div");
    ctrl.className = "swingby-ctrl";
    ctrl.innerHTML = `
      <span class="swingby-lbl">Nah ☠️</span>
      <input type="range" id="swingby-sl" class="config-slider" min="0" max="100" value="50">
      <span class="swingby-lbl">Weit ❄️</span>
    `;
    wrapper.appendChild(ctrl);

    const statusEl = document.createElement("div");
    statusEl.id = "swingby-st";
    statusEl.className = "swingby-status";
    wrapper.appendChild(statusEl);

    const launchBtn = makeBtn("🚀 Einfliegen!", "quest-btn quest-btn-launch");
    wrapper.appendChild(launchBtn);

    function approachDist(sliderVal) {
      return SAFE_MIN - 4 + sliderVal * 0.78;  // ~28–102 px
    }

    // Background star positions (deterministic)
    const bgStars = Array.from({ length: 60 }, (_, i) => ({
      x: (i * 97 + 13) % W,
      y: (i * 71 + 7) % H,
    }));

    function drawScene(sliderVal, path) {
      const ctx = cvs.getContext("2d");
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#030312";
      ctx.fillRect(0, 0, W, H);

      // Background stars
      ctx.fillStyle = "rgba(200,215,255,0.35)";
      bgStars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      });

      // Planet orbit
      ctx.beginPath();
      ctx.arc(CX, CY, ORBIT_R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(80,180,80,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Star
      const sg = ctx.createRadialGradient(CX, CY, 0, CX, CY, STAR_R * 1.8);
      sg.addColorStop(0, "#fff8d0");
      sg.addColorStop(0.4, "#ffcc44");
      sg.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(CX, CY, STAR_R * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CX, CY, STAR_R, 0, Math.PI * 2);
      ctx.fillStyle = "#fff8d0";
      ctx.fill();

      // Planet
      const px = CX + Math.cos(planetAng) * ORBIT_R;
      const py = CY + Math.sin(planetAng) * ORBIT_R;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#4488ff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(150,200,255,0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Approach corridor indicator
      const ad = approachDist(sliderVal);
      const safeColor = ad < SAFE_MIN ? "rgba(255,60,60,0.55)"
                      : ad > SAFE_MAX ? "rgba(255,180,0,0.55)"
                      : "rgba(80,255,150,0.55)";
      ctx.beginPath();
      ctx.arc(CX, CY, ad, 0, Math.PI * 2);
      ctx.strokeStyle = safeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ship origin
      ctx.beginPath();
      ctx.arc(22, 22, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.fillStyle = "#aaaacc";
      ctx.font = "10px monospace";
      ctx.fillText("Schiff", 30, 26);

      // Animated path
      if (path && path.length > 1) {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.strokeStyle = "#00ccff";
        ctx.lineWidth = 2;
        ctx.stroke();
        const last = path[path.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#00ccff";
        ctx.fill();
      }
    }

    function computePath(sliderVal) {
      const ad = approachDist(sliderVal);
      const pts = [];
      // Entry from top-left toward a point offset from star center
      const entX = 22, entY = 22;
      const toStarDX = CX - entX, toStarDY = CY - entY;
      const len = Math.hypot(toStarDX, toStarDY);
      const ux = toStarDX / len, uy = toStarDY / len;
      const perpX = -uy, perpY = ux;
      const aimX = CX + perpX * ad;
      const aimY = CY + perpY * ad;

      // Straight approach
      for (let i = 0; i <= 40; i++) {
        pts.push({ x: entX + (aimX - entX) * i / 40, y: entY + (aimY - entY) * i / 40 });
      }

      if (ad < SAFE_MIN) {
        // Crash: straight into star
        for (let i = 1; i <= 20; i++)
          pts.push({ x: aimX + (CX - aimX) * i / 20, y: aimY + (CY - aimY) * i / 20 });
        return pts;
      }

      // Hyperbolic curve around star
      const periAng   = Math.atan2(aimY - CY, aimX - CX);
      const sweepAng  = ad < 60 ? Math.PI * 1.5 : Math.PI * 0.9;
      for (let i = 1; i <= 55; i++) {
        const ang = periAng + sweepAng * i / 55;
        pts.push({ x: CX + Math.cos(ang) * ad, y: CY + Math.sin(ang) * ad });
      }

      if (ad <= SAFE_MAX) {
        // Exit toward planet
        const exitAng = periAng + sweepAng;
        const exX = CX + Math.cos(exitAng) * ad;
        const exY = CY + Math.sin(exitAng) * ad;
        const plX = CX + Math.cos(planetAng) * ORBIT_R;
        const plY = CY + Math.sin(planetAng) * ORBIT_R;
        for (let i = 1; i <= 40; i++)
          pts.push({ x: exX + (plX - exX) * i / 40, y: exY + (plY - exY) * i / 40 });
      }
      return pts;
    }

    let sliderVal = 50;
    drawScene(sliderVal, null);
    statusEl.textContent = "Wähle deinen Einflugskorridor.";

    document.getElementById("swingby-sl").oninput = (e) => {
      sliderVal = parseInt(e.target.value);
      drawScene(sliderVal, null);
      const ad = approachDist(sliderVal);
      statusEl.textContent = ad < SAFE_MIN ? "⚠️ Zu nah — Absturzgefahr!"
                           : ad > SAFE_MAX ? "⚠️ Zu weit — kaum Bremseffekt."
                           : "✅ Guter Korridor — Swing-by möglich!";
    };

    launchBtn.onclick = () => {
      launchBtn.disabled = true;
      document.getElementById("swingby-sl").disabled = true;
      const ad      = approachDist(sliderVal);
      const correct = ad >= SAFE_MIN && ad <= SAFE_MAX;
      const path    = computePath(sliderVal);
      let   step    = 0;

      const anim = setInterval(() => {
        step = Math.min(step + 4, path.length);
        drawScene(sliderVal, path.slice(0, step));
        if (step >= path.length) {
          clearInterval(anim);
          showExplanation(wrapper, correct,
            correct
              ? "✅ Perfekter Swing-by! Die Schwerkraft des Sterns hat euch abgebremst und auf Kurs gebracht — ohne zusätzlichen Treibstoff. Genau so nutzte die Sonde Voyager die Planeten unseres Sonnensystems!"
              : ad < SAFE_MIN
              ? "💥 Zu nah! Das Schiff ist in den Stern geflogen. Der Swing-by erfordert einen sicheren Mindestabstand — der Stern darf das Schiff nicht einfangen."
              : "❌ Zu weit! Die Schwerkraft war zu schwach zum Abbremsen. Wir schießen am System vorbei und müssen Notbremstriebwerke zünden — das kostet Treibstoff."
          );
          continueBtn(wrapper, done, correct);
        }
      }, 25);
    };
  }

  // ── Quest 6: Data Storage Allocation ─────────────────────────────────────────

  function renderDataStorage(wrapper, entry, done) {
    const def   = entry.questDef;
    const TOTAL = 100;
    let   used  = 0;

    const grid = document.createElement("div");
    grid.className = "alloc-grid";

    def.categories.forEach(cat => {
      const initVal = Math.floor(TOTAL / def.categories.length);
      const row = document.createElement("div");
      row.className = "alloc-row";
      row.innerHTML = `
        <span class="alloc-label">${cat.label}</span>
        <input type="range" class="config-slider alloc-slider" id="alloc-${cat.id}"
               min="0" max="70" value="${initVal}" data-id="${cat.id}">
        <span class="alloc-val" id="alloc-v-${cat.id}">${initVal}</span>
      `;
      grid.appendChild(row);
    });
    wrapper.appendChild(grid);

    const remEl = document.createElement("div");
    remEl.className = "alloc-remaining";
    remEl.innerHTML = `Verbleibend: <strong id="alloc-rem">0</strong> / ${TOTAL}`;
    wrapper.appendChild(remEl);

    const warnEl = document.createElement("div");
    warnEl.className = "alloc-warn";
    wrapper.appendChild(warnEl);

    const confBtn = makeBtn("Bestätigen");
    wrapper.appendChild(confBtn);

    function update() {
      used = def.categories.reduce((sum, cat) =>
        sum + parseInt(document.getElementById(`alloc-${cat.id}`).value), 0
      );
      const rem = TOTAL - used;
      document.getElementById("alloc-rem").textContent = rem;
      remEl.style.color = rem !== 0 ? "var(--danger)" : "var(--success)";
      confBtn.disabled  = rem !== 0;
      // Live warnings
      const issues = def.categories.filter(cat =>
        parseInt(document.getElementById(`alloc-${cat.id}`).value) < cat.min
      );
      warnEl.innerHTML = issues.map(c =>
        `<div class="alloc-issue">⚠️ ${c.label}: zu wenig — ${c.warn}</div>`
      ).join("");
    }

    document.querySelectorAll(".alloc-slider").forEach(sl => {
      sl.addEventListener("input", () => {
        const id = sl.dataset.id;
        document.getElementById(`alloc-v-${id}`).textContent = sl.value;
        update();
      });
    });
    update();

    confBtn.onclick = () => {
      const allocs  = {};
      def.categories.forEach(cat =>
        allocs[cat.id] = parseInt(document.getElementById(`alloc-${cat.id}`).value)
      );
      entry.questResult = allocs;
      const issues  = def.categories.filter(cat => allocs[cat.id] < cat.min);
      const correct = issues.length === 0;

      confBtn.disabled = true;
      document.querySelectorAll(".alloc-slider").forEach(sl => sl.disabled = true);

      if (correct) {
        showExplanation(wrapper, true,
          "✅ Gute Balance! Die Crew hat Zugang zu Medizin, Ernährungswissen, Technik und Kultur. Dieses Wissen wird über Generationen weitergegeben."
        );
      } else {
        const msgs = issues.map(c => `<li>${c.warn}</li>`).join("");
        showExplanation(wrapper, false,
          `⚠️ Einige Bereiche wurden vernachlässigt:<ul>${msgs}</ul>Die Auswirkungen werden die nächste Generation spüren.`
        );
      }
      continueBtn(wrapper, done, correct);
    };
  }

  // ── Quest 7: Government Choice ────────────────────────────────────────────────

  function renderGovernment(wrapper, entry, done) {
    const def    = entry.questDef;
    const tYears = entry._travelYears;  // injected by travelPlanner

    const cards = document.createElement("div");
    cards.className = "gov-cards";

    def.options.forEach(opt => {
      const card = document.createElement("div");
      card.className = "gov-card";
      card.innerHTML = `
        <div class="gov-icon">${opt.label.slice(0, 2)}</div>
        <div class="gov-name">${opt.label.slice(3)}</div>
        <div class="gov-desc">${opt.desc}</div>
      `;
      card.onclick = () => {
        entry.questResult = opt.value;
        cards.querySelectorAll(".gov-card").forEach(c => {
          c.classList.remove("gov-selected");
          c.onclick = null;
        });
        card.classList.add("gov-selected");

        showExplanation(wrapper, true,
          `ℹ️ ${opt.consequence} <em>Die Auswirkungen werdet ihr in einigen Jahren erleben …</em>`
        );
        continueBtn(wrapper, done, true);
      };
      cards.appendChild(card);
    });
    wrapper.appendChild(cards);
  }

  return { show };
})();
