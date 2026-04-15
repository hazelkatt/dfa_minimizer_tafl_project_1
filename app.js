var COLORS = ["#e8646a","#38b2ac","#ed8936","#9f7aea","#48bb78","#ed64a6","#4299e1","#ecc94b","#fc8181","#63b3ed"];

var PRESETS = {
  ex1: { name: "Classic 5-State", states: "A,B,C,D,E", alphabet: "0,1", start: "A", final: "C,E",
    trans: "A,0,B\nA,1,C\nB,0,D\nB,1,E\nC,0,B\nC,1,C\nD,0,D\nD,1,E\nE,0,B\nE,1,C" },
  ex2: { name: "Simple 3-State", states: "q0,q1,q2", alphabet: "a,b", start: "q0", final: "q2",
    trans: "q0,a,q1\nq0,b,q0\nq1,a,q2\nq1,b,q0\nq2,a,q2\nq2,b,q2" },
  ex3: { name: "Unreachable States", states: "S0,S1,S2,S3,S4", alphabet: "0,1", start: "S0", final: "S2,S4",
    trans: "S0,0,S1\nS0,1,S2\nS1,0,S2\nS1,1,S0\nS2,0,S2\nS2,1,S2\nS3,0,S4\nS3,1,S0\nS4,0,S4\nS4,1,S4" }
};

var THEORY = [
  { tag: "Foundation", title: "State Equivalence", color: "#e8646a",
    text: "Two states are considered equivalent if, for every possible input, they lead to the same outcome — either both accept or both reject. Since their behavior is indistinguishable, these states can be safely merged into one. This forms the foundation of reducing redundancy in automata." },
  { tag: "Process", title: "Partition Refinement", color: "#9f7aea",
    text: "The process works by grouping states into partitions based on their behavior. Initially, states are separated into accepting and non-accepting categories. These groups are then repeatedly refined by analyzing how each state transitions under different inputs. If two states respond differently, they are separated; if not, they remain grouped." },
  { tag: "Cleanup", title: "Unreachable State Removal", color: "#38b2ac",
    text: "Another important aspect is the removal of unreachable states — those that are never encountered during execution from the start state. Since they have no impact on the accepted language, eliminating them further simplifies the automaton before the main minimization begins." },
  { tag: "Result", title: "The Minimal DFA", color: "#4299e1",
    text: "The end result is a minimal DFA, which is both efficient and unique (up to renaming of states). It represents the exact same language as the original DFA, but with the fewest states required. No further reduction is possible without changing the language recognized." }
];

var THEORY_COLORS_NEXT = ["#9f7aea", "#38b2ac", "#4299e1", "#e8646a"];

var currentResult = null;
var currentStep = 0;
var currentTheoryIdx = 0;

var inputStates = document.getElementById("input-states");
var inputAlpha = document.getElementById("input-alphabet");
var inputStart = document.getElementById("input-start");
var inputFinal = document.getElementById("input-final");
var inputTrans = document.getElementById("input-transitions");
var errorBox = document.getElementById("error-box");

function selectTheory(idx) {
  currentTheoryIdx = idx;
  var tabs = document.querySelectorAll(".theory-tab");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle("active", i === idx);
    if (i === idx) {
      tabs[i].style.background = "linear-gradient(135deg, " + THEORY[i].color + ", " + THEORY_COLORS_NEXT[i] + ")";
    } else {
      tabs[i].style.background = "";
    }
  }
  var dots = document.querySelectorAll(".theory-dot");
  for (var i = 0; i < dots.length; i++) {
    dots[i].classList.toggle("active", i === idx);
    if (i === idx) {
      dots[i].style.background = "linear-gradient(90deg, " + THEORY[i].color + ", " + THEORY_COLORS_NEXT[i] + ")";
    } else {
      dots[i].style.background = "";
    }
  }
  var el = document.getElementById("theory-content");
  el.innerHTML =
    '<div class="theory-content-tag" style="color:' + THEORY[idx].color + '">' + THEORY[idx].tag + '</div>' +
    '<h3>' + THEORY[idx].title + '</h3>' +
    '<p>' + THEORY[idx].text + '</p>';
}

window.addEventListener("load", function () {
  selectTheory(0);
  loadPreset("ex1");
});

function switchTab(name) {
  if ((name === "steps" || name === "result") && !currentResult) return;
  var btns = document.querySelectorAll(".nav-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.remove("active");
    if (btns[i].getAttribute("data-tab") === name) btns[i].classList.add("active");
  }
  var panels = document.querySelectorAll(".tab-panel");
  for (var i = 0; i < panels.length; i++) {
    panels[i].classList.remove("visible");
    panels[i].style.display = "none";
  }
  var target = document.getElementById("panel-" + name);
  target.style.display = "block";
  target.classList.add("visible");

  if (name === "input") renderPreview();
  if (name === "steps") renderSteps();
  if (name === "result") renderResult();
}

