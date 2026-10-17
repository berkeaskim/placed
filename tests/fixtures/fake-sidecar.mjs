#!/usr/bin/env node
// Stand-in for scraper/fetch.py in tests (no Python needed). Same protocol: one JSON request per stdin line,
// one JSON response per stdout line. FAKE_SIDECAR_EXIT_ON=n makes it exit (crash) when it reads request number n.
import { createInterface } from "node:readline";

if (process.argv.includes("--version")) {
  console.log("fake-sidecar 0.0.0");
  process.exit(0);
}

const exitOn = Number(process.env.FAKE_SIDECAR_EXIT_ON || 0);
let seen = 0;
const reply = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
const json = (id, data) => reply({ id, status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  const req = JSON.parse(line);
  seen++;
  if (exitOn && seen === exitOn) process.exit(3);
  const url = String(req.url);
  if (url.includes("challenge")) {
    reply({
      id: req.id, status: 403, headers: { "content-type": "text/html", "cf-mitigated": "challenge" },
      body: "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body></body></html>",
    });
  } else if (url.includes("hang")) {
    // never answers: a wedged page
  } else if (url.includes("broken")) {
    reply({ id: req.id, error: "navigation failed" });
  } else if (/\/postings\?/.test(url)) {
    json(req.id, { totalFound: 1, content: [{ id: "p1", name: "Data Analyst Intern" }] });
  } else {
    json(req.id, { ok: true, pid: process.pid, url, method: req.method, body: req.body ?? null, headers: req.headers });
  }
});
