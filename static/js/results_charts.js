// Results charts using Chart.js (CDN)
// Three charts: method ablation, cross-model performance, algorithmic validation

(function () {
  function waitForChart(cb) {
    if (typeof Chart !== "undefined") cb();
    else setTimeout(() => waitForChart(cb), 50);
  }

  function palette() {
    return {
      primary: "#5b8def",
      secondary: "#2a9d8f",
      warning: "#f4a261",
      danger: "#e76f51",
      neutral: "#a8b3c7"
    };
  }

  function drawAblation() {
    const ctx = document.getElementById("chart-ablation");
    if (!ctx) return;
    const p = palette();
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Edge-Impact\nOnly", "Version Control\nOnly", "VC + EIS\n(Ours)", "Baseline\n(GPT-4o)"],
        datasets: [
          {
            label: "Repair Rate (%)",
            data: [75.21, 63.03, 68.91, 21.85],
            backgroundColor: p.primary,
            borderRadius: 6
          },
          {
            label: "Accuracy (%)",
            data: [44.69, 54.00, 54.88, 5.77],
            backgroundColor: p.secondary,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "Ablation Study on MANGO (238 conflicts)", font: { size: 14 } },
          legend: { position: "top" }
        },
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: "Percentage (%)" } }
        }
      }
    });
  }

  function drawCrossModel() {
    const ctx = document.getElementById("chart-models");
    if (!ctx) return;
    const p = palette();
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["GPT-4o", "GPT-4.1", "GPT-4o-mini", "Claude-Haiku"],
        datasets: [
          {
            label: "Ours (Repair Rate %)",
            data: [68.91, 64.71, 58.40, 44.31],
            backgroundColor: p.primary,
            borderRadius: 6
          },
          {
            label: "Baseline (Repair Rate %)",
            data: [21.85, 23.05, 15.55, 17.15],
            backgroundColor: p.neutral,
            borderRadius: 6
          },
          {
            label: "Ours (Accuracy %)",
            data: [54.88, 56.49, 56.12, 61.76],
            backgroundColor: p.secondary,
            borderRadius: 6
          },
          {
            label: "Baseline (Accuracy %)",
            data: [5.77, 7.32, 5.60, 6.67],
            backgroundColor: p.danger,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "Generalization Across LLM Backbones", font: { size: 14 } },
          legend: { position: "top" }
        },
        scales: {
          y: { beginAtZero: true, max: 80, title: { display: true, text: "Percentage (%)" } }
        }
      }
    });
  }

  function drawRecall() {
    const ctx = document.getElementById("chart-recall");
    if (!ctx) return;
    const p = palette();
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Node Recall", "Edge Recall"],
        datasets: [
          {
            label: "Baseline (Incremental only)",
            data: [85.7, 32.4],
            backgroundColor: p.neutral,
            borderRadius: 6
          },
          {
            label: "MapRepair (Ours)",
            data: [94.3, 88.2],
            backgroundColor: p.secondary,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: {
          title: { display: true, text: "Dream of the Red Chamber (Chapters 16-17)", font: { size: 14 } },
          legend: { position: "top" }
        },
        scales: {
          x: { beginAtZero: true, max: 100, title: { display: true, text: "Recall (%)" } }
        }
      }
    });
  }

  function drawAlgoValidation() {
    const ctx = document.getElementById("chart-algo");
    if (!ctx) return;
    const p = palette();
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Random Traversal", "EIS-Prioritized (Ours)"],
        datasets: [{
          label: "Edge examinations to find critical errors",
          data: [100, 43.5],
          backgroundColor: [p.neutral, p.primary],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "Algorithmic Validation: 56.5% Fewer Examinations (2.3× speedup)", font: { size: 14 } },
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, max: 110, title: { display: true, text: "Relative examinations (%)" } }
        }
      }
    });
  }

  waitForChart(() => {
    drawAblation();
    drawCrossModel();
    drawRecall();
    drawAlgoValidation();
  });
})();
