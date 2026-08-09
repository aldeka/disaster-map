// Stitches a group of dash LineStrings (all belonging to one physical fault
// strand, per parse-fault-name.mjs's groupKey) into as few maximal
// continuous polylines as possible. Dashes whose endpoints fall within
// snapToleranceMeters of each other are treated as touching; near-duplicate
// AGE-class copies that never touch anything simply come out as their own
// short path, which is the desired behavior (they render as separate thin
// ribbons rather than getting force-merged).
//
// Endpoint pairing is a greedy globally-nearest-first matching (sort every
// candidate pair by distance, claim the closest first, each endpoint used
// at most once) rather than a blanket "union everything within tolerance"
// -- that naive approach was tried first and made things *worse* as
// tolerance grew: in the dense clusters of near-duplicate AGE-class traces,
// many endpoints all fall within radius of each other, fusing into
// high-degree junction nodes that stop the walk (only clean degree-2
// pass-throughs continue), fragmenting paths instead of joining them.
// Greedy nearest-first matching caps every endpoint at one partner, so
// chains stay chains.
import { toLocalMeters, distanceMeters } from "./project.mjs";

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

function dedupeConsecutive(coords, epsilonMeters = 1) {
  const result = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const prev = toLocalMeters(result[result.length - 1]);
    const cur = toLocalMeters(coords[i]);
    if (distanceMeters(prev, cur) > epsilonMeters) result.push(coords[i]);
  }
  return result;
}

export function stitchGroup(dashLines, { snapToleranceMeters }) {
  const dashes = dashLines.filter((line) => line.length >= 2);
  if (dashes.length === 0) return [];

  // endpointsXY[2*i] = start of dash i, endpointsXY[2*i+1] = end of dash i.
  const endpointsXY = [];
  for (const line of dashes) {
    endpointsXY.push(toLocalMeters(line[0]));
    endpointsXY.push(toLocalMeters(line[line.length - 1]));
  }

  const n = endpointsXY.length;
  const candidatePairs = [];
  for (let i = 0; i < n; i++) {
    const ownDashI = i >> 1;
    for (let j = i + 1; j < n; j++) {
      if (j >> 1 === ownDashI) continue; // don't self-pair a dash's two ends
      const d = distanceMeters(endpointsXY[i], endpointsXY[j]);
      if (d <= snapToleranceMeters) candidatePairs.push([d, i, j]);
    }
  }
  candidatePairs.sort((a, b) => a[0] - b[0]);

  const uf = new UnionFind(n);
  const matched = new Array(n).fill(false);
  for (const [, i, j] of candidatePairs) {
    if (matched[i] || matched[j]) continue;
    uf.union(i, j);
    matched[i] = true;
    matched[j] = true;
  }

  const edgesByNode = new Map();
  const addEdge = (node, edge) => {
    if (!edgesByNode.has(node)) edgesByNode.set(node, []);
    edgesByNode.get(node).push(edge);
  };
  for (let i = 0; i < dashes.length; i++) {
    const startCluster = uf.find(2 * i);
    const endCluster = uf.find(2 * i + 1);
    addEdge(startCluster, { dashIndex: i, fromEnd: "start", toCluster: endCluster });
    addEdge(endCluster, { dashIndex: i, fromEnd: "end", toCluster: startCluster });
  }

  const used = new Set();

  function walkPath(startNode, startEdge) {
    let coords = null;
    let node = startNode;
    let edge = startEdge;
    for (;;) {
      used.add(edge.dashIndex);
      const line = dashes[edge.dashIndex];
      const oriented = edge.fromEnd === "start" ? line : line.slice().reverse();
      coords = coords ? coords.concat(oriented.slice(1)) : oriented.slice();
      const nextNode = edge.toCluster;
      const nextNodeEdges = edgesByNode.get(nextNode) ?? [];
      const candidates = nextNodeEdges.filter((e) => !used.has(e.dashIndex));
      // Only keep walking through a plain pass-through node (exactly two
      // incident edges total); junctions and dead ends stop the walk here.
      if (nextNodeEdges.length !== 2 || candidates.length !== 1) break;
      node = nextNode;
      edge = candidates[0];
    }
    return coords;
  }

  const paths = [];

  // Pass 1: start every walk from a junction/dead-end node (degree != 2) so
  // maximal paths are found before any arbitrary cycle-breaking.
  for (const [node, edges] of edgesByNode) {
    if (edges.length === 2) continue;
    for (const edge of edges) {
      if (used.has(edge.dashIndex)) continue;
      paths.push(walkPath(node, edge));
    }
  }

  // Pass 2: whatever's left is an isolated all-degree-2 loop; break it
  // arbitrarily at the first unused edge found.
  for (const [node, edges] of edgesByNode) {
    for (const edge of edges) {
      if (!used.has(edge.dashIndex)) paths.push(walkPath(node, edge));
    }
  }

  return paths.map((coords) => dedupeConsecutive(coords)).filter((coords) => coords.length >= 2);
}
