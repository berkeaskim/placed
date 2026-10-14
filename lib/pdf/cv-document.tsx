import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ParsedCV, TailoredCV, TailoredEntry } from "@/lib/types";

/**
 * ATS-safe tailored CV (spec §8): one column, standard headings, contact details in the body (not a header/footer),
 * no tables, images or icons. Text is laid out line by line so a parser reads it in order.
 *
 * Font (C22): Noto Sans (SIL OFL 1.1, public/fonts/OFL.txt), vendored so names like "Ayşe" or "Zoë" render and
 * extract correctly; the built-in Helvetica has no glyphs outside WinAnsi. The files are traced into the server
 * bundle via next.config.ts outputFileTracingIncludes.
 */
const FONT_DIR = path.join(process.cwd(), "public", "fonts");
export const CV_FONT_FILES = [path.join(FONT_DIR, "NotoSans-Regular.ttf"), path.join(FONT_DIR, "NotoSans-Bold.ttf")] as const;
const FAMILY = "NotoSans";

let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({ family: FAMILY, fonts: [{ src: CV_FONT_FILES[0], fontWeight: 400 }, { src: CV_FONT_FILES[1], fontWeight: 700 }] });
  // never hyphenate: a split keyword ("Ex-cel") is a lost keyword for a parser
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

/**
 * Noto Sans has no arrows or emoji; a missing glyph would print as a blank box. Arrows become ASCII, pictographs go (except © ® ™).
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[→⇒➔➜➝➞⟶]/g, "->").replace(/[←⇐⟵]/g, "<-").replace(/[↔⇔]/g, "<->")
    .replace(/(?![©®™])[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "") // © ® ™ are in Noto Sans and stay
    .replace(/[ \t]{2,}/g, " ");
}
const t = (x: string | null | undefined) => pdfSafe(x ?? "");

const s = StyleSheet.create({
  page: { paddingVertical: 36, paddingHorizontal: 42, fontSize: 10, fontFamily: FAMILY, lineHeight: 1.35, color: "#111111" },
  name: { fontSize: 18, fontWeight: 700 },
  contact: { marginTop: 2, marginBottom: 6 },
  h: { fontSize: 11, fontWeight: 700, marginTop: 8, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: "#111111", paddingBottom: 1 },
  entry: { marginBottom: 4 },
  bold: { fontWeight: 700 },
  bullet: { marginLeft: 10 },
});

type Contact = Pick<ParsedCV, "name" | "email" | "phone" | "location" | "links">;

const Heading = ({ children }: { children: string }) => <Text style={s.h}>{t(children)}</Text>;
const Bullet = ({ text }: { text: string }) => <Text style={s.bullet}>{`• ${t(text)}`}</Text>;

function Entries({ title, items }: { title: string; items: TailoredEntry[] }) {
  const visible = items.map((e) => ({ ...e, bullets: e.bullets.filter((b) => b.changeType !== "dropped") }));
  if (!visible.length) return null;
  return (
    <View>
      <Heading>{title}</Heading>
      {visible.map((e) => (
        <View key={e.id} style={s.entry}>
          <Text>
            <Text style={s.bold}>{t([e.title, e.org].filter(Boolean).join(", "))}</Text>
            {[e.location, e.dates].filter(Boolean).length ? t(` | ${[e.location, e.dates].filter(Boolean).join(" | ")}`) : ""}
          </Text>
          {e.bullets.map((b) => <Bullet key={b.id} text={b.text} />)}
        </View>
      ))}
    </View>
  );
}

export function CvDocument({ cv, contact }: { cv: TailoredCV; contact: Contact }) {
  const contactLine = t([contact.email, contact.phone, contact.location, ...(contact.links ?? [])].filter(Boolean).join(" | "));
  return (
    <Document title={`${contact.name} CV`} author={contact.name} creator="Placed" producer="Placed">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{t(contact.name)}</Text>
        {contactLine && <Text style={s.contact}>{contactLine}</Text>}
        {cv.summary && <View><Heading>PROFILE</Heading><Text>{t(cv.summary)}</Text></View>}
        {cv.education.length > 0 && (
          <View>
            <Heading>EDUCATION</Heading>
            {cv.education.map((e) => (
              <View key={e.id} style={s.entry}>
                <Text>
                  <Text style={s.bold}>{t(e.institution)}</Text>
                  {e.dates ? t(` | ${e.dates}`) : ""}
                </Text>
                {(e.degree || e.grade) && <Text>{t([e.degree, e.grade].filter(Boolean).join(", "))}</Text>}
                {e.details.map((d) => <Bullet key={d.id} text={d.text} />)}
              </View>
            ))}
          </View>
        )}
        <Entries title="EXPERIENCE" items={cv.experience} />
        <Entries title="PROJECTS" items={cv.projects} />
        <Entries title="LEADERSHIP AND ACTIVITIES" items={cv.leadership} />
        {cv.skills.some((g) => g.items.length) && (
          <View>
            <Heading>SKILLS</Heading>
            {cv.skills.filter((g) => g.items.length).map((g) => (
              <Text key={g.group}><Text style={s.bold}>{t(`${g.group}: `)}</Text>{t(g.items.join(", "))}</Text>
            ))}
          </View>
        )}
        {cv.interests && <View><Heading>INTERESTS</Heading><Text>{t(cv.interests)}</Text></View>}
      </Page>
    </Document>
  );
}

/** Renders a tailored CV. Callers go through lib/tailor/render.ts renderVerifiedPdf, which refuses a blocked verdict. */
export async function renderCvPdf(cv: TailoredCV, contact: Contact): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<CvDocument cv={cv} contact={contact} />);
}
