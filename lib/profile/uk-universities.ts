/** Pure (no database): safe to import from client components. */

/** UK universities and degree-awarding colleges, by the name students and LinkedIn use for them. */
export const UK_UNIVERSITIES: readonly string[] = [
  "Aberystwyth University", "Anglia Ruskin University", "Arts University Bournemouth", "Arts University Plymouth", "Aston University",
  "Bangor University", "Bath Spa University", "Bayes Business School", "Birkbeck, University of London", "Birmingham City University",
  "Bishop Grosseteste University", "Bournemouth University", "BPP University", "Brunel University of London", "Buckinghamshire New University",
  "Canterbury Christ Church University", "Cardiff Metropolitan University", "Cardiff University", "City St George's, University of London",
  "Coventry University", "Cranfield University", "De Montfort University", "Durham University", "Edge Hill University",
  "Edinburgh Napier University", "Falmouth University", "Glasgow Caledonian University", "Goldsmiths, University of London",
  "Harper Adams University", "Hartpury University", "Heriot-Watt University", "Imperial College London", "Keele University",
  "King's College London", "Kingston University", "Lancaster University", "Leeds Arts University", "Leeds Beckett University",
  "Leeds Conservatoire", "Leeds Trinity University", "Liverpool Hope University", "Liverpool John Moores University",
  "London Business School", "London Metropolitan University", "London School of Economics and Political Science",
  "London School of Hygiene & Tropical Medicine", "London South Bank University", "Loughborough University", "Manchester Metropolitan University",
  "Middlesex University", "Newcastle University", "Newman University", "Northeastern University London", "Northumbria University",
  "Norwich University of the Arts", "Nottingham Trent University", "Oxford Brookes University", "Plymouth Marjon University",
  "Queen Margaret University", "Queen Mary University of London", "Queen's University Belfast", "Ravensbourne University London",
  "Regent's University London", "Robert Gordon University", "Royal Academy of Music", "Royal Agricultural University",
  "Royal College of Art", "Royal College of Music", "Royal Conservatoire of Scotland", "Royal Holloway, University of London",
  "Royal Northern College of Music", "Royal Veterinary College", "Sheffield Hallam University", "SOAS University of London",
  "Solent University", "St Mary's University, Twickenham", "Staffordshire University", "Swansea University", "Teesside University",
  "The Open University", "University College Birmingham", "University College London", "University for the Creative Arts",
  "University of Aberdeen", "University of Bath", "University of Bedfordshire", "University of Birmingham", "University of Bolton",
  "University of Bradford", "University of Brighton", "University of Bristol", "University of Buckingham", "University of Cambridge",
  "University of Central Lancashire", "University of Chester", "University of Chichester", "University of Cumbria", "University of Derby",
  "University of Dundee", "University of East Anglia", "University of East London", "University of Edinburgh", "University of Essex",
  "University of Exeter", "University of Glasgow", "University of Gloucestershire", "University of Greenwich", "University of Hertfordshire",
  "University of the Highlands and Islands", "University of Huddersfield", "University of Hull", "University of Kent", "University of Law",
  "University of Leeds", "University of Leicester", "University of Lincoln", "University of Liverpool", "University of London",
  "University of Manchester", "University of Northampton", "University of Nottingham", "University of Oxford", "University of Plymouth",
  "University of Portsmouth", "University of Reading", "University of Roehampton", "University of Salford", "University of Sheffield",
  "University of South Wales", "University of Southampton", "University of St Andrews", "University of Stirling", "University of Strathclyde",
  "University of Suffolk", "University of Sunderland", "University of Surrey", "University of Sussex", "University of the Arts London",
  "University of the West of England", "University of the West of Scotland", "University of Wales Trinity Saint David",
  "University of Warwick", "University of West London", "University of Westminster", "University of Winchester", "University of Wolverhampton",
  "University of Worcester", "University of York", "Ulster University", "Wrexham University", "Writtle University College", "York St John University",
];

/** Short names people type: "UCL" should find University College London. */
const ALIASES: Record<string, string> = {
  ucl: "University College London", lse: "London School of Economics and Political Science", kcl: "King's College London",
  kings: "King's College London", imperial: "Imperial College London", icl: "Imperial College London", qmul: "Queen Mary University of London",
  "queen mary": "Queen Mary University of London", rhul: "Royal Holloway, University of London", soas: "SOAS University of London",
  lshtm: "London School of Hygiene & Tropical Medicine", lbs: "London Business School", uea: "University of East Anglia",
  uel: "University of East London", uwe: "University of the West of England", uws: "University of the West of Scotland",
  ual: "University of the Arts London", ljmu: "Liverpool John Moores University", mmu: "Manchester Metropolitan University",
  ntu: "Nottingham Trent University", uclan: "University of Central Lancashire", qub: "Queen's University Belfast",
  oxford: "University of Oxford", cambridge: "University of Cambridge", city: "City St George's, University of London",
  cass: "Bayes Business School", brunel: "Brunel University of London", goldsmiths: "Goldsmiths, University of London",
  birkbeck: "Birkbeck, University of London", "st andrews": "University of St Andrews", ou: "The Open University", rca: "Royal College of Art",
  durham: "Durham University", warwick: "University of Warwick", lancaster: "Lancaster University", loughborough: "Loughborough University",
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Words that appear in most names and say nothing about which school is meant. */
const FILLER = new Set(["university", "of", "the", "london", "college"]);

/** Best matches for what the student typed: alias hits first, then names where every typed word starts a word of the name. */
export function searchUniversities(query: string, limit = 8): string[] {
  const q = norm(query);
  if (!q) return [];
  const out: string[] = [];
  const add = (n: string) => { if (!out.includes(n)) out.push(n); };
  for (const [alias, name] of Object.entries(ALIASES)) if (alias === q || (q.length >= 3 && alias.startsWith(q))) add(name);
  const words = q.split(" ");
  const scored = UK_UNIVERSITIES.map((name) => {
    const n = norm(name);
    const tokens = n.split(" ");
    if (!words.every((w) => tokens.some((t) => t.startsWith(w)))) return null;
    // A distinctive word ("bristol") ranks above a filler one ("university") that matches everything.
    const strong = words.some((w) => !FILLER.has(w) && tokens.some((t) => !FILLER.has(t) && t.startsWith(w)));
    return { name, rank: strong ? 0 : 1 };
  }).filter((x): x is { name: string; rank: number } => !!x);
  // Shorter first among equals: "University of Edinburgh" before "Edinburgh Napier University".
  scored.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name));
  for (const s of scored) add(s.name);
  return out.slice(0, limit);
}

/** The listed name for what the student typed, when it is exactly one of ours (or an alias); else null. */
export function canonicalUniversity(input: string): string | null {
  const q = norm(input);
  if (!q) return null;
  return ALIASES[q] ?? UK_UNIVERSITIES.find((n) => norm(n) === q) ?? null;
}
