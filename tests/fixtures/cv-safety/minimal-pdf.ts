/**
 * Hand-built one-page PDFs for the safety scanner tests. Writing the content stream directly lets a
 * fixture place text exactly where a real attack would (white fill, 1pt font, off the page), which
 * @react-pdf/renderer cannot do without paginating forever.
 */
export function minimalPdf(contentLines: string[], extra: { resources?: string; objects?: string[] } = {}): Uint8Array {
  const content = contentLines.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> ${extra.resources ?? ""} >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ...(extra.objects ?? []), // numbered from 6
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

/** One line of black 11pt Helvetica at (x, y). Strings must not contain parentheses or backslashes. */
export const line = (y: number, s: string, x = 50) => `BT 0 g /F1 11 Tf ${x} ${y} Td (${s}) Tj ET`;

/** A blue gradient fill as Pattern /P0 (object 6): pass to minimalPdf and paint with "/Pattern cs /P0 scn". */
export const gradientPattern = {
  resources: "/Pattern << /P0 6 0 R >>",
  objects: [
    "<< /PatternType 2 /Shading << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 0 595 0] /Function << /FunctionType 2 /Domain [0 1] /C0 [0 0 0.5] /C1 [0 0.5 1] /N 1 >> >> >>",
  ],
};