document.querySelectorAll(".nav-btn").forEach(function (btn) {
  btn.addEventListener("click", function () { switchTab(this.getAttribute("data-tab")); });
});

function loadPreset(key) {
  var p = PRESETS[key];
  inputStates.value = p.states; inputAlpha.value = p.alphabet;
  inputStart.value = p.start; inputFinal.value = p.final;
  inputTrans.value = p.trans;
  currentResult = null; currentStep = 0;
  hideError(); updateNavState(); switchTab("input");
}

function parseInputs() {
  var s = inputStates.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  var a = inputAlpha.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  var t = {};
  inputTrans.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).forEach(function (l) {
    var p = l.split(",").map(function (x) { return x.trim(); });
    if (p.length === 3) t[p[0] + "," + p[1]] = p[2];
  });
  return { states: s, alphabet: a, start: inputStart.value.trim(), finals: inputFinal.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), transitions: t };
}

function handleMinimize() {
  hideError();
  try {
    var d = parseInputs();
    if (!d.states.length) throw "Enter at least one state.";
    if (!d.alphabet.length) throw "Enter alphabet symbols.";
    if (d.states.indexOf(d.start) === -1) throw 'Start state "' + d.start + '" not in states.';
    for (var i = 0; i < d.finals.length; i++) if (d.states.indexOf(d.finals[i]) === -1) throw 'Final state "' + d.finals[i] + '" not in states.';
    var lines = inputTrans.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    for (var i = 0; i < lines.length; i++) {
      var p = lines[i].split(",").map(function (x) { return x.trim(); });
      if (p.length !== 3) throw 'Bad transition: "' + lines[i] + '"';
      if (d.states.indexOf(p[0]) === -1) throw 'Unknown state "' + p[0] + '"';
      if (d.alphabet.indexOf(p[1]) === -1) throw 'Unknown symbol "' + p[1] + '"';
      if (d.states.indexOf(p[2]) === -1) throw 'Unknown state "' + p[2] + '"';
    }
    currentResult = minimizeDFA(d.states, d.alphabet, d.transitions, d.start, d.finals);
    currentStep = 0; updateNavState(); switchTab("steps");
  } catch (e) { showError(typeof e === "string" ? e : e.message); }
}

function showError(msg) { errorBox.textContent = msg; errorBox.classList.add("visible"); }
function hideError() { errorBox.classList.remove("visible"); }

function updateNavState() {
  var stepsBtn = document.querySelector('[data-tab="steps"]');
  var resultBtn = document.querySelector('[data-tab="result"]');
  if (currentResult) {
    stepsBtn.classList.remove("disabled"); resultBtn.classList.remove("disabled");
    var badge = stepsBtn.querySelector(".badge");
    if (badge) badge.textContent = currentResult.steps.length;
  } else {
    stepsBtn.classList.add("disabled"); resultBtn.classList.add("disabled");
  }
}

function drawGraph(containerId, states, alphabet, transitions, startState, finalStates, partitions) {
  var container = document.getElementById(containerId);
  if (!container) return;
  if (typeof vis === "undefined") {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#c53d43;font-size:13px;padding:20px;text-align:center;font-family:IBM Plex Mono,monospace;">vis.js failed to load. Use Live Server in VS Code or open via localhost.</div>';
    return;
  }
  var nodes = states.map(function (s) {
    var isFinal = finalStates.indexOf(s) !== -1;
    var color = "#8896ab";
    if (partitions) { for (var i = 0; i < partitions.length; i++) { if (partitions[i].indexOf(s) !== -1) { color = COLORS[i % COLORS.length]; break; } } }
    return { id: s, label: s, shape: "circle", size: 28,
      color: { background: color, border: isFinal ? "#2d3748" : color, highlight: { background: color, border: "#2d3748" } },
      borderWidth: isFinal ? 3.5 : 1.5,
      font: { color: "#fff", size: 14, face: "IBM Plex Mono, monospace", bold: true } };
  });
  nodes.push({ id: "__start__", label: "", shape: "dot", size: 0, color: { background: "transparent", border: "transparent" } });
  var edgeMap = {};
  Object.keys(transitions).forEach(function (k) { var p = k.split(","); var tgt = transitions[k]; var ek = p[0] + "->" + tgt; if (!edgeMap[ek]) edgeMap[ek] = { from: p[0], to: tgt, labels: [] }; edgeMap[ek].labels.push(p[1]); });
  var edges = [];
  if (startState) edges.push({ from: "__start__", to: startState, arrows: "to", color: { color: "#8896ab" }, width: 2 });
  Object.values(edgeMap).forEach(function (e) {
    var rev = e.to + "->" + e.from;
    edges.push({ from: e.from, to: e.to, label: e.labels.join(", "), arrows: "to",
      font: { color: "#2d3748", size: 12, face: "IBM Plex Mono", strokeWidth: 3, strokeColor: "#f7fafc", align: "top" },
      color: { color: "#8896ab", highlight: "#718096" }, width: 1.5,
      smooth: e.from === e.to ? { type: "curvedCW", roundness: 0.6 } : edgeMap[rev] && e.from !== e.to ? { type: "curvedCW", roundness: 0.25 } : { type: "curvedCW", roundness: 0.1 } });
  });
  new vis.Network(container, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, {
    physics: { enabled: true, solver: "forceAtlas2Based", forceAtlas2Based: { gravitationalConstant: -40, centralGravity: 0.008, springLength: 140, springConstant: 0.06, damping: 0.5 }, stabilization: { iterations: 200, fit: true } },
    interaction: { dragNodes: true, dragView: true, zoomView: true }, layout: { improvedLayout: true } });
}

