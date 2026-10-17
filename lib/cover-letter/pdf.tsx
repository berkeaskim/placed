import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { FONT_FAMILY, pdfSafe, registerFonts } from "@/lib/pdf/cv-document";
import { safeNamePart } from "@/lib/autopilot/handoff";

/**
 * A4 one-page cover letter PDF (Noto Sans 11pt) that Autopilot uploads into application forms.
 * `body` already holds the salutation, paragraphs and sign-off (the service appends the student's name), so it is
 * rendered as given; the header is built from the other fields and the name is not repeated at the bottom.
 */
const s = StyleSheet.create({
  page: { paddingVertical: 54, paddingHorizontal: 60, fontSize: 11, fontFamily: FONT_FAMILY, lineHeight: 1.4, color: "#111111" },
  name: { fontSize: 16, fontWeight: 700 },
  contact: { marginTop: 2 },
  date: { marginTop: 22 },
  ref: { marginTop: 10, fontWeight: 700 },
  para: { marginTop: 10 },
});

export type LetterPdfInput = {
  name: string; email: string; phone: string | null; linkedin: string | null;
  date: Date; company: string; ref: string | null; role: string; body: string;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export async function renderLetterPdf(i: LetterPdfInput): Promise<Buffer> {
  registerFonts();
  const contact = pdfSafe([i.email, i.phone, i.linkedin].filter(Boolean).join(" | "));
  const refLine = pdfSafe(`Ref: ${i.role}${i.ref ? ` (${i.ref})` : ""}`);
  const paragraphs = i.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return renderToBuffer(
    <Document title={pdfSafe(`${i.name} cover letter, ${i.company}`)} author={pdfSafe(i.name)} creator="Placed" producer="Placed">
      <Page size="A4" style={s.page}>
        <View>
          <Text style={s.name}>{pdfSafe(i.name)}</Text>
          {contact && <Text style={s.contact}>{contact}</Text>}
        </View>
        <Text style={s.date}>{DATE_FORMAT.format(i.date)}</Text>
        <Text style={s.ref}>{refLine}</Text>
        {paragraphs.map((p, k) => <Text key={k} style={s.para}>{pdfSafe(p)}</Text>)}
      </Page>
    </Document>,
  );
}

/** `First-Last_Cover-Letter_Company_YYYY-MM.pdf`, each name part through the same sanitiser Autopilot's handoff uses. */
export function letterFilename(first: string, last: string, company: string, date: Date): string {
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${safeNamePart(first, "Name")}-${safeNamePart(last, "Name")}_Cover-Letter_${safeNamePart(company, "Company")}_${ym}.pdf`;
}
