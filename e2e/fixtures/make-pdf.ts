// Minimal, dependency-free PDF writer for E2E fixtures (Helvetica text + optional vector shapes).
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function makePdf(lines: { text: string; size?: number; bold?: boolean }[], opts: { textless?: boolean } = {}): Buffer {
  let y = 800;
  let content = "";
  if (opts.textless) {
    // Vector-only page: simulates a scanned / image-only CV (no extractable text layer).
    content = "0.85 g 40 60 515 720 re f 0.2 g 60 700 300 20 re f 60 660 420 10 re f 60 640 380 10 re f\n";
  } else {
    for (const l of lines) {
      const size = l.size ?? 10.5;
      y -= size + 5;
      content += `BT /${l.bold ? "F2" : "F1"} ${size} Tf 50 ${y} Td (${esc(l.text)}) Tj ET\n`;
    }
  }
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export const REALISTIC_CV = [
  { text: "Amira Khan", size: 18, bold: true },
  { text: "London, UK  |  amira.khan.e2e@example.com  |  +44 7700 900123  |  linkedin.com/in/amirakhan-e2e" },
  { text: "" },
  { text: "EDUCATION", size: 12, bold: true },
  { text: "University College London - BSc Economics and Statistics (Penultimate year)        2024 - 2027" },
  { text: "Predicted First Class (72% average). Modules: Econometrics, Probability, Microeconomics, Python for Data." },
  { text: "A-levels: Mathematics A*, Further Mathematics A*, Economics A" },
  { text: "" },
  { text: "EXPERIENCE", size: 12, bold: true },
  { text: "Data Analyst Intern - Monzo Bank, London                                          Jun 2025 - Aug 2025" },
  { text: "- Built a SQL + Python dashboard tracking card-decline rates, cutting investigation time by 30%." },
  { text: "- Automated a weekly Excel report with pandas, saving the ops team 4 hours per week." },
  { text: "- Presented churn analysis findings to 12 stakeholders, leading to a pricing experiment." },
  { text: "Treasurer - UCL Economics & Finance Society                                       Sep 2024 - present" },
  { text: "- Managed a GBP 18,000 annual budget and secured GBP 6,500 in sponsorship from 3 firms." },
  { text: "Spring Insight Programme - Goldman Sachs                                          Apr 2025" },
  { text: "- Completed a stock-pitch case study in a team of 5; pitch ranked 2nd of 14 teams." },
  { text: "" },
  { text: "PROJECTS", size: 12, bold: true },
  { text: "UK house price forecasting (Python, scikit-learn) - regression model with 0.82 R-squared on ONS data." },
  { text: "" },
  { text: "SKILLS", size: 12, bold: true },
  { text: "Technical: Python (pandas, NumPy), SQL, R, Excel (VLOOKUP, pivot tables), Tableau, Git" },
  { text: "Languages: English (native), Urdu (fluent), French (conversational)" },
  { text: "Interests: Chess (club captain), half-marathon running, economics podcasts" },
];
