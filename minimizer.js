function minimizeDFA(states, alphabet, transitions, startState, finalStates) {
  var steps = [];

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

  function pairKey(a, b) {
    return a < b ? a + "|" + b : b + "|" + a;
  }

  var marked = {};     
  var allPairs = [];

  for (var i = 0; i < rStates.length; i++) {
    for (var j = i + 1; j < rStates.length; j++) {
      allPairs.push([rStates[i], rStates[j]]);
    }
  }

  steps.push({
    title: "Step 1 — Build State Pair Table",
    description: "Create a triangular table for all " + allPairs.length + " state pairs: " +
      allPairs.map(function (p) { return "(" + p[0] + "," + p[1] + ")"; }).join(", ") +
      ". All pairs start as unmarked (potentially equivalent).",
    partitions: [rFinal, rNonFinal].filter(function (p) { return p.length > 0; }),
    type: "partition"
  });

  var basePairs = [];

  for (var i = 0; i < allPairs.length; i++) {
    var p = allPairs[i][0];
    var q = allPairs[i][1];
    var pIsFinal = finalStates.indexOf(p) !== -1;
    var qIsFinal = finalStates.indexOf(q) !== -1;

    if (pIsFinal !== qIsFinal) {
      marked[pairKey(p, q)] = true;
      basePairs.push("(" + p + "," + q + ")");
    }
  }

  steps.push({
    title: "Step 2 — Mark Base Pairs",
    description: "Mark all pairs where one state is final and the other is non-final as distinguishable: " +
      (basePairs.length > 0 ? basePairs.join(", ") : "none") + ".",
    partitions: [rFinal, rNonFinal].filter(function (p) { return p.length > 0; }),
    type: "refine"
  });

  var iteration = 3;
  var changed = true;

  while (changed) {
    changed = false;
    var newlyMarked = [];

    for (var i = 0; i < allPairs.length; i++) {
      var p = allPairs[i][0];
      var q = allPairs[i][1];
      var pk = pairKey(p, q);

      if (marked[pk]) continue; 

      for (var a = 0; a < alphabet.length; a++) {
        var sym = alphabet[a];
        var pNext = transitions[p + "," + sym];
        var qNext = transitions[q + "," + sym];

        if ((!pNext && qNext) || (pNext && !qNext)) {
          marked[pk] = true;
          newlyMarked.push("(" + p + "," + q + ") via '" + sym + "'");
          changed = true;
          break;
        }

        if (pNext === qNext) continue;

        if (pNext && qNext && marked[pairKey(pNext, qNext)]) {
          marked[pk] = true;
          newlyMarked.push("(" + p + "," + q + ") via '" + sym + "' → (" + pNext + "," + qNext + ")");
          changed = true;
          break;
        }
      }
    }

    if (newlyMarked.length > 0) {
      steps.push({
        title: "Step " + iteration + " — Iterative Marking",
        description: "Check unmarked pairs — if their transitions lead to a marked pair, mark them. Newly marked: " +
          newlyMarked.join(", ") + ".",
        partitions: buildPartitionsFromTable(rStates, marked, pairKey),
        type: "refine"
      });
      iteration++;
    }
  }

  var equivalentPairs = [];
  for (var i = 0; i < allPairs.length; i++) {
    if (!marked[pairKey(allPairs[i][0], allPairs[i][1])]) {
      equivalentPairs.push("(" + allPairs[i][0] + "," + allPairs[i][1] + ")");
    }
  }

  var finalPartitions = buildPartitionsFromTable(rStates, marked, pairKey);

  steps.push({
    title: "Step " + iteration + " — Table Complete",
    description: "No more pairs can be marked. " +
      (equivalentPairs.length > 0
        ? "Equivalent (unmarked) pairs: " + equivalentPairs.join(", ") + ". These states can be merged."
        : "All pairs are distinguishable — the DFA is already minimal."),
    partitions: finalPartitions,
    type: "done"
  });

  var minStates = finalPartitions.map(function (group, i) {
    return {
      id: "M" + i,
      label: group.length === 1 ? group[0] : "{" + group.join(",") + "}",
      members: group
    };
  });

  var minTransitions = {};
  var minStart = null;
  var minFinal = [];

  for (var i = 0; i < minStates.length; i++) {
    if (minStates[i].members.indexOf(startState) !== -1) minStart = minStates[i].id;
    for (var j = 0; j < minStates[i].members.length; j++) {
      if (finalStates.indexOf(minStates[i].members[j]) !== -1) {
        minFinal.push(minStates[i].id);
        break;
      }
    }
    var rep = minStates[i].members[0];
    for (var a = 0; a < alphabet.length; a++) {
      var t = transitions[rep + "," + alphabet[a]];
      if (t) {
        for (var k = 0; k < minStates.length; k++) {
          if (minStates[k].members.indexOf(t) !== -1) {
            minTransitions[minStates[i].id + "," + alphabet[a]] = minStates[k].id;
            break;
          }
        }
      }
    }
  }

  return {
    steps: steps,
    minimized: {
      states: minStates,
      transitions: minTransitions,
      startState: minStart,
      finalStates: minFinal,
      alphabet: alphabet
    }
  };
}

function buildPartitionsFromTable(states, marked, pairKey) {
  var parent = {};
  for (var i = 0; i < states.length; i++) {
    parent[states[i]] = states[i];
  }

  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }

  function union(a, b) {
    var ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  for (var i = 0; i < states.length; i++) {
    for (var j = i + 1; j < states.length; j++) {
      if (!marked[pairKey(states[i], states[j])]) {
        union(states[i], states[j]);
      }
    }
  }

  var groups = {};
  for (var i = 0; i < states.length; i++) {
    var rep = find(states[i]);
    if (!groups[rep]) groups[rep] = [];
    groups[rep].push(states[i]);
  }

  return Object.values(groups);
}