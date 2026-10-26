#!/usr/bin/env node
// Checks specs/ (see specs/README.md). Errors fail the run; coverage gaps are reported.
//
//   capabilities  unique REQ IDs matching the spec's prefix; every requirement has a
//                 scenario with Given/When/Then
//   changes       proposal.md + spec-delta.md present; ADDED IDs are new, MODIFIED/REMOVED
//                 exist; tasks reference real IDs and cover every ADDED/MODIFIED one
//   contracts     x-requirements in openapi.yaml name real IDs
//   code          every `@req REQ-…` tag names a real ID; requirements without one are listed
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SPECS = join(ROOT, "specs");
const CODE_DIRS = ["app", "lib", "orchestrator", "tests"];
const ID = /REQ-[A-Z]+-\d{3}/g;

const errors = [];
const err = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const read = (f) => readFileSync(f, "utf8");
const dirs = (d) => (existsSync(d) ? readdirSync(d).filter((n) => statSync(join(d, n)).isDirectory() && !n.startsWith(".")) : []);

/** Split markdown into requirement blocks: "### REQ-X-001: title" up to the next ##/### heading. */
function requirements(text) {
  const out = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const m = line.match(/^### (REQ-[A-Z]+-\d{3})\b/);
    if (m) {
      if (cur) out.push(cur);
      cur = { id: m[1], body: line + "\n" };
    } else if (/^#{1,3} /.test(line)) {
      if (cur) out.push(cur); // any #, ## or ### heading ends the block; #### Scenario does not
      cur = null;
    } else if (cur) {
      cur.body += line + "\n";
    }
  }
  if (cur) out.push(cur);
  return out;
}

function checkScenarios(file, req) {
  const scenarios = req.body.split(/^#### Scenario:/m).slice(1);
  if (!scenarios.length) return err(file, `${req.id} has no scenario`);
  for (const s of scenarios) {
    for (const word of ["Given", "When", "Then"]) {
      if (!new RegExp(`\\*\\*${word}\\*\\*`).test(s)) err(file, `${req.id}: scenario "${s.split("\n")[0].trim()}" has no **${word}**`);
    }
  }
}

// --- capabilities -------------------------------------------------------------
const known = new Map(); // id -> capability
const capDir = join(SPECS, "capabilities");
for (const cap of dirs(capDir)) {
  const file = join(capDir, cap, "spec.md");
  if (!existsSync(file)) { err(join(capDir, cap), "missing spec.md"); continue; }
  const text = read(file);
  const prefix = text.match(/\*\*Prefix:\*\*\s*(REQ-[A-Z]+)/)?.[1];
  if (!prefix) err(file, "missing **Prefix:** REQ-XXX");
  for (const req of requirements(text)) {
    if (known.has(req.id)) err(file, `${req.id} already defined in ${known.get(req.id)}`);
    known.set(req.id, cap);
    if (prefix && !req.id.startsWith(prefix + "-")) err(file, `${req.id} does not match prefix ${prefix}`);
    if (!/the system shall/i.test(req.body)) err(file, `${req.id} has no "the system shall" statement`);
    checkScenarios(file, req);
  }
}

// --- changes ------------------------------------------------------------------
const added = new Set();
const chDir = join(SPECS, "changes");
for (const change of dirs(chDir)) {
  const dir = join(chDir, change);
  if (!/^\d{4}-[a-z0-9-]+$/.test(change)) err(dir, "folder must be NNNN-slug");
  for (const f of ["proposal.md", "spec-delta.md"]) if (!existsSync(join(dir, f))) err(dir, `missing ${f}`);
  if (!existsSync(join(dir, "spec-delta.md"))) continue;
  const deltaFile = join(dir, "spec-delta.md");
  const delta = read(deltaFile);
  const section = (name) => delta.split(/^## /m).find((s) => s.startsWith(name)) ?? "";
  const mustCover = new Set();
  const local = new Set();
  for (const [name, mustExist] of [["ADDED", false], ["MODIFIED", true], ["REMOVED", true]]) {
    for (const req of requirements(section(name))) {
      const cap = req.body.match(/<capability: ([a-z0-9-]+)>/)?.[1];
      if (!cap) err(deltaFile, `${req.id} (${name}) has no <capability: …> line`);
      else if (!existsSync(join(capDir, cap, "spec.md"))) err(deltaFile, `${req.id}: unknown capability ${cap}`);
      if (mustExist && !known.has(req.id)) err(deltaFile, `${req.id} (${name}) does not exist in capabilities`);
      if (!mustExist && known.has(req.id)) err(deltaFile, `${req.id} (ADDED) already exists in ${known.get(req.id)}; use the next free ID`);
      if (!mustExist && added.has(req.id)) err(deltaFile, `${req.id} (ADDED) is also added by another change`);
      if (name !== "REMOVED") { checkScenarios(deltaFile, req); mustCover.add(req.id); }
      if (!mustExist) { added.add(req.id); local.add(req.id); }
    }
  }
  const tasksFile = join(dir, "tasks.md");
  if (existsSync(tasksFile)) {
    const tasks = read(tasksFile);
    for (const id of new Set(tasks.match(ID) ?? [])) {
      if (!known.has(id) && !local.has(id)) err(tasksFile, `references unknown ${id}`);
      mustCover.delete(id);
    }
    for (const id of mustCover) err(tasksFile, `no task covers ${id}`);
  }
}

// --- contracts ----------------------------------------------------------------
const openapi = join(SPECS, "contracts", "openapi.yaml");
if (existsSync(openapi)) {
  for (const line of read(openapi).split("\n").filter((l) => l.includes("x-requirements"))) {
    for (const id of line.match(ID) ?? []) if (!known.has(id)) err(openapi, `x-requirements names unknown ${id}`);
  }
}

// --- code tags ----------------------------------------------------------------
const tagged = new Set();
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "node_modules" && !name.startsWith(".")) walk(p); continue; }
    if (!/\.(ts|tsx|mjs|js)$/.test(name)) continue;
    for (const m of read(p).matchAll(/@req\s+((?:REQ-[A-Z]+-\d{3}[\s,]*)+)/g)) {
      for (const id of m[1].match(ID)) {
        if (!known.has(id) && !added.has(id)) err(p, `@req names unknown ${id}`);
        tagged.add(id);
      }
    }
  }
}
CODE_DIRS.forEach((d) => walk(join(ROOT, d)));

// --- report -------------------------------------------------------------------
const untested = [...known.keys()].filter((id) => !tagged.has(id)).sort();
console.log(`specs: ${known.size} requirements in ${dirs(capDir).length} capabilities, ${dirs(chDir).length} open change(s), ${added.size} proposed requirement(s)`);
console.log(`traceability: ${known.size - untested.length}/${known.size} requirements referenced by @req tags`);
if (untested.length && process.argv.includes("--verbose")) console.log(`  not yet referenced: ${untested.join(", ")}`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log("ok");
