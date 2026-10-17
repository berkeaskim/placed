import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";

/**
 * Optional stealth transport: boards marked `transport: stealth` in seed/companies.yml are fetched through
 * scraper/fetch.py (Scrapling's StealthySession, a headless browser) instead of Node's fetch. It only helps with
 * TLS/header fingerprinting and plain 403s. It never solves a Cloudflare/Turnstile/CAPTCHA challenge: a challenge page
 * fails the board as `blocked`, and nothing retries it with more evasion.
 *
 * Protocol (JSON lines): request {"id", "url", "method", "headers", "body"} → {"id", "status", "headers", "body"} or
 * {"id", "error"}. One long-lived process per Node process, started on first use, closed after 60 s idle.
 */

export const SETUP_HINT = "needs the optional scraper: npm run scraper:setup";
const IDLE_MS = 60_000;
// A browser launch plus page load can outlast the 15 s budget providers give a plain fetch, so the sidecar has its own cap.
const REQUEST_TIMEOUT_MS = 90_000;
const VERSION_TIMEOUT_MS = 30_000;

/** The sidecar's interpreter, or the whole command when PLACED_SCRAPER_CMD is set (tests use a Node fake). */
export function sidecarPath(): string {
  return process.env.PLACED_SCRAPER_CMD || path.join(process.cwd(), "scraper", ".venv", "bin", "python");
}

/** argv for the sidecar. PLACED_SCRAPER_CMD is split on whitespace (no quoting), and replaces python + fetch.py. */
function sidecarCommand(): string[] {
  if (process.env.PLACED_SCRAPER_CMD) return process.env.PLACED_SCRAPER_CMD.trim().split(/\s+/);
  return [sidecarPath(), path.join(process.cwd(), "scraper", "fetch.py")];
}

const installed = new Map<string, Promise<boolean>>();

/** Whether the sidecar answers `--version` (a yes is cached per command). Never throws. */
export function scraperInstalled(): Promise<boolean> {
  const argv = sidecarCommand();
  const key = argv.join(" ");
  let p = installed.get(key);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      let child;
      try {
        child = spawn(argv[0], [...argv.slice(1), "--version"], { stdio: "ignore" });
      } catch {
        return resolve(false);
      }
      const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(false); }, VERSION_TIMEOUT_MS);
      timer.unref();
      child.on("error", () => { clearTimeout(timer); resolve(false); });
      child.on("exit", (code) => { clearTimeout(timer); resolve(code === 0); });
    });
    installed.set(key, p);
    // Only a positive answer is cached, so running scraper:setup while Placed is open shows up without a restart.
    void p.then((ok) => { if (!ok && installed.get(key) === p) installed.delete(key); });
  }
  return p;
}

const CHALLENGE_PATTERNS: RegExp[] = [
  /<title>\s*Just a moment\.\.\.\s*<\/title>/i, // Cloudflare interstitial
  /challenges\.cloudflare\.com\/turnstile/i, // Turnstile widget
  /cdn-cgi\/challenge-platform/i, // Cloudflare managed challenge
  /<title>\s*Access Denied\s*<\/title>[\s\S]*Reference/i, // Akamai reference page
  /_pxCaptcha|px-captcha/i, // PerimeterX
  /Press (?:&amp;|&) Hold/i, // PerimeterX "Press & Hold"
];

/** A bot-check page instead of the board's data. Header names are compared lower-case. */
export function isChallenge(status: number, headers: Record<string, string>, body: string): boolean {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  if ((h["cf-mitigated"] ?? "").toLowerCase() === "challenge") return true;
  // A JSON payload is data even when a posting happens to mention these words.
  if (/json/i.test(h["content-type"] ?? "") && status >= 200 && status < 300) return false;
  return CHALLENGE_PATTERNS.some((re) => re.test(body));
}

type SidecarReply = { id: number; status?: number; headers?: Record<string, string>; body?: string; error?: string };
type Pending = { resolve: (r: SidecarReply) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

let child: ChildProcessWithoutNullStreams | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let idleTimer: NodeJS.Timeout | null = null;
let stderrTail = "";

function failAll(err: Error) {
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    pending.delete(id);
    p.reject(err);
  }
}

