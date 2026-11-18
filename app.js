(function () {
  "use strict";

  const drinks = window.COCKTAILS || [];
  const course = window.COCKTAIL_COURSE || [];
  const qs = selector => document.querySelector(selector);
  const qsa = selector => Array.from(document.querySelectorAll(selector));

  const elements = {
    list: qs("#cocktailList"),
    filters: qs("#baseFilters"),
    search: qs("#searchInput"),
    clearSearch: qs("#clearSearch"),
    resultCount: qs("#resultCount"),
    drinkIndex: qs("#drinkIndex"),
    drinkName: qs("#drinkName"),
    drinkEnglish: qs("#drinkEnglish"),
    drinkSummary: qs("#drinkSummary"),
    breadcrumb: qs("#breadcrumb"),
    tagRow: qs("#tagRow"),
    factStrip: qs("#factStrip"),
    formulaPrinciple: qs("#formulaPrinciple"),
    ratioTrack: qs("#ratioTrack"),
    ratioLegend: qs("#ratioLegend"),
    tasteDescription: qs("#tasteDescription"),
    tasteGrid: qs("#tasteGrid"),
    materials: qs("#materialsPanel"),
    steps: qs("#stepsPanel"),
    notes: qs("#notesPanel"),
    favorite: qs("#favoriteButton"),
    random: qs("#randomButton"),
    canvas: qs("#drinkCanvas"),
    stepLabel: qs("#animationStep"),
    timeLabel: qs("#animationTime"),
    scrubber: qs("#animationScrubber"),
    play: qs("#playAnimation"),
    previous: qs("#prevStep"),
    next: qs("#nextStep"),
    restart: qs("#restartAnimation"),
    catalog: qs("#catalogPanel"),
    courseDrawer: qs("#courseDrawer"),
    courseGrid: qs("#courseGrid"),
    tweaks: qs("#tweaks"),
    tweaksToggle: qs("#tweaksToggle"),
    motionToggle: qs("#motionToggle"),
    compactToggle: qs("#compactToggle"),
    toast: qs("#toast")
  };

  const state = {
    selectedId: drinks[0] ? drinks[0].id : null,
    base: "全部",
    query: "",
    progress: 0,
    playing: false,
    lastFrame: 0,
    frame: 0,
    favorites: readStoredSet("cocktail-favorites"),
    reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    mobileView: "drink"
  };

  const ctx = elements.canvas.getContext("2d");

  function currentDrink() {
    return drinks.find(drink => drink.id === state.selectedId) || drinks[0];
  }

  function readStoredSet(key) {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch (error) {
      return new Set();
    }
  }

  function writeStoredSet(key, set) {
    try {
      localStorage.setItem(key, JSON.stringify(Array.from(set)));
    } catch (error) {
      // The guide remains fully usable when storage is unavailable.
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function difficultyLabel(level) {
    return ["入门", "进阶", "挑战"][Math.max(0, level - 1)];
  }

  function methodEnglish(method) {
    const labels = {
      "直调": "BUILD",
      "搅拌": "STIR",
      "摇和": "SHAKE",
      "捣压": "MUDDLE",
      "搅打": "BLEND",
      "分层": "LAYER",
      "滚动混合": "ROLL"
    };
    return labels[method] || method.toUpperCase();
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("show"), 1700);
  }

  function renderFilters() {
    const bases = ["全部", ...new Set(drinks.map(drink => drink.base))];
    elements.filters.innerHTML = bases.map(base => (
      `<button class="filter-button${state.base === base ? " active" : ""}" type="button" data-base="${escapeHtml(base)}">${escapeHtml(base)}</button>`
    )).join("");
  }

  function filteredDrinks() {
    const query = state.query.toLowerCase();
    return drinks.filter(drink => {
      const matchesBase = state.base === "全部" || drink.base === state.base;
      const haystack = [drink.name, drink.english, drink.base, drink.method, drink.family, ...drink.tags].join(" ").toLowerCase();
      return matchesBase && haystack.includes(query);
    });
  }

  function renderList() {
    const filtered = filteredDrinks();
    elements.resultCount.textContent = `${filtered.length} 款配方`;
    if (!filtered.length) {
      elements.list.innerHTML = `<p class="empty-list">没有找到对应配方。试试搜索“酸酒”“摇和”或切换基酒。</p>`;
      return;
    }
    elements.list.innerHTML = filtered.map(drink => {
      const index = drinks.indexOf(drink) + 1;
      return `
        <button class="cocktail-item${drink.id === state.selectedId ? " active" : ""}" type="button" data-id="${drink.id}">
          <span class="number">${String(index).padStart(2, "0")}</span>
          <span><span class="cn">${escapeHtml(drink.name)}</span><span class="en">${escapeHtml(drink.english)}</span></span>
          <i class="dot" aria-hidden="true"></i>
        </button>`;
    }).join("");
  }

  function renderDrink() {
    const drink = currentDrink();
    if (!drink) return;
    const index = drinks.indexOf(drink) + 1;

    elements.drinkIndex.textContent = `NO. ${String(index).padStart(2, "0")} · ${difficultyLabel(drink.difficulty).toUpperCase()}`;
    elements.drinkName.textContent = drink.name;
    elements.drinkEnglish.textContent = drink.english;
    elements.drinkSummary.textContent = drink.summary;
    elements.breadcrumb.textContent = `经典配方 / ${drink.base} / ${drink.method}`;
    document.title = `${drink.name} · 杯中课`;
    elements.tagRow.innerHTML = drink.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

    const facts = [
      ["技法", `${methodEnglish(drink.method)} · ${drink.method}`],
      ["难度", difficultyLabel(drink.difficulty)],
      ["用时", drink.time],
      ["杯型", drink.glass],
      ["强度", drink.strength]
    ];
    elements.factStrip.innerHTML = facts.map(item => `<div class="fact"><span>${item[0]}</span><strong>${escapeHtml(item[1])}</strong></div>`).join("");

    elements.formulaPrinciple.textContent = drink.principle;
    const total = drink.formula.reduce((sum, part) => sum + part[1], 0);
    elements.ratioTrack.innerHTML = drink.formula.map(part => `<i class="ratio-segment" style="flex-basis:${Math.max(4, part[1] / total * 100)}%"></i>`).join("");
    elements.ratioLegend.innerHTML = drink.formula.map(part => `<span>${escapeHtml(part[0])} ${part[1]}${part[0].includes("苦精") || part[0].includes("调味") ? " dash" : " ml"}</span>`).join("");

    elements.tasteDescription.textContent = drink.tasteText;
    elements.tasteGrid.innerHTML = Object.entries(drink.taste).map(([label, value]) => `
      <div class="taste-item"><span>${label}</span><div class="taste-bar"><i style="width:${value * 20}%"></i></div><b>${value}</b></div>
    `).join("");

    renderTutorial(drink);
    updateFavoriteButton();
    renderList();
    resetAnimation();
  }

  function renderTutorial(drink) {
    elements.materials.innerHTML = `
      <div class="tutorial-section">
        <h3>准备材料</h3>
        <ul class="ingredient-list">${drink.ingredients.map(item => `
          <li><span>${escapeHtml(item[0])}<small>${escapeHtml(item[2])}</small></span><b>${escapeHtml(item[1])}</b></li>
        `).join("")}</ul>
      </div>
      <div class="tutorial-section"><h3>需要器具</h3><div class="tool-chips">${drink.tools.map(tool => `<span class="tool-chip">${escapeHtml(tool)}</span>`).join("")}</div></div>
      <div class="tutorial-section"><h3>开始前</h3><p class="prep-copy">${escapeHtml(drink.prep)}</p></div>
      <p class="responsible-note">酒精度为估算值，会随品牌、冰量和操作变化。请适量饮酒；未成年人、孕期人士及驾驶前请勿饮酒。</p>
    `;

    elements.steps.innerHTML = `
      <div class="tutorial-section">
        <h3>逐步制作</h3>
        <div class="step-list">${drink.steps.map((step, index) => `
          <button class="tutorial-step" type="button" data-step="${index}">
            <span class="step-number">${index + 1}</span>
            <span><strong>${escapeHtml(step[0])}</strong><p>${escapeHtml(step[1])}</p></span>
            <time>${step[2]}s</time>
          </button>
        `).join("")}</div>
      </div>
      <div class="tutorial-section"><div class="success-box"><strong>完成标准</strong>${escapeHtml(drink.success)}</div></div>
    `;

    elements.notes.innerHTML = `
      <div class="tutorial-section"><h3>常见错误</h3><ul class="note-list warning">${drink.mistakes.map(item => `<li><b>${escapeHtml(item[0])}</b>${escapeHtml(item[1])}</li>`).join("")}</ul></div>
      <div class="tutorial-section"><h3>替代与调整</h3><ul class="note-list">${drink.substitutions.map(item => `<li><b>${escapeHtml(item[0])}</b>${escapeHtml(item[1])}</li>`).join("")}</ul></div>
    `;
  }

  function renderCourse() {
    elements.courseGrid.innerHTML = course.map(item => `
      <article class="course-card"><b>${item.number}</b><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><code>${escapeHtml(item.formula)}</code></article>
    `).join("");
  }

  function selectDrink(id) {
    if (!drinks.some(drink => drink.id === id)) return;
    state.selectedId = id;
    renderDrink();
    if (window.innerWidth <= 760) {
      elements.catalog.classList.remove("mobile-open");
      showMobileView("drink");
      window.scrollTo({ top: 0, behavior: state.reduceMotion ? "auto" : "smooth" });
    }
  }

  function updateFavoriteButton() {
    const active = state.favorites.has(state.selectedId);
    elements.favorite.textContent = active ? "★" : "☆";
    elements.favorite.classList.toggle("active", active);
    elements.favorite.setAttribute("aria-label", active ? "取消收藏当前配方" : "收藏当前配方");
  }

  function toggleFavorite() {
    if (state.favorites.has(state.selectedId)) {
      state.favorites.delete(state.selectedId);
      showToast("已取消收藏");
    } else {
      state.favorites.add(state.selectedId);
      showToast("已收藏这杯配方");
    }
    writeStoredSet("cocktail-favorites", state.favorites);
    updateFavoriteButton();
  }

  function timeline(drink) {
    const total = drink.steps.reduce((sum, step) => sum + step[2], 0);
    let elapsed = state.progress * total;
    let start = 0;
    let index = 0;
    for (let i = 0; i < drink.steps.length; i += 1) {
      const end = start + drink.steps[i][2];
      if (elapsed <= end || i === drink.steps.length - 1) {
        index = i;
        return { total, elapsed, index, local: Math.min(1, Math.max(0, (elapsed - start) / drink.steps[i][2])), start };
      }
      start = end;
    }
    return { total, elapsed, index, local: 1, start };
  }

  function setProgress(value, pause) {
    state.progress = Math.min(1, Math.max(0, value));
    if (pause) state.playing = false;
    elements.scrubber.value = Math.round(state.progress * 1000);
    updateAnimationUi();
    drawFrame(performance.now());
  }

  function resetAnimation() {
    state.playing = false;
    state.progress = 0;
    state.lastFrame = 0;
    elements.play.textContent = "▶";
    elements.play.setAttribute("aria-label", "播放动画");
    elements.scrubber.value = 0;
    updateAnimationUi();
    drawFrame(performance.now());
  }

  function toggleAnimation() {
    if (state.progress >= 1) state.progress = 0;
    state.playing = !state.playing;
    state.lastFrame = 0;
    elements.play.textContent = state.playing ? "Ⅱ" : "▶";
    elements.play.setAttribute("aria-label", state.playing ? "暂停动画" : "播放动画");
    if (state.playing) state.frame = requestAnimationFrame(animate);
  }

  function animate(timestamp) {
    if (!state.playing) return;
    const drink = currentDrink();
    const info = timeline(drink);
    if (!state.lastFrame) state.lastFrame = timestamp;
    const delta = Math.min(60, timestamp - state.lastFrame) / 1000;
    state.lastFrame = timestamp;
    state.progress += delta / info.total;
    if (state.progress >= 1) {
      state.progress = 1;
      state.playing = false;
      elements.play.textContent = "▶";
      elements.play.setAttribute("aria-label", "重新播放动画");
    }
    elements.scrubber.value = Math.round(state.progress * 1000);
    updateAnimationUi();
    drawFrame(timestamp);
    if (state.playing) state.frame = requestAnimationFrame(animate);
  }

  function updateAnimationUi() {
    const drink = currentDrink();
    const info = timeline(drink);
    const step = drink.steps[info.index];
    elements.stepLabel.textContent = `${info.index + 1}/${drink.steps.length} · ${step[0]}`;
    elements.timeLabel.textContent = `${formatTime(info.elapsed)} / ${formatTime(info.total)}`;
    elements.previous.disabled = info.index === 0 && state.progress === 0;
    elements.next.disabled = state.progress >= 1;
    qsa(".tutorial-step").forEach((item, index) => item.classList.toggle("active", index === info.index));
  }

  function formatTime(seconds) {
    const rounded = Math.max(0, Math.round(seconds));
    return `00:${String(rounded).padStart(2, "0")}`;
  }

  function jumpToStep(index) {
    const drink = currentDrink();
    const safeIndex = Math.min(drink.steps.length - 1, Math.max(0, index));
    const total = drink.steps.reduce((sum, step) => sum + step[2], 0);
    const start = drink.steps.slice(0, safeIndex).reduce((sum, step) => sum + step[2], 0);
    setProgress(start / total, true);
    elements.play.textContent = "▶";
  }

  function drawFrame(timestamp) {
    const drink = currentDrink();
    if (!drink) return;
    const info = timeline(drink);
    const action = drink.steps[info.index][3];
    const motion = state.reduceMotion ? .5 : info.local;
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    drawBackdrop(drink, info.index);
    drawAction(drink, action, motion, timestamp);
    drawAnnotations(drink, info, action);
  }

  function drawBackdrop(drink, stepIndex) {
    const width = elements.canvas.width;
    const height = elements.canvas.height;
    ctx.fillStyle = "#130f0c";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = "rgba(200,154,80,.08)";
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();

    const glow = ctx.createLinearGradient(0, 100, width, 680);
    glow.addColorStop(0, "rgba(174,58,48,.18)");
    glow.addColorStop(.48, "rgba(0,0,0,0)");
    glow.addColorStop(1, "rgba(200,154,80,.08)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#080706";
    ctx.fillRect(0, 700, width, 120);
    ctx.fillStyle = "rgba(238,229,214,.18)";
    ctx.fillRect(0, 699, width, 1);

    ctx.fillStyle = "rgba(238,229,214,.45)";
    ctx.font = "11px Georgia";
    ctx.fillText(`${String(stepIndex + 1).padStart(2, "0")}  ${drink.english.toUpperCase()}`, 28, 40);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(200,154,80,.62)";
    ctx.fillText(methodEnglish(drink.method), width - 28, 40);
    ctx.textAlign = "left";
  }

  function drawAction(drink, action, p, timestamp) {
    const activeShake = ["shake", "dryShake", "roll", "blend", "multiPour"].includes(action);
    const fill = Math.min(.96, .18 + state.progress * 1.22);
    if (!activeShake || action === "multiPour") drawGlass(drink.visual, fill, timestamp);

    switch (action) {
      case "shake":
      case "dryShake": drawShaker(p, timestamp, action === "dryShake"); break;
      case "stir": drawStirrer(p, timestamp); break;
      case "pour":
      case "multiPour":
      case "tomato": drawPour(drink.visual.accent, p, action === "multiPour" ? 3 : 1); break;
      case "top":
      case "bubbles": drawBubbles(p, timestamp); drawPour("#d9d2a7", p, 1); break;
      case "strain": drawStrainer(drink.visual.liquid, p); break;
      case "garnish": drawGarnishMotion(drink.visual.garnish, p); break;
      case "muddle": drawMuddler(p, timestamp); break;
      case "blend": drawBlender(p, timestamp, drink.visual.liquid); break;
      case "roll": drawRoll(p, timestamp, drink.visual.liquid); break;
      case "layer":
      case "sunrise": drawLayer(drink.visual.accent, p); break;
      case "foam":
      case "cream": drawFoam(p); break;
      case "salt": drawSalt(p); break;
      case "coffee": drawCoffee(p); break;
      case "ice": drawIceDrop(p); break;
      case "check": drawCheck(p); break;
      default: drawPulse(p, timestamp);
    }
  }

  function glassPath(type) {
    const path = new Path2D();
    if (["highball", "collins"].includes(type)) {
      path.moveTo(270, 250); path.lineTo(292, 680); path.quadraticCurveTo(360, 698, 428, 680); path.lineTo(450, 250); path.closePath();
    } else if (type === "rocks") {
      path.moveTo(235, 405); path.lineTo(263, 680); path.quadraticCurveTo(360, 701, 457, 680); path.lineTo(485, 405); path.closePath();
    } else if (type === "mug") {
      path.moveTo(255, 330); path.lineTo(278, 680); path.quadraticCurveTo(360, 700, 442, 680); path.lineTo(465, 330); path.closePath();
    } else if (type === "flute") {
      path.moveTo(310, 245); path.quadraticCurveTo(315, 515, 360, 565); path.quadraticCurveTo(405, 515, 410, 245); path.closePath();
    } else if (type === "martini") {
      path.moveTo(205, 300); path.lineTo(360, 540); path.lineTo(515, 300); path.closePath();
    } else if (type === "margarita") {
      path.moveTo(190, 320); path.quadraticCurveTo(245, 405, 315, 430); path.lineTo(360, 540); path.lineTo(405, 430); path.quadraticCurveTo(475, 405, 530, 320); path.closePath();
    } else if (type === "hurricane") {
      path.moveTo(275, 270); path.bezierCurveTo(255, 400, 310, 450, 295, 560); path.quadraticCurveTo(290, 635, 360, 650); path.quadraticCurveTo(430, 635, 425, 560); path.bezierCurveTo(410, 450, 465, 400, 445, 270); path.closePath();
    } else {
      path.moveTo(225, 335); path.quadraticCurveTo(250, 495, 360, 520); path.quadraticCurveTo(470, 495, 495, 335); path.closePath();
    }
    return path;
  }

  function drawGlass(visual, fill, timestamp) {
    const path = glassPath(visual.glass);
    const baseY = visual.glass === "flute" ? 560 : visual.glass === "martini" || visual.glass === "margarita" || visual.glass === "coupe" ? 520 : 690;
    const topY = visual.glass === "highball" || visual.glass === "collins" ? 265 : visual.glass === "rocks" ? 415 : visual.glass === "mug" ? 340 : visual.glass === "hurricane" ? 285 : 320;
    const liquidY = baseY - (baseY - topY) * fill;

    ctx.save();
    ctx.clip(path);
    const liquid = ctx.createLinearGradient(0, liquidY, 0, baseY);
    liquid.addColorStop(0, alphaColor(visual.accent, .82));
    liquid.addColorStop(.35, alphaColor(visual.liquid, .9));
    liquid.addColorStop(1, alphaColor(visual.liquid, 1));
    ctx.fillStyle = liquid;
    ctx.fillRect(180, liquidY, 360, baseY - liquidY + 20);
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.fillRect(210, liquidY, 300, 3);
    if (visual.layer) {
      ctx.fillStyle = alphaColor(visual.accent, .88);
      ctx.fillRect(180, baseY - 82, 360, 100);
    }
    if (visual.foam) {
      ctx.fillStyle = "rgba(245,236,216,.9)";
      ctx.fillRect(180, liquidY - 24, 360, 28);
    }
    if (visual.ice) drawIceInside(liquidY, baseY, timestamp);
    if (visual.bubbles) drawBubblesInside(liquidY, baseY, timestamp);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(238,229,214,.72)";
    ctx.lineWidth = 3;
    ctx.stroke(path);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    ctx.stroke(path);
    if (["coupe", "martini", "margarita", "flute"].includes(visual.glass)) {
      ctx.beginPath(); ctx.moveTo(360, visual.glass === "flute" ? 560 : 520); ctx.lineTo(360, 675); ctx.moveTo(300, 680); ctx.quadraticCurveTo(360, 665, 420, 680); ctx.strokeStyle = "rgba(238,229,214,.65)"; ctx.stroke();
    }
    if (visual.glass === "mug") {
      ctx.beginPath(); ctx.ellipse(488, 480, 70, 112, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.fillStyle = "rgba(187,106,45,.13)"; ctx.fillRect(250, 330, 220, 355);
    }
    if (visual.salt) {
      ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(245,236,216,.9)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(205, 299); ctx.lineTo(360, 299); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    drawStaticGarnish(visual.garnish);
  }

  function drawIceInside(top, bottom, timestamp) {
    const drift = Math.sin(timestamp / 800) * 3;
    const cubes = [[305, bottom - 110, 52, .2], [375, bottom - 145, 58, -.16], [335, bottom - 210, 48, .08]];
    ctx.save();
    cubes.forEach(([x, y, size, rotation]) => {
      if (y < top - 25) return;
      ctx.save(); ctx.translate(x + drift, y); ctx.rotate(rotation); ctx.fillStyle = "rgba(230,239,238,.18)"; ctx.strokeStyle = "rgba(246,250,248,.48)"; ctx.lineWidth = 2; ctx.fillRect(-size / 2, -size / 2, size, size); ctx.strokeRect(-size / 2, -size / 2, size, size); ctx.restore();
    });
    ctx.restore();
  }

  function drawBubblesInside(top, bottom, timestamp) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,245,198,.62)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 15; i += 1) {
      const span = Math.max(30, bottom - top);
      const y = bottom - ((timestamp / 22 + i * 53) % span);
      const x = 310 + (i * 37) % 105;
      ctx.beginPath(); ctx.arc(x, y, 2 + i % 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawStaticGarnish(type) {
    ctx.save();
    if (["orange", "lemon", "lime"].includes(type)) {
      const colors = { orange: "#e79631", lemon: "#eadb62", lime: "#7caf55" };
      ctx.strokeStyle = colors[type]; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(432, 385, 42, -.9, 1.7); ctx.stroke();
    } else if (type === "cherry") {
      ctx.fillStyle = "#a21d25"; ctx.beginPath(); ctx.arc(390, 500, 14, 0, Math.PI * 2); ctx.fill();
    } else if (type === "olive") {
      ctx.fillStyle = "#88945e"; ctx.beginPath(); ctx.ellipse(390, 380, 15, 22, .5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#d7c49b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(330, 310); ctx.lineTo(420, 430); ctx.stroke();
    } else if (type === "mint") {
      ctx.strokeStyle = "#6d9d59"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(390, 390); ctx.lineTo(420, 260); ctx.stroke();
      ctx.fillStyle = "#5e8d4c";
      for (let i = 0; i < 5; i += 1) { ctx.beginPath(); ctx.ellipse(403 + (i % 2) * 25, 270 + i * 22, 18, 10, i % 2 ? -.5 : .5, 0, Math.PI * 2); ctx.fill(); }
    } else if (type === "celery") {
      ctx.strokeStyle = "#7e9e55"; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(392, 500); ctx.lineTo(435, 225); ctx.stroke();
    } else if (type === "pineapple") {
      ctx.fillStyle = "#5f8c4b";
      for (let i = 0; i < 4; i += 1) { ctx.save(); ctx.translate(420, 290); ctx.rotate((i - 1.5) * .28); ctx.fillRect(-7, -78, 14, 85); ctx.restore(); }
    } else if (type === "beans") {
      ctx.fillStyle = "#2f170f";
      [-25, 0, 25].forEach(offset => { ctx.beginPath(); ctx.ellipse(360 + offset, 360, 10, 16, .3, 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.restore();
  }

  function drawShaker(p, timestamp, dry) {
    const shake = state.reduceMotion ? 0 : Math.sin(timestamp / 55) * 28 * Math.sin(Math.PI * p);
    ctx.save(); ctx.translate(360 + shake, 455); ctx.rotate(-.45 + Math.sin(timestamp / 80) * .05); ctx.fillStyle = "#7d756d"; ctx.strokeStyle = "#d9d2c8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-75, -170); ctx.lineTo(75, -170); ctx.lineTo(55, 150); ctx.lineTo(-55, 150); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = dry ? "rgba(238,229,214,.6)" : "rgba(200,154,80,.28)"; ctx.fillRect(-58, 30, 116, 115); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(-38, -130); ctx.lineTo(-28, 110); ctx.stroke(); ctx.restore();
    drawMotionLines(360, 450, Math.sin(Math.PI * p));
  }

  function drawPour(color, p, count) {
    const bottleX = 500 - p * 70;
    ctx.save(); ctx.translate(bottleX, 190); ctx.rotate(.95); ctx.fillStyle = "#28231d"; ctx.strokeStyle = "#a99b89"; ctx.lineWidth = 3; ctx.fillRect(-38, -95, 76, 190); ctx.strokeRect(-38, -95, 76, 190); ctx.fillRect(-20, 95, 40, 65); ctx.restore();
    ctx.strokeStyle = alphaColor(color, .9); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(bottleX - 130, 285); ctx.quadraticCurveTo(430, 330, 400, 455); ctx.stroke();
    if (count > 1) {
      ctx.fillStyle = "rgba(200,154,80,.8)"; ctx.font = "18px Georgia"; ctx.fillText(`× ${count}`, 535, 180);
    }
  }

  function drawStirrer(p, timestamp) {
    const angle = timestamp / 280;
    const x = 360 + Math.sin(angle) * 45;
    ctx.strokeStyle = "#c7bba9"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, 265); ctx.lineTo(360 + Math.sin(angle) * 25, 610); ctx.stroke();
    ctx.strokeStyle = "rgba(200,154,80,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(360, 520, 90, 22, 0, 0, Math.PI * 2 * p); ctx.stroke();
  }

  function drawStrainer(color, p) {
    const tilt = .45 + p * .18;
    ctx.save(); ctx.translate(490, 270); ctx.rotate(tilt); ctx.fillStyle = "#77716b"; ctx.strokeStyle = "#d8d0c7"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-65, -100); ctx.lineTo(65, -100); ctx.lineTo(45, 120); ctx.lineTo(-45, 120); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = alphaColor(color, .9); ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(405, 355); ctx.quadraticCurveTo(355, 420, 355, 500); ctx.stroke();
  }

  function drawGarnishMotion(type, p) {
    const y = 150 + p * 255;
    ctx.save(); ctx.globalAlpha = .85;
    if (["orange", "lemon", "lime"].includes(type)) {
      ctx.strokeStyle = type === "orange" ? "#e79631" : type === "lemon" ? "#eadb62" : "#7caf55"; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(360, y, 38, -.8, 2); ctx.stroke();
    } else {
      ctx.fillStyle = type === "cherry" ? "#a21d25" : "#729252"; ctx.beginPath(); ctx.arc(360, y, 17, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawMuddler(p, timestamp) {
    const y = 250 + Math.abs(Math.sin(timestamp / 240)) * 210 * Math.sin(Math.PI * p);
    ctx.save(); ctx.translate(360, y); ctx.rotate(.08); ctx.fillStyle = "#82542f"; ctx.fillRect(-15, -180, 30, 300); ctx.fillStyle = "#a26b3d"; ctx.beginPath(); ctx.arc(0, -175, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawBlender(p, timestamp, color) {
    const shake = state.reduceMotion ? 0 : Math.sin(timestamp / 45) * 5;
    ctx.save(); ctx.translate(shake, 0); ctx.strokeStyle = "#d1c7bb"; ctx.fillStyle = "rgba(190,205,196,.15)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(265, 230); ctx.lineTo(295, 570); ctx.lineTo(425, 570); ctx.lineTo(455, 230); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = alphaColor(color, .85); ctx.fillRect(290, 380, 140, 185); ctx.fillStyle = "#4a433b"; ctx.fillRect(280, 570, 160, 110); ctx.fillStyle = "#c89a50"; ctx.beginPath(); ctx.arc(360, 625, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawRoll(p, timestamp, color) {
    const offset = Math.sin(timestamp / 500) * 40;
    drawTin(255, 400 - offset, color, .15);
    drawTin(465, 400 + offset, color, -.15);
    ctx.strokeStyle = alphaColor(color, .7); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(300, 340 - offset); ctx.quadraticCurveTo(360, 410, 420, 340 + offset); ctx.stroke();
  }

  function drawTin(x, y, color, rotation) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.fillStyle = "#69635d"; ctx.strokeStyle = "#d8d0c7"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-55, -120); ctx.lineTo(55, -120); ctx.lineTo(42, 120); ctx.lineTo(-42, 120); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = alphaColor(color, .5); ctx.fillRect(-42, 40, 84, 75); ctx.restore();
  }

  function drawLayer(color, p) {
    ctx.fillStyle = alphaColor(color, .7); ctx.fillRect(270, 610 - p * 30, 180, 58 + p * 30); ctx.strokeStyle = alphaColor(color, .95); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(500, 290); ctx.quadraticCurveTo(450, 460, 410, 630); ctx.stroke();
  }

  function drawFoam(p) {
    ctx.fillStyle = `rgba(244,236,220,${.18 + p * .75})`; ctx.beginPath(); ctx.ellipse(360, 400, 120, 24 + p * 14, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawSalt(p) {
    ctx.fillStyle = "rgba(245,239,226,.9)";
    for (let i = 0; i < 24; i += 1) { const angle = i / 24 * Math.PI; ctx.fillRect(208 + Math.cos(angle) * 154, 300 + Math.sin(angle) * 12 + p * 4, 4, 4); }
  }

  function drawCoffee(p) {
    ctx.fillStyle = "#332017"; ctx.fillRect(305, 300, 110, 150); ctx.strokeStyle = "#d7cbc0"; ctx.strokeRect(305, 300, 110, 150); ctx.strokeStyle = `rgba(238,229,214,${p})`; ctx.lineWidth = 4; for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(330 + i * 25, 280); ctx.bezierCurveTo(315 + i * 25, 250, 350 + i * 25, 220, 330 + i * 25, 190); ctx.stroke(); }
  }

  function drawIceDrop(p) {
    ctx.save(); ctx.translate(360, 170 + p * 380); ctx.rotate(p * 2); ctx.fillStyle = "rgba(220,235,235,.22)"; ctx.strokeStyle = "rgba(244,248,245,.7)"; ctx.lineWidth = 3; ctx.fillRect(-38, -38, 76, 76); ctx.strokeRect(-38, -38, 76, 76); ctx.restore();
  }

  function drawCheck(p) {
    ctx.strokeStyle = "#8ca170"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(300, 450); ctx.lineTo(345, 500); ctx.lineTo(435, 385); ctx.stroke(); ctx.lineCap = "butt";
  }

  function drawPulse(p, timestamp) {
    const radius = 45 + Math.sin(timestamp / 300) * 9;
    ctx.strokeStyle = "rgba(200,154,80,.45)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(360, 450, radius + p * 15, 0, Math.PI * 2); ctx.stroke();
  }

  function drawBubbles(p, timestamp) {
    ctx.strokeStyle = "rgba(245,225,160,.62)";
    for (let i = 0; i < 12; i += 1) { const y = 600 - ((timestamp / 14 + i * 43) % 240); const x = 315 + (i * 31) % 105; ctx.beginPath(); ctx.arc(x, y, 3 + i % 4, 0, Math.PI * 2); ctx.stroke(); }
  }

  function drawMotionLines(x, y, intensity) {
    ctx.strokeStyle = `rgba(200,154,80,${.15 + intensity * .35})`; ctx.lineWidth = 3;
    [-1, 1].forEach(side => { for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(x + side * (95 + i * 18), y - 80 + i * 55); ctx.lineTo(x + side * (145 + i * 22), y - 80 + i * 55); ctx.stroke(); } });
  }

  function drawAnnotations(drink, info, action) {
    ctx.fillStyle = "rgba(238,229,214,.5)"; ctx.font = "12px 'Microsoft YaHei', sans-serif"; ctx.fillText(`${String(info.index + 1).padStart(2, "0")} / ${String(drink.steps.length).padStart(2, "0")}`, 28, 775);
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(238,229,214,.72)"; ctx.font = "15px 'Microsoft YaHei', sans-serif"; ctx.fillText(drink.steps[info.index][0], 360, 760);
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(200,154,80,.7)"; ctx.font = "11px Georgia"; ctx.fillText(action.toUpperCase(), 692, 775); ctx.textAlign = "left";
  }

  function alphaColor(hex, alpha) {
    const clean = hex.replace("#", "");
    const value = clean.length === 3 ? clean.split("").map(char => char + char).join("") : clean;
    const number = Number.parseInt(value, 16);
    return `rgba(${number >> 16},${(number >> 8) & 255},${number & 255},${alpha})`;
  }

  function setTab(name) {
    qsa(".recipe-tab").forEach(button => {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    qsa(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `${name}Panel`));
  }

  function openCourse() {
    elements.courseDrawer.classList.add("open");
    elements.courseDrawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeCourse() {
    elements.courseDrawer.classList.remove("open");
    elements.courseDrawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (window.innerWidth <= 760) setMobileNav(state.mobileView);
  }

  function setMobileNav(view) {
    qsa("[data-mobile-view]").forEach(button => button.classList.toggle("active", button.dataset.mobileView === view));
  }

  function showMobileView(view) {
    if (view === "course") {
      setMobileNav("course");
      openCourse();
      return;
    }
    state.mobileView = view;
    document.body.classList.toggle("mobile-view-recipe", view === "recipe");
    elements.catalog.classList.toggle("mobile-open", view === "catalog");
    setMobileNav(view);
    window.scrollTo({ top: 0, behavior: state.reduceMotion ? "auto" : "smooth" });
  }

  function bindEvents() {
    elements.filters.addEventListener("click", event => {
      const button = event.target.closest("[data-base]");
      if (!button) return;
      state.base = button.dataset.base;
      renderFilters();
      renderList();
    });

    elements.list.addEventListener("click", event => {
      const button = event.target.closest("[data-id]");
      if (button) selectDrink(button.dataset.id);
    });

    elements.search.addEventListener("input", () => {
      state.query = elements.search.value.trim();
      elements.search.closest(".search").classList.toggle("has-value", Boolean(state.query));
      renderList();
    });

    elements.clearSearch.addEventListener("click", () => {
      elements.search.value = "";
      state.query = "";
      elements.search.closest(".search").classList.remove("has-value");
      renderList();
      elements.search.focus();
    });

    elements.favorite.addEventListener("click", toggleFavorite);
    elements.random.addEventListener("click", () => {
      const choices = drinks.filter(drink => drink.id !== state.selectedId);
      selectDrink(choices[Math.floor(Math.random() * choices.length)].id);
    });

    qsa(".recipe-tab").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));
    elements.steps.addEventListener("click", event => {
      const button = event.target.closest("[data-step]");
      if (button) jumpToStep(Number(button.dataset.step));
    });

    elements.play.addEventListener("click", toggleAnimation);
    elements.restart.addEventListener("click", () => { resetAnimation(); toggleAnimation(); });
    elements.previous.addEventListener("click", () => jumpToStep(timeline(currentDrink()).index - 1));
    elements.next.addEventListener("click", () => jumpToStep(timeline(currentDrink()).index + 1));
    elements.scrubber.addEventListener("input", () => setProgress(Number(elements.scrubber.value) / 1000, true));

    qs("#openCourse").addEventListener("click", openCourse);
    qsa("[data-close-course]").forEach(button => button.addEventListener("click", closeCourse));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeCourse();
      if (event.key === " " && !["INPUT", "BUTTON"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        toggleAnimation();
      }
    });

    qsa("[data-mobile-view]").forEach(button => button.addEventListener("click", () => {
      const view = button.dataset.mobileView;
      showMobileView(view);
    }));

    qs("#closeRecipeMobile").addEventListener("click", () => showMobileView("drink"));

    elements.tweaksToggle.addEventListener("click", () => {
      elements.tweaks.classList.toggle("open");
      elements.tweaks.querySelector(".tweaks-panel").setAttribute("aria-hidden", String(!elements.tweaks.classList.contains("open")));
    });
    elements.motionToggle.checked = state.reduceMotion;
    elements.motionToggle.addEventListener("change", () => {
      state.reduceMotion = elements.motionToggle.checked;
      document.body.classList.toggle("reduce-motion", state.reduceMotion);
      if (state.reduceMotion && state.playing) toggleAnimation();
      drawFrame(performance.now());
    });
    elements.compactToggle.addEventListener("change", () => document.body.classList.toggle("compact-list", elements.compactToggle.checked));

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state.playing) toggleAnimation();
    });
  }

  function validateData() {
    const invalid = drinks.filter(drink => !drink.steps.length || !drink.ingredients.length || !drink.visual);
    if (invalid.length) console.warn("Incomplete cocktail data:", invalid.map(item => item.id));
  }

  function init() {
    validateData();
    renderFilters();
    renderCourse();
    renderDrink();
    bindEvents();
  }

  init();
}());
