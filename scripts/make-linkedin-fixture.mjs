/**
 * Renders tests/linkedin/fixtures/ayse-synthetic-export.pdf: a SYNTHETIC two-column PDF laid out like LinkedIn's
 * "Save to PDF" export (left sidebar, main column, page footers) for the FICTIONAL demo persona. It exercises the
 * positioned-line extractor until real exports exist (playbook §10). Not a real LinkedIn file.
 * Run: node scripts/make-linkedin-fixture.mjs
 */
import { createWriteStream, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "tests/linkedin/fixtures/ayse-synthetic-export.pdf");
const lines = readFileSync(path.join(root, "tests/linkedin/fixtures/ayse-synthetic-export.txt"), "utf8").split("\n").filter(Boolean);

const doc = new PDFDocument({ size: "A4", margin: 0, info: { CreationDate: new Date("2026-10-14T00:00:00Z") } });
doc.pipe(createWriteStream(out));
doc.registerFont("r", path.join(root, "public/fonts/NotoSans-Regular.ttf"));
doc.registerFont("b", path.join(root, "public/fonts/NotoSans-Bold.ttf"));

const SIDEBAR = new Set(["Contact", "Top Skills", "Languages", "Certifications"]);
const MAIN = new Set(["Summary", "Experience", "Education"]);
const nameAt = lines.indexOf("Ayşe Demir");
const side = lines.slice(0, nameAt);
const main = lines.slice(nameAt).filter((l) => !/^Page \d+ of \d+$/.test(l));

// Sidebar: grey column on page 1.
doc.rect(0, 0, 190, 842).fill("#F3F6F8");
let y = 40;
for (const t of side) {
  const head = SIDEBAR.has(t);
  doc.fillColor("#000").font(head ? "b" : "r").fontSize(head ? 13 : 10).text(t, 28, y, { width: 150, lineBreak: false });
  y += head ? 22 : 15;
}

// Main column: name (26pt), headline, location, then sections. A long page breaks to page 2 like the export.
y = 40;
const write = (t, font, size, gap) => {
  if (y > 780) {
    doc.font("r").fontSize(9).fillColor("#777").text(`Page 1 of 2`, 280, 815, { lineBreak: false });
    doc.addPage();
    y = 40;
  }
  doc.fillColor("#000").font(font).fontSize(size).text(t, 220, y, { width: 350, lineBreak: false });
  y += gap;
};
main.forEach((t, i) => {
  if (i === 0) return write(t, "b", 26, 36);
  if (i === 1) return write(t, "r", 12, 18);
  if (i === 2) return write(t, "r", 10, 26);
  if (MAIN.has(t)) { y += 6; return write(t, "b", 15, 24); }
  write(t, /^[A-Z].{0,40}$/.test(t) && !/[.,]$/.test(t) ? "b" : "r", 11, 16);
});
// Push Education onto page 2 like a real multi-page export.
doc.font("r").fontSize(9).fillColor("#777").text(`Page ${doc.bufferedPageRange().count} of ${doc.bufferedPageRange().count}`, 280, 815, { lineBreak: false });
doc.end();
console.log("wrote", path.relative(root, out));