function buildTable(states, alphabet, transitions, startState, finalStates) {
  var h = '<table class="trans-table"><thead><tr><th>State</th>';
  for (var i = 0; i < alphabet.length; i++) h += "<th>" + alphabet[i] + "</th>";
  h += "</tr></thead><tbody>";
  for (var i = 0; i < states.length; i++) {
    var s = states[i];
    var prefix = (s === startState ? "→ " : "") + (finalStates.indexOf(s) !== -1 ? "* " : "");
    h += "<tr><td style='font-weight:700'>" + prefix + s + "</td>";
    for (var j = 0; j < alphabet.length; j++) h += "<td>" + (transitions[s + "," + alphabet[j]] || "—") + "</td>";
    h += "</tr>";
  }
  return h + "</tbody></table>";
}

function renderPreview() {
  var d = parseInputs();
  if (d.states.length === 0) return;
  drawGraph("preview-graph", d.states, d.alphabet, d.transitions, d.start, d.finals, null);
  document.getElementById("preview-table").innerHTML = buildTable(d.states, d.alphabet, d.transitions, d.start, d.finals);
}

function renderSteps() {
  if (!currentResult) return;
  var d = parseInputs();
  var list = document.getElementById("steps-list");
  var h = "";
  for (var i = 0; i < currentResult.steps.length; i++) {
    var s = currentResult.steps[i];
    h += '<div class="step-card ' + (i === currentStep ? "active" : "") + '" onclick="selectStep(' + i + ')">';
    h += '<div class="step-title">' + s.title + '</div>';
    h += '<div class="step-desc">' + s.description + '</div>';
    if (s.partitions) {
      h += '<div class="step-partitions">';
      for (var j = 0; j < s.partitions.length; j++) {
        var bg = "linear-gradient(135deg, " + COLORS[j % COLORS.length] + ", " + COLORS[(j+1) % COLORS.length] + ")";
        h += '<span class="partition-chip" style="background:' + bg + '">{' + s.partitions[j].join(", ") + '}</span>';
      }
      h += '</div>';
    }
    h += '</div>';
  }
  list.innerHTML = h;
  document.getElementById("progress-fill").style.width = ((currentStep + 1) / currentResult.steps.length * 100) + "%";
  document.getElementById("steps-graph-label").textContent = currentResult.steps[currentStep] ? currentResult.steps[currentStep].title : "";
  drawGraph("steps-graph", d.states, d.alphabet, d.transitions, d.start, d.finals, currentResult.steps[currentStep] ? currentResult.steps[currentStep].partitions : null);
}

function selectStep(i) { currentStep = i; renderSteps(); }
function prevStep() { if (currentStep > 0) { currentStep--; renderSteps(); } }
function nextStep() { if (currentResult && currentStep < currentResult.steps.length - 1) { currentStep++; renderSteps(); } }

function renderResult() {
  if (!currentResult) return;
  var d = parseInputs();
  var min = currentResult.minimized;
  var minIds = min.states.map(function (s) { return s.id; });
  document.getElementById("orig-count").textContent = d.states.length;
  document.getElementById("min-count").textContent = min.states.length;
  drawGraph("orig-graph", d.states, d.alphabet, d.transitions, d.start, d.finals, null);
  document.getElementById("orig-table").innerHTML = buildTable(d.states, d.alphabet, d.transitions, d.start, d.finals);
  drawGraph("min-graph", minIds, min.alphabet, min.transitions, min.startState, min.finalStates, null);
  document.getElementById("min-table").innerHTML = buildTable(minIds, min.alphabet, min.transitions, min.startState, min.finalStates);
  var mh = "";
  for (var i = 0; i < min.states.length; i++) {
    var ms = min.states[i];
    mh += '<div class="mapping-row"><span style="color:' + COLORS[i % COLORS.length] + ';font-weight:700;min-width:30px;display:inline-block">' + ms.id + '</span><span class="mapping-arrow">←</span><span>' + ms.label + '</span></div>';
  }
  document.getElementById("state-mapping").innerHTML = mh;
  var diff = d.states.length - min.states.length;
  document.getElementById("summary-text").textContent = diff === 0
    ? "DFA was already minimal (" + d.states.length + " states)"
    : "Reduced from " + d.states.length + " to " + min.states.length + " states (" + diff + " eliminated)";
}