function stop() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  const c = child;
  child = null;
  if (c) {
    c.stdin.end();
    c.kill();
  }
}

function armIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  if (pending.size > 0 || !child) return;
  idleTimer = setTimeout(stop, IDLE_MS);
  idleTimer.unref();
}

/** An idle sidecar must not keep `npm run ingest` alive: the child and its pipes are unref'd; pending timers keep the loop up. */
function unrefStreams(c: ChildProcessWithoutNullStreams) {
  c.unref();
  for (const s of [c.stdin, c.stdout, c.stderr] as unknown as { unref?: () => void }[]) s.unref?.();
}

function start(): ChildProcessWithoutNullStreams {
  const argv = sidecarCommand();
  const c = spawn(argv[0], argv.slice(1), { stdio: ["pipe", "pipe", "pipe"] });
  stderrTail = "";
  unrefStreams(c);
  const onGone = (why: string) => {
    if (child !== c) return;
    child = null;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    installed.clear(); // a deleted venv should show the setup hint on the next call
    const tail = stderrTail.trim().split("\n").slice(-1)[0];
    failAll(new Error(`stealth sidecar ${why}${tail ? `: ${tail}` : ""}`));
  };
  c.on("error", (e) => onGone(`failed to start (${e.message})`));
  c.on("exit", (code, signal) => onGone(`exited (${signal ?? `code ${code}`})`));
  c.stdin.on("error", () => {}); // EPIPE after a crash is reported by the exit handler
  c.stderr.on("data", (d: Buffer) => { stderrTail = (stderrTail + d.toString()).slice(-2000); });
  createInterface({ input: c.stdout }).on("line", (line) => {
    let msg: SidecarReply;
    try {
      msg = JSON.parse(line) as SidecarReply;
    } catch {
      return; // stray library output on stdout
    }
    const p = pending.get(msg.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(msg.id);
    p.resolve(msg);
    armIdle();
  });
  return c;
}

function call(req: { url: string; method: string; headers: Record<string, string>; body: string | null }): Promise<SidecarReply> {
  if (!child) child = start();
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  const c = child;
  const id = nextId++;
  return new Promise<SidecarReply>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`stealth sidecar timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
      armIdle();
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    c.stdin.write(`${JSON.stringify({ id, ...req })}\n`);
  });
}

const NULL_BODY = new Set([101, 204, 205, 304]);

function toHeaders(h: Record<string, string> | undefined): Headers {
  const out = new Headers();
  for (const [k, v] of Object.entries(h ?? {})) {
    const name = k.toLowerCase();
    // The body arrives decoded, so the wire encoding/length no longer describe it.
    if (name === "content-encoding" || name === "content-length" || name.startsWith(":")) continue;
    try {
      out.set(name, String(v).replace(/[\r\n]+/g, ", "));
    } catch {
      // skip a header name/value the Fetch spec rejects
    }
  }
  return out;
}

/** `typeof fetch` over the sidecar. The caller's AbortSignal is not forwarded (see REQUEST_TIMEOUT_MS). */
export const stealthFetch: typeof fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!(await scraperInstalled())) throw new Error(SETUP_HINT);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const headers = Object.fromEntries(new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)));
  const body = init?.body == null ? null : String(init.body);
  const r = await call({ url, method, headers, body });
  if (r.error) throw new Error(`stealth sidecar: ${r.error}`);
  const status = Number(r.status);
  const text = r.body ?? "";
  if (isChallenge(status, r.headers ?? {}, text)) {
    throw new Error(`blocked: ${new URL(url).host} answered with a bot challenge (HTTP ${status}); Placed never solves these`);
  }
  if (!Number.isInteger(status) || status < 200 || status > 599) throw new Error(`stealth sidecar: bad status ${r.status}`);
  return new Response(NULL_BODY.has(status) ? null : text, { status, headers: toHeaders(r.headers) });
};

/** Tests: drop the running sidecar and the install cache. */
export function resetStealthForTests() {
  stop();
  failAll(new Error("stealth sidecar reset"));
  installed.clear();
}
