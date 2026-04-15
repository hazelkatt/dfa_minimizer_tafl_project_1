//dfa minimization algorithm

function minimizeDFA(states, alphabet, transitions, startState, finalStates) {
  var steps = [];

//Phase 1: Remove unreachable states via BFS
  var reachable = {};
  reachable[startState] = true;
  var queue = [startState];
  while (queue.length > 0) {
    var current = queue.shift();
    for (var a = 0; a < alphabet.length; a++) {
      var next = transitions[current + "," + alphabet[a]];
      if (next && !reachable[next]) { reachable[next] = true; queue.push(next); }
    }
  }

  var unreachable = states.filter(function (s) { return !reachable[s]; });
  var rStates = states.filter(function (s) { return reachable[s]; });
  var rFinal = rStates.filter(function (s) { return finalStates.indexOf(s) !== -1; });
  var rNonFinal = rStates.filter(function (s) { return finalStates.indexOf(s) === -1; });

  steps.push({
    title: "Step 0 — Remove Unreachable States",
    description: unreachable.length > 0
      ? "States {" + unreachable.join(", ") + '} are unreachable from "' + startState + '" and removed.'
      : 'All states reachable from "' + startState + '". Nothing removed.',
    partitions: [rFinal, rNonFinal].filter(function (p) { return p.length > 0; }),
    type: "unreachable"
  });

//Phase 2: Initial partition
  var P = [];
  if (rFinal.length > 0) P.push(rFinal.slice());
  if (rNonFinal.length > 0) P.push(rNonFinal.slice());

  steps.push({
    title: "Step 1 — Initial Partition",
    description: "Separate into Final {" + rFinal.join(", ") + "} and Non-final {" + rNonFinal.join(", ") + "}.",
    partitions: P.map(function (p) { return p.slice(); }),
    type: "partition"
  });

//Phase 3: Iterative refinement
  var iteration = 2;
  var changed = true;
  while (changed) {
    changed = false;
    var newP = [];
    for (var g = 0; g < P.length; g++) {
      var group = P[g];
      if (group.length <= 1) { newP.push(group); continue; }
      var subGroups = {};
      for (var s = 0; s < group.length; s++) {
        var state = group[s];
        var sigParts = [];
        for (var a = 0; a < alphabet.length; a++) {
          var target = transitions[state + "," + alphabet[a]] || "DEAD";
          var pIdx = -1;
          for (var pi = 0; pi < P.length; pi++) {
            if (P[pi].indexOf(target) !== -1) { pIdx = pi; break; }
          }
          sigParts.push(pIdx);
        }
        var sig = sigParts.join(",");
        if (!subGroups[sig]) subGroups[sig] = [];
        subGroups[sig].push(state);
      }
      var splits = Object.values(subGroups);
      if (splits.length > 1) changed = true;
      for (var i = 0; i < splits.length; i++) newP.push(splits[i]);
    }
    if (changed) {
      P = newP;
      steps.push({
        title: "Step " + iteration + " — Refinement",
        description: "Split by transition behavior: " + P.map(function (g) { return "{" + g.join(", ") + "}"; }).join(", "),
        partitions: P.map(function (p) { return p.slice(); }),
        type: "refine"
      });
      iteration++;
    }
  }
  steps.push({
    title: "Step " + iteration + " — Converged",
    description: "No further splits possible. Algorithm complete.",
    partitions: P.map(function (p) { return p.slice(); }),
    type: "done"
  });

//Build minimized DFA
  var minStates = P.map(function (group, i) {
    return { id: "M" + i, label: group.length === 1 ? group[0] : "{" + group.join(",") + "}", members: group };
  });
  var minTransitions = {};
  var minStart = null;
  var minFinal = [];
  for (var i = 0; i < minStates.length; i++) {
    if (minStates[i].members.indexOf(startState) !== -1) minStart = minStates[i].id;
    for (var j = 0; j < minStates[i].members.length; j++) {
      if (finalStates.indexOf(minStates[i].members[j]) !== -1) { minFinal.push(minStates[i].id); break; }
    }
    var rep = minStates[i].members[0];
    for (var a = 0; a < alphabet.length; a++) {
      var t = transitions[rep + "," + alphabet[a]];
      if (t) {
        for (var k = 0; k < minStates.length; k++) {
          if (minStates[k].members.indexOf(t) !== -1) { minTransitions[minStates[i].id + "," + alphabet[a]] = minStates[k].id; break; }
        }
      }
    }
  }
  return { steps: steps, minimized: { states: minStates, transitions: minTransitions, startState: minStart, finalStates: minFinal, alphabet: alphabet } };
}
