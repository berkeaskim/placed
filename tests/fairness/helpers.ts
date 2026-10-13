import { readFileSync } from "node:fs";
import path from "node:path";

export const BASES = ["swe", "data", "consulting", "finance"] as const;
export type Base = (typeof BASES)[number];

export function loadBase(base: Base): string {
  return readFileSync(path.resolve(process.cwd(), "tests/fairness/fixtures", `${base}.txt`), "utf8");
}

export interface Persona {
  name: string;
  email: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

/** T1/T2 personas. Every field leaks the name in a realistic way. */
export const PERSONAS: Record<string, Persona> = {
  james: { name: "James Smith", email: "james.smith@gmail.com", linkedin: "james-smith-4b2a91", github: "jamessmith", portfolio: "jamessmith.dev" },
  oluwaseun: {
    name: "Oluwaseun Adebayo",
    email: "oluwaseun.adebayo@gmail.com",
    linkedin: "oluwaseun-adebayo",
    github: "oadebayo",
    portfolio: "https://oluwaseunadebayo.dev",
  },
  mohammed: { name: "Mohammed Rahman", email: "m.rahman22@outlook.com", linkedin: "mohammed-rahman-ucl", github: "mrahman", portfolio: "mohammedrahman.github.io" },
  zhang: { name: "Zhang Wei", email: "zhang.wei@student.ac.uk", linkedin: "zhangwei", github: "zwei-dev", portfolio: "www.zhangwei.co.uk/projects" },
  siobhan: { name: "Siobhan O'Neill", email: "siobhan.oneill@gmail.com", linkedin: "siobhan-o-neill", github: "soneill", portfolio: "siobhanoneill.vercel.app" },
  hyphenated: {
    name: "Amara Okafor-Williams",
    email: "amara.okafor-williams@gmail.com",
    linkedin: "amara-okafor-williams",
    github: "aokaforwilliams",
    portfolio: "okaforwilliams.dev",
  },
  // Collision names: tokens that are also employers, places or tech (J.P. Morgan, University of York, Ruby).
  rubyMorgan: { name: "Ruby Morgan", email: "ruby.morgan@gmail.com", linkedin: "ruby-morgan-uk", github: "rmorgan", portfolio: "rubymorgan.dev" },
  samYork: { name: "Sam York", email: "sam.york@outlook.com", linkedin: "samyork", github: "syork", portfolio: "samyork.netlify.app" },
  single: { name: "Nandini", email: "nandini.k@gmail.com", linkedin: "nandini-k", github: "nandinik", portfolio: "nandini.dev" },
};

export interface Slots {
  persona: Persona;
  ADDRESS: string;
  PHONE: string;
  WORKAUTH: string;
  SOCIETY: string;
  EXTRA: string;
  UNIVERSITY: string;
}

export const DEFAULTS: Slots = {
  persona: PERSONAS.james,
  ADDRESS: "12 Kensington Court, London W8 5DL",
  PHONE: "+44 7700 900123",
  WORKAUTH: "Right to work: British citizen",
  SOCIETY: "Chess Society",
  EXTRA: "",
  UNIVERSITY: "University College London",
};

/** Fill a fixture template. An empty EXTRA removes its whole line. */
export function fill(template: string, over: Partial<Slots> = {}): string {
  const s = { ...DEFAULTS, ...over };
  const p = s.persona;
  const values: Record<string, string> = {
    NAME: p.name,
    EMAIL: p.email,
    LINKEDIN: p.linkedin,
    GITHUB: p.github,
    PORTFOLIO: p.portfolio,
    ADDRESS: s.ADDRESS,
    PHONE: s.PHONE,
    WORKAUTH: s.WORKAUTH,
    SOCIETY: s.SOCIETY,
    UNIVERSITY: s.UNIVERSITY,
    EXTRA: s.EXTRA,
  };
  const t = s.EXTRA ? template : template.replace(/\{\{EXTRA\}\}\n/g, "");
  return t.replace(/\{\{([A-Z]+)\}\}/g, (_m, k: string) => {
    if (!(k in values)) throw new Error(`unknown slot ${k}`);
    return values[k];
  });
}
