#!/usr/bin/env node
// Phase 1 topology analysis for tour-builder.
const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) fail("Usage: node ua-tour-analyze.js <input.json> <output.json>");

let data;
try {
  data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
} catch (e) {
  fail("Failed to read/parse input: " + e.message);
}

const { nodes, edges, layers } = data;
if (!Array.isArray(nodes) || !Array.isArray(edges)) fail("Invalid input: nodes/edges must be arrays");

const nodeById = new Map(nodes.map(n => [n.id, n]));

// Fan-in / fan-out
const fanIn = new Map();
const fanOut = new Map();
for (const n of nodes) { fanIn.set(n.id, 0); fanOut.set(n.id, 0); }
for (const e of edges) {
  if (fanOut.has(e.source)) fanOut.set(e.source, fanOut.get(e.source) + 1);
  if (fanIn.has(e.target)) fanIn.set(e.target, fanIn.get(e.target) + 1);
}

const fanInRanking = [...fanIn.entries()]
  .map(([id, count]) => ({ id, fanIn: count, name: nodeById.get(id)?.name }))
  .sort((a, b) => b.fanIn - a.fanIn)
  .slice(0, 20);

const fanOutRanking = [...fanOut.entries()]
  .map(([id, count]) => ({ id, fanOut: count, name: nodeById.get(id)?.name }))
  .sort((a, b) => b.fanOut - a.fanOut)
  .slice(0, 20);

// Entry point candidates
const entryFilenames = new Set([
  "index.ts", "index.js", "main.ts", "main.js", "app.ts", "app.js", "server.ts", "server.js",
  "mod.rs", "main.go", "main.py", "main.rs", "manage.py", "app.py", "wsgi.py", "asgi.py",
  "run.py", "__main__.py", "Application.java", "Main.java", "Program.cs", "config.ru",
  "index.php", "App.swift", "Application.kt", "main.cpp", "main.c"
]);

const fanOutValues = [...fanOut.values()].sort((a, b) => b - a);
const fanOutTop10PctThreshold = fanOutValues[Math.max(0, Math.floor(fanOutValues.length * 0.1) - 1)] ?? 0;
const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
const fanInBottom25PctThreshold = fanInValues[Math.floor(fanInValues.length * 0.25)] ?? 0;

const entryPointCandidates = [];
for (const n of nodes) {
  let score = 0;
  if (n.type === "document") {
    const base = (n.filePath || n.name || "").replace(/\\/g, "/");
    const isRoot = !base.includes("/");
    if (/^readme\.md$/i.test(n.name || "") && isRoot) score += 5;
    else if (/\.md$/i.test(n.name || "") && isRoot) score += 2;
  } else {
    if (entryFilenames.has(n.name)) score += 3;
    const fp = (n.filePath || "").replace(/\\/g, "/");
    const depth = fp.split("/").filter(Boolean).length;
    if (fp && depth <= 2) score += 1;
    if (fanOut.get(n.id) >= fanOutTop10PctThreshold && fanOut.get(n.id) > 0) score += 1;
    if (fanIn.get(n.id) <= fanInBottom25PctThreshold) score += 1;
  }
  if (score > 0) entryPointCandidates.push({ id: n.id, score, name: n.name, summary: n.summary });
}
entryPointCandidates.sort((a, b) => b.score - a.score);
const topEntryPointCandidates = entryPointCandidates.slice(0, 5);

// BFS from top code entry point (skip documentation nodes)
const codeEntryCandidates = entryPointCandidates.filter(c => nodeById.get(c.id)?.type !== "document");
const bfsStart = codeEntryCandidates[0]?.id;

const adjacency = new Map();
for (const n of nodes) adjacency.set(n.id, []);
for (const e of edges) {
  if ((e.type === "imports" || e.type === "calls") && adjacency.has(e.source)) {
    adjacency.get(e.source).push(e.target);
  }
}

const bfsTraversal = { startNode: bfsStart || null, order: [], depthMap: {}, byDepth: {} };
if (bfsStart) {
  const visited = new Set([bfsStart]);
  const queue = [[bfsStart, 0]];
  while (queue.length) {
    const [id, depth] = queue.shift();
    bfsTraversal.order.push(id);
    bfsTraversal.depthMap[id] = depth;
    if (!bfsTraversal.byDepth[depth]) bfsTraversal.byDepth[depth] = [];
    bfsTraversal.byDepth[depth].push(id);
    for (const next of adjacency.get(id) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, depth + 1]);
      }
    }
  }
}

// Non-code file inventory
const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
for (const n of nodes) {
  const entry = { id: n.id, name: n.name, type: n.type, summary: n.summary };
  if (n.type === "document") nonCodeFiles.documentation.push(entry);
  else if (["service", "pipeline", "resource"].includes(n.type)) nonCodeFiles.infrastructure.push(entry);
  else if (["table", "schema", "endpoint"].includes(n.type)) nonCodeFiles.data.push(entry);
  else if (n.type === "config") nonCodeFiles.config.push(entry);
}

// Tightly coupled clusters
const edgeSet = new Set(edges.map(e => `${e.source}=>${e.target}`));
const bidirPairs = [];
for (const e of edges) {
  if ((e.type === "imports" || e.type === "calls") && edgeSet.has(`${e.target}=>${e.source}`)) {
    const key = [e.source, e.target].sort().join("|");
    bidirPairs.push(key);
  }
}
const uniquePairs = [...new Set(bidirPairs)].map(k => k.split("|"));

const clusters = [];
const usedInCluster = new Set();
for (const [a, b] of uniquePairs) {
  if (usedInCluster.has(a) || usedInCluster.has(b)) continue;
  const clusterNodes = new Set([a, b]);
  // Expand: add nodes connecting to 2+ existing members
  let grew = true;
  while (grew && clusterNodes.size < 5) {
    grew = false;
    const candidateCounts = new Map();
    for (const e of edges) {
      if (clusterNodes.has(e.source) && !clusterNodes.has(e.target)) {
        candidateCounts.set(e.target, (candidateCounts.get(e.target) || 0) + 1);
      }
      if (clusterNodes.has(e.target) && !clusterNodes.has(e.source)) {
        candidateCounts.set(e.source, (candidateCounts.get(e.source) || 0) + 1);
      }
    }
    for (const [cand, count] of candidateCounts.entries()) {
      if (count >= 2 && clusterNodes.size < 5) {
        clusterNodes.add(cand);
        grew = true;
      }
    }
  }
  const nodeList = [...clusterNodes];
  const edgeCount = edges.filter(e => clusterNodes.has(e.source) && clusterNodes.has(e.target)).length;
  clusters.push({ nodes: nodeList, edgeCount });
  for (const nid of nodeList) usedInCluster.add(nid);
}
clusters.sort((a, b) => b.edgeCount - a.edgeCount);
const topClusters = clusters.slice(0, 10);

// Node summary index
const nodeSummaryIndex = {};
for (const n of nodes) {
  nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary };
}

const result = {
  scriptCompleted: true,
  entryPointCandidates: topEntryPointCandidates,
  fanInRanking,
  fanOutRanking,
  bfsTraversal,
  nonCodeFiles,
  clusters: topClusters,
  layers: { count: (layers || []).length, list: layers || [] },
  nodeSummaryIndex,
  totalNodes: nodes.length,
  totalEdges: edges.length,
};

try {
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
} catch (e) {
  fail("Failed to write output: " + e.message);
}

console.log("OK. Wrote", outputPath);
process.exit(0);
