// Interactive Case Study B visualization
// Renders a 9-node graph with step-by-step playback showing error propagation,
// conflict detection, LCA localization, and EIS-based repair.

(function () {
  const state = {
    data: null,
    stepIdx: -1,
    nodes: new Map(),
    edges: [],
    errorActive: false,
    conflictActive: false,
    phase: "construction", // construction | localization | repair
    repairIdx: -1
  };

  const CELL = 80;
  const OFFSET_X = 120;
  const OFFSET_Y = 60;

  function posOf(node, useError) {
    const x = useError && node.errorX !== undefined ? node.errorX : node.x;
    const y = useError && node.errorY !== undefined ? node.errorY : node.y;
    return [OFFSET_X + x * CELL, OFFSET_Y + y * CELL];
  }

  function classifyNode(id) {
    if (!state.nodes.has(id)) return "pending";
    const entry = state.nodes.get(id);
    if (state.conflictActive && (id === "Lab" || id === "Meeting Room")) return "conflict";
    if (entry.downstream && state.errorActive) return "shifted";
    return "added";
  }

  function render() {
    const svg = document.getElementById("case-svg");
    if (!svg) return;
    svg.innerHTML = "";

    // background grid
    for (let gx = 0; gx <= 4; gx++) {
      for (let gy = 0; gy <= 5; gy++) {
        const cx = OFFSET_X + gx * CELL;
        const cy = OFFSET_Y + gy * CELL;
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", 1.5);
        dot.setAttribute("fill", "#d8dee6");
        svg.appendChild(dot);
      }
    }

    // edges
    for (const e of state.edges) {
      const src = state.nodes.get(e.src);
      const dst = state.nodes.get(e.dst);
      if (!src || !dst) continue;
      const [x1, y1] = posOf(src.node, src.shifted);
      const [x2, y2] = posOf(dst.node, dst.shifted);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      let stroke = "#4a6fa5";
      let width = 3;
      if (e.type === "error") { stroke = "#e06c4f"; width = 4; }
      if (e.type === "conflict") { stroke = "#d62828"; width = 4; }
      if (e.highlighted) { stroke = "#f4a261"; width = 5; }
      if (e.repaired) { stroke = "#2a9d8f"; width = 4; }
      line.setAttribute("stroke", stroke);
      line.setAttribute("stroke-width", width);
      line.setAttribute("stroke-linecap", "round");
      svg.appendChild(line);

      // direction label
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", mx);
      label.setAttribute("y", my - 6);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "10");
      label.setAttribute("font-family", "Google Sans, sans-serif");
      label.setAttribute("fill", stroke);
      label.textContent = e.dir;
      svg.appendChild(label);
    }

    // nodes
    for (const [id, entry] of state.nodes.entries()) {
      const [x, y] = posOf(entry.node, entry.shifted);
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 14);
      let fill = "#5b8def";
      let stroke = "#2b5bbf";
      const cls = classifyNode(id);
      if (cls === "shifted") { fill = "#ffd6c2"; stroke = "#c65b3a"; }
      if (cls === "conflict") { fill = "#ffb3b3"; stroke = "#c81e1e"; }
      if (entry.repaired) { fill = "#b7ecd8"; stroke = "#2a9d8f"; }
      circle.setAttribute("fill", fill);
      circle.setAttribute("stroke", stroke);
      circle.setAttribute("stroke-width", 2);
      g.appendChild(circle);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", x);
      label.setAttribute("y", y + 30);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "11");
      label.setAttribute("font-family", "Google Sans, sans-serif");
      label.setAttribute("fill", "#222");
      label.textContent = id;
      g.appendChild(label);

      svg.appendChild(g);
    }

    renderStepInfo();
    renderEisTable();
  }

  function renderStepInfo() {
    const info = document.getElementById("case-step-info");
    if (!info) return;

    if (state.stepIdx < 0) {
      info.innerHTML = `<p class="has-text-grey">Press <b>Next</b> to start the walkthrough.</p>`;
      return;
    }

    if (state.phase === "repair" && state.repairIdx >= 0) {
      const r = state.data.repair[state.repairIdx];
      info.innerHTML = `
        <div class="tag is-medium is-warning">Repair Attempt ${r.attempt} / ${state.data.repair.length}</div>
        <h4 class="title is-5" style="margin-top:0.5em;">${r.edge}</h4>
        <p><b>VC recall_step(${r.recall_step}):</b></p>
        <p class="has-text-grey-dark" style="font-style:italic;">"${r.vc_observation}"</p>
        <p><b>Analysis:</b> ${r.analysis}</p>
        <p><b>Verdict:</b> <span class="tag is-${r.verdict === "ERROR" ? "danger" : "success"}">${r.verdict}</span>
           <b>Action:</b> ${r.action}</p>
      `;
      return;
    }

    const s = state.data.steps[state.stepIdx];
    const cls = s.type === "error" ? "is-danger" : s.type === "conflict" ? "is-danger" : "is-info";
    info.innerHTML = `
      <div class="tag is-medium ${cls}">Step ${s.step}</div>
      <h4 class="title is-5" style="margin-top:0.5em;">${s.action}</h4>
      <p class="has-text-grey-dark" style="font-style:italic;">"${s.observation}"</p>
      <p><b>Edge:</b> ${s.edge.src} <code>${s.edge.dir}</code> ${s.edge.dst}</p>
      <p class="has-text-weight-semibold ${s.type === "error" || s.type === "conflict" ? "has-text-danger" : "has-text-grey-dark"}">${s.note}</p>
    `;
  }

  function renderEisTable() {
    const tbl = document.getElementById("case-eis-table");
    if (!tbl) return;
    if (state.phase === "construction" || !state.data) {
      tbl.innerHTML = `<p class="has-text-grey">LCA and Edge Impact Score appear after the conflict is detected.</p>`;
      return;
    }
    const rows = state.data.lca.candidates.map((c, i) => {
      const highlighted = state.phase === "repair" && state.repairIdx >= 0 && state.repairIdx === i;
      const tried = state.phase === "repair" && state.repairIdx >= 0 && state.repairIdx >= i;
      const bg = highlighted ? "background:#fff3cd;" : tried ? "background:#e8f6f1;" : "";
      const marker = c.is_error ? '<span class="tag is-danger is-light">TRUE ERROR</span>' : "";
      return `<tr style="${bg}">
        <td>${i + 1}</td>
        <td>${c.edge}</td>
        <td>${c.reach}</td>
        <td>${c.r_hat.toFixed(2)}</td>
        <td><b>${c.eis.toFixed(2)}</b></td>
        <td>${marker}</td>
      </tr>`;
    }).join("");
    tbl.innerHTML = `
      <p><b>LCA = ${state.data.lca.root}</b>, ${state.data.lca.candidates.length} candidates from the divergent subpaths (8 → 4 edges, 50% reduction).</p>
      <table class="table is-fullwidth is-striped is-bordered is-narrow">
        <thead><tr><th>Rank</th><th>Edge</th><th>Reach</th><th>R̂</th><th>EIS</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function addNode(id) {
    if (state.nodes.has(id)) return;
    const node = state.data.nodes.find(n => n.id === id);
    if (!node) return;
    state.nodes.set(id, { node, shifted: false, downstream: false, repaired: false });
  }

  function propagateShift(srcId) {
    const entry = state.nodes.get(srcId);
    if (!entry) return;
    entry.shifted = true;
    entry.downstream = true;
    for (const e of state.edges) {
      if (e.src === srcId && !state.nodes.get(e.dst).shifted) {
        propagateShift(e.dst);
      }
    }
  }

  function stepForward() {
    if (state.phase === "repair") {
      if (state.repairIdx < state.data.repair.length - 1) {
        state.repairIdx++;
        if (state.repairIdx === state.data.repair.length - 1) {
          // final repair applied -> un-shift all downstream nodes
          for (const [, entry] of state.nodes.entries()) {
            entry.shifted = false;
            entry.downstream = false;
            entry.repaired = true;
          }
          state.conflictActive = false;
          state.errorActive = false;
        }
        render();
      }
      return;
    }

    if (state.stepIdx >= state.data.steps.length - 1) {
      // move from construction to repair
      state.phase = "repair";
      state.repairIdx = 0;
      render();
      return;
    }

    state.stepIdx++;
    const s = state.data.steps[state.stepIdx];
    addNode(s.edge.src);
    addNode(s.edge.dst);

    if (s.type === "error") {
      state.errorActive = true;
      state.nodes.get(s.edge.dst).shifted = true;
      state.nodes.get(s.edge.dst).downstream = true;
    } else if (s.type === "conflict") {
      state.conflictActive = true;
      state.phase = "localization";
    } else if (state.errorActive && state.nodes.get(s.edge.src).downstream) {
      state.nodes.get(s.edge.dst).shifted = true;
      state.nodes.get(s.edge.dst).downstream = true;
    }

    state.edges.push({
      src: s.edge.src, dst: s.edge.dst, dir: s.edge.dir,
      type: s.type
    });

    render();
  }

  function reset() {
    state.stepIdx = -1;
    state.nodes.clear();
    state.edges = [];
    state.errorActive = false;
    state.conflictActive = false;
    state.phase = "construction";
    state.repairIdx = -1;
    render();
  }

  function jumpToEnd() {
    reset();
    const totalSteps = state.data.steps.length + state.data.repair.length;
    for (let i = 0; i < totalSteps; i++) stepForward();
  }

  async function init() {
    const resp = await fetch("./static/data/case_study_b.json");
    state.data = await resp.json();

    document.getElementById("case-next").addEventListener("click", stepForward);
    document.getElementById("case-reset").addEventListener("click", reset);
    document.getElementById("case-end").addEventListener("click", jumpToEnd);

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
