// Interactive Case Study B visualization
// Renders a 9-node graph with step-by-step playback showing error propagation,
// conflict detection, LCA localization, and EIS-based repair.

(function () {
  const state = {
    data: null,
    stepIdx: -1,
    nodes: new Map(),   // id -> { node, shifted, downstream, repaired }
    edges: [],          // { src, dst, dir, type, highlighted? }
    errorActive: false,
    conflictActive: false,
    phase: "construction", // construction | localization | repair
    repairIdx: -1,
    highlightEdge: null, // { src, dst } currently being inspected by repair
  };

  const CELL = 80;
  const OFFSET_X = 120;
  const OFFSET_Y = 60;
  const CONFLICT_OFFSET = 18;

  function gridPosOf(entry) {
    const node = entry.node;
    const useError = entry.shifted;
    const x = useError && node.errorX !== undefined ? node.errorX : node.x;
    const y = useError && node.errorY !== undefined ? node.errorY : node.y;
    return [x, y];
  }

  function pixelPosOf(gx, gy) {
    return [OFFSET_X + gx * CELL, OFFSET_Y + gy * CELL];
  }

  // Compute pixel positions; when two nodes collide on the same grid cell,
  // offset them so both remain visible (this is how we make the conflict
  // visually apparent at step 20).
  function computeVisualPositions() {
    const visual = new Map();
    const groups = new Map();

    for (const [id, entry] of state.nodes.entries()) {
      const [gx, gy] = gridPosOf(entry);
      const key = `${gx},${gy}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(id);
    }

    for (const [key, ids] of groups.entries()) {
      const [gx, gy] = key.split(",").map(Number);
      const [cx, cy] = pixelPosOf(gx, gy);
      if (ids.length === 1) {
        visual.set(ids[0], [cx, cy]);
      } else {
        // Two (or more) nodes collide: spread them horizontally.
        ids.forEach((id, i) => {
          const offset = (i - (ids.length - 1) / 2) * 2 * CONFLICT_OFFSET;
          visual.set(id, [cx + offset, cy]);
        });
      }
    }
    return visual;
  }

  function classifyNode(id) {
    if (!state.nodes.has(id)) return "pending";
    const entry = state.nodes.get(id);
    if (entry.repaired) return "repaired";
    if (state.conflictActive && (id === "Lab" || id === "Meeting Room")) return "conflict";
    if (entry.downstream && state.errorActive) return "shifted";
    return "added";
  }

  function svgEl(tag, attrs = {}, text) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function render() {
    const svg = document.getElementById("case-svg");
    if (!svg) return;
    svg.innerHTML = "";

    const visual = computeVisualPositions();

    // Background grid dots
    for (let gx = 0; gx <= 4; gx++) {
      for (let gy = 0; gy <= 5; gy++) {
        const [cx, cy] = pixelPosOf(gx, gy);
        svg.appendChild(svgEl("circle",
          { cx, cy, r: 1.5, fill: "#d8dee6" }));
      }
    }

    // Compass
    const compass = svgEl("g", { transform: "translate(430, 430)" });
    compass.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 2, fill: "#888" }));
    const arrows = [
      { d: "N", x: 0, y: -14 }, { d: "S", x: 0, y: 14 },
      { d: "E", x: 14, y: 0 },  { d: "W", x: -14, y: 0 },
    ];
    for (const a of arrows) {
      compass.appendChild(svgEl("line", {
        x1: 0, y1: 0, x2: a.x, y2: a.y,
        stroke: "#888", "stroke-width": 1,
      }));
      compass.appendChild(svgEl("text", {
        x: a.x * 1.5, y: a.y * 1.5 + 3,
        "text-anchor": "middle",
        "font-size": 9, fill: "#666",
      }, a.d));
    }
    svg.appendChild(compass);

    // Collision halo: big dashed red ring at the conflict grid cell.
    if (state.conflictActive) {
      const mr = state.nodes.get("Meeting Room");
      const lab = state.nodes.get("Lab");
      const allRepaired = mr && mr.repaired && lab && lab.repaired;
      if (mr && lab && !allRepaired) {
        const [gx, gy] = gridPosOf(mr);
        const [cx, cy] = pixelPosOf(gx, gy);
        svg.appendChild(svgEl("circle", {
          cx, cy, r: 34,
          fill: "none", stroke: "#d62828",
          "stroke-width": 2, "stroke-dasharray": "5,3",
        }));
        // "Conflict!" label
        svg.appendChild(svgEl("text", {
          x: cx, y: cy + 55,
          "text-anchor": "middle",
          "font-size": 11, "font-weight": "bold",
          fill: "#d62828",
        }, "Position conflict"));
      }
    }

    // Edges
    for (const e of state.edges) {
      if (!visual.has(e.src) || !visual.has(e.dst)) continue;
      const [x1, y1] = visual.get(e.src);
      const [x2, y2] = visual.get(e.dst);

      let stroke = "#4a6fa5";
      let width = 3;
      let dasharray = "";

      if (e.type === "error")    { stroke = "#e06c4f"; width = 4; }
      if (e.type === "conflict") { stroke = "#d62828"; width = 3; dasharray = "6,4"; }
      if (e.type === "repaired") { stroke = "#2a9d8f"; width = 4; }

      const isHighlighted = state.highlightEdge
                         && state.highlightEdge.src === e.src
                         && state.highlightEdge.dst === e.dst;
      if (isHighlighted) {
        // draw a gold halo under the actual line
        svg.appendChild(svgEl("line", {
          x1, y1, x2, y2,
          stroke: "#f4d35e", "stroke-width": 10,
          "stroke-linecap": "round", opacity: 0.65,
        }));
      }

      const attrs = {
        x1, y1, x2, y2,
        stroke, "stroke-width": width, "stroke-linecap": "round",
      };
      if (dasharray) attrs["stroke-dasharray"] = dasharray;
      svg.appendChild(svgEl("line", attrs));

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      svg.appendChild(svgEl("text", {
        x: mx, y: my - 6,
        "text-anchor": "middle",
        "font-size": 10,
        "font-family": "Google Sans, sans-serif",
        fill: stroke,
      }, e.dir));
    }

    // Nodes
    for (const [id, entry] of state.nodes.entries()) {
      if (!visual.has(id)) continue;
      const [x, y] = visual.get(id);
      const cls = classifyNode(id);
      let fill = "#5b8def", stroke = "#2b5bbf";
      if (cls === "shifted")  { fill = "#ffd6c2"; stroke = "#c65b3a"; }
      if (cls === "conflict") { fill = "#ffb3b3"; stroke = "#c81e1e"; }
      if (cls === "repaired") { fill = "#b7ecd8"; stroke = "#2a9d8f"; }

      const g = svgEl("g");
      g.appendChild(svgEl("circle", {
        cx: x, cy: y, r: 14,
        fill, stroke, "stroke-width": 2,
      }));
      g.appendChild(svgEl("text", {
        x, y: y + 28,
        "text-anchor": "middle",
        "font-size": 11,
        "font-family": "Google Sans, sans-serif",
        fill: "#222",
      }, id));
      svg.appendChild(g);
    }

    renderStepInfo();
    renderEisTable();
  }

  function renderStepInfo() {
    const info = document.getElementById("case-step-info");
    if (!info) return;

    if (state.stepIdx < 0) {
      info.innerHTML = `
        <p class="has-text-grey">
          Click <b>Next Step</b> to start walking through the case study.
          A directional error at step 5 will silently propagate for 15 steps
          before a topological conflict is detected at step 20.
        </p>`;
      return;
    }

    if (state.phase === "repair" && state.repairIdx >= 0) {
      const r = state.data.repair[state.repairIdx];
      const verdictClass = r.verdict === "ERROR" ? "is-danger" : "is-success";
      info.innerHTML = `
        <div class="tag is-medium is-warning">Repair Attempt ${r.attempt} / ${state.data.repair.length}</div>
        <h4 class="title is-5" style="margin-top:0.5em;">${r.edge}</h4>
        <p><b>VC recall_step(${r.recall_step}):</b></p>
        <p class="has-text-grey-dark" style="font-style:italic;">"${r.vc_observation}"</p>
        <p style="margin-top:0.4em;"><b>Analysis:</b> ${r.analysis}</p>
        <p style="margin-top:0.4em;">
          <b>Verdict:</b> <span class="tag ${verdictClass}">${r.verdict}</span>
          &nbsp;<b>Action:</b> ${r.action}
        </p>`;
      return;
    }

    const s = state.data.steps[state.stepIdx];
    const tagClass =
        s.type === "error"    ? "is-danger"
      : s.type === "conflict" ? "is-danger"
      : "is-info";
    const noteClass =
        s.type === "error" || s.type === "conflict"
          ? "has-text-danger has-text-weight-semibold"
          : "has-text-grey-dark";
    info.innerHTML = `
      <div class="tag is-medium ${tagClass}">Step ${s.step}</div>
      <h4 class="title is-5" style="margin-top:0.5em;">${s.action}</h4>
      <p class="has-text-grey-dark" style="font-style:italic;">"${s.observation}"</p>
      <p style="margin-top:0.4em;">
        <b>Edge:</b> ${s.edge.src} <code>${s.edge.dir}</code> ${s.edge.dst}
      </p>
      <p class="${noteClass}">${s.note}</p>`;
  }

  function renderEisTable() {
    const tbl = document.getElementById("case-eis-table");
    if (!tbl) return;
    if (state.phase === "construction" || !state.data) {
      tbl.innerHTML = `<p class="has-text-grey">
        LCA candidates and Edge Impact Scores appear after the conflict
        is detected.
      </p>`;
      return;
    }
    const rows = state.data.lca.candidates.map((c, i) => {
      const isCurrent = state.phase === "repair"
                     && state.repairIdx >= 0
                     && state.repairIdx === i;
      const isTried   = state.phase === "repair"
                     && state.repairIdx >= 0
                     && state.repairIdx >= i;
      let bg = "";
      if (isCurrent) bg = "background:#fff3cd;";
      else if (isTried) bg = "background:#e8f6f1;";
      const marker = c.is_error
        ? '<span class="tag is-danger is-light">TRUE ERROR</span>'
        : "";
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
      <p><b>LCA = ${state.data.lca.root}</b>, ${state.data.lca.candidates.length} candidates
      from the divergent subpaths (8&nbsp;&rarr;&nbsp;4 edges, 50% reduction).</p>
      <table class="table is-fullwidth is-striped is-bordered is-narrow">
        <thead><tr>
          <th>Rank</th><th>Edge</th><th>Reach</th>
          <th>R&#770;</th><th>EIS</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function addNode(id) {
    if (state.nodes.has(id)) return;
    const node = state.data.nodes.find(n => n.id === id);
    if (!node) return;
    state.nodes.set(id, { node, shifted: false, downstream: false, repaired: false });
  }

  function applyRepair() {
    // 1. Update the error edge to reflect the new (correct) direction
    //    and all downstream edges/nodes inherit GT positions.
    const last = state.data.repair[state.data.repair.length - 1];
    const apply = last && last.apply;
    for (const e of state.edges) {
      if (apply && e.src === apply.src && e.dst === apply.dst) {
        e.dir = apply.new_dir;
        e.type = "repaired";
      } else if (e.type === "error") {
        e.type = "repaired";
      } else if (e.type === "conflict") {
        // The edge whose addition triggered the conflict is itself correct;
        // restore it to a normal state once the true error is fixed.
        e.type = "add";
      }
    }
    // 2. Un-shift downstream nodes so they return to GT positions.
    for (const [, entry] of state.nodes.entries()) {
      entry.shifted = false;
      entry.downstream = false;
      entry.repaired = true;
    }
    state.conflictActive = false;
    state.errorActive = false;
    state.highlightEdge = null;
  }

  function stepForward() {
    if (state.phase === "repair") {
      if (state.repairIdx < state.data.repair.length - 1) {
        state.repairIdx++;
        const r = state.data.repair[state.repairIdx];
        state.highlightEdge = r.highlight || null;
        if (state.repairIdx === state.data.repair.length - 1) {
          applyRepair();
        }
        render();
      }
      return;
    }

    if (state.stepIdx >= state.data.steps.length - 1) {
      // Transition from construction to repair
      state.phase = "repair";
      state.repairIdx = 0;
      const r = state.data.repair[0];
      state.highlightEdge = r.highlight || null;
      render();
      return;
    }

    state.stepIdx++;
    const s = state.data.steps[state.stepIdx];
    addNode(s.edge.src);
    addNode(s.edge.dst);

    if (s.type === "error") {
      state.errorActive = true;
      const dst = state.nodes.get(s.edge.dst);
      dst.shifted = true;
      dst.downstream = true;
    } else if (s.type === "conflict") {
      state.conflictActive = true;
      state.phase = "localization";
    } else if (state.errorActive && state.nodes.get(s.edge.src).downstream) {
      const dst = state.nodes.get(s.edge.dst);
      dst.shifted = true;
      dst.downstream = true;
    }

    state.edges.push({
      src: s.edge.src, dst: s.edge.dst, dir: s.edge.dir, type: s.type,
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
    state.highlightEdge = null;
    render();
  }

  function jumpToEnd() {
    reset();
    const totalClicks = state.data.steps.length + state.data.repair.length;
    for (let i = 0; i < totalClicks; i++) stepForward();
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
