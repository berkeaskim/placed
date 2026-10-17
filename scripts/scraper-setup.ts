import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * `npm run scraper:setup`: installs the optional stealth sidecar (scraper/fetch.py + Scrapling) into scraper/.venv.
 * Prefers uv; falls back to a Python >= 3.10 on PATH. Never installs system packages. Re-runnable.
 */
const root = process.cwd();
const venv = path.join(root, "scraper", ".venv");
const py = path.join(venv, "bin", "python");
const requirements = path.join(root, "scraper", "requirements.txt");

function run(cmd: string, args: string[]) {
  console.log(`$ ${[cmd, ...args].join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${path.basename(cmd)} exited with code ${r.status}`);
}

function works(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function findUv(): string | null {
  const local = path.join(homedir(), ".local", "bin", "uv");
  if (existsSync(local) && works(local, ["--version"])) return local;
  return works("uv", ["--version"]) ? "uv" : null;
}

function findPython(): string | null {
  for (const cmd of ["python3.12", "python3.11", "python3.10", "python3"]) {
    const v = works(cmd, ["-c", "import sys; print('%d.%d' % sys.version_info[:2])"]);
    if (!v) continue;
    const [major, minor] = v.split(".").map(Number);
    if (major === 3 && minor >= 10) return cmd;
  }
  return null;
}

function main() {
  const uv = findUv();
  if (uv) {
    if (!existsSync(py)) run(uv, ["venv", "--python", "3.12", venv]);
    run(uv, ["pip", "install", "--python", py, "-r", requirements]);
  } else {
    const python = findPython();
    if (!python) {
      console.error(
        "The optional scraper needs uv or Python 3.10+.\n" +
        "  Install uv:     curl -LsSf https://astral.sh/uv/install.sh | sh\n" +
        "  or Python 3.12: brew install python@3.12   (or pyenv install 3.12)\n" +
        "then run npm run scraper:setup again. Placed works without it; only boards marked transport: stealth need it.",
      );
      process.exit(1);
    }
    if (!existsSync(py)) run(python, ["-m", "venv", venv]);
    run(py, ["-m", "pip", "install", "-r", requirements]);
  }

  if (process.platform === "darwin") {
    // Downloads Chromium into the user's Playwright cache. Its install-deps step is a no-op on macOS.
    run(path.join(venv, "bin", "scrapling"), ["install"]);
  } else {
    // `scrapling install` also runs `playwright install-deps`, which installs system packages (apt, sudo). Skip that part.
    run(py, ["-m", "playwright", "install", "chromium"]);
    console.log(`If Chromium fails to start, install its system libraries yourself: sudo ${py} -m playwright install-deps chromium`);
  }

  const v = works(py, [path.join(root, "scraper", "fetch.py"), "--version"]);
  if (!v) {
    console.error("The sidecar did not answer --version. Re-run npm run scraper:setup, or delete scraper/.venv and try again.");
    process.exit(1);
  }
  console.log(`Optional scraper installed (Scrapling ${v}). It never solves Cloudflare or CAPTCHA challenges.`);
}

try {
  main();
} catch (e) {
  console.error(`scraper:setup failed: ${(e as Error).message}`);
  process.exit(1);
}
