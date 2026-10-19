/** Known organisations, shared by the tailoring checks (fix 2) and multi-employer ingest (employer names). */
export type KnownEmployer = { name: string; aliases?: string[]; caseSensitive?: boolean };
const E = (name: string, aliases: string[] = [], caseSensitive = false): KnownEmployer => ({ name, aliases, caseSensitive });
/**
 * Known organisations (fix 2), matched in any case unless `caseSensitive` (names that are also English words).
 * Big banks, Big 4, MBB, big tech, top trading firms, plus every company in seed/companies.yml (a test enforces it).
 */
export const KNOWN_EMPLOYERS: KnownEmployer[] = [
  // banks
  E("Goldman Sachs", ["Goldman"]), E("JPMorgan", ["JP Morgan", "J.P. Morgan", "J P Morgan", "JPMorgan Chase", "JPMC"]), E("Morgan Stanley"),
  E("Barclays"), E("HSBC"), E("Citi", [], true), E("Citigroup"), E("Deutsche Bank"), E("UBS"), E("BNP Paribas"), E("Bank of America", ["BofA"]),
  E("Lloyds Banking Group", ["Lloyds"]), E("NatWest"), E("Santander"), E("Nomura"), E("Credit Suisse"), E("Lazard"), E("Rothschild"), E("Evercore"),
  E("Jefferies"), E("RBC"), E("Macquarie"), E("Societe Generale", ["SocGen"]), E("Standard Chartered"), E("Wells Fargo"), E("Mizuho"),
  E("Bank of England"),
  // Big 4 and consulting
  E("Deloitte"), E("PwC", ["PricewaterhouseCoopers"]), E("EY", ["Ernst & Young", "Ernst and Young"], true), E("KPMG"),
  E("McKinsey", ["McKinsey & Company"]), E("BCG", ["Boston Consulting Group"]), E("Bain", ["Bain & Company"], true), E("Accenture"),
  E("Oliver Wyman"), E("Kearney"), E("Roland Berger"), E("Capgemini"),
  // big tech
  E("Google", ["Alphabet", "DeepMind", "Google DeepMind"]), E("Meta", ["Facebook"], true), E("Amazon", [], true), E("Apple", [], true),
  E("Netflix"), E("Microsoft"), E("Nvidia"), E("Tesla"), E("Uber"), E("OpenAI"), E("IBM"), E("Revolut"), E("Bloomberg"),
  // trading / funds
  E("Jane Street"), E("Citadel"), E("Citadel Securities"), E("Two Sigma"), E("Optiver"), E("Hudson River Trading", ["HRT"]), E("Susquehanna", ["SIG"]),
  E("Millennium"), E("Squarepoint"), E("Qube"), E("XTX Markets", ["XTX"]), E("Bridgewater"), E("Vanguard"), E("Fidelity"),
  // seed/companies.yml
  E("incident.io"), E("AIG"), E("Airbnb"), E("Anduril"), E("Anthropic"), E("Aquatic Capital Management"), E("Atoms", [], true), E("Attio"),
  E("BlackRock"), E("Blackstone"), E("BlockTech"), E("Brex"), E("Capco"), E("Capital Group", [], true), E("Capstone Investment Advisors"),
  E("Celonis"), E("Chicago Trading Company"), E("Cirrus Logic"), E("Cleo", [], true), E("Cohere", [], true), E("Cushman & Wakefield"), E("DRW"),
  E("DV Trading"), E("Databricks"), E("Datadog"), E("Deliveroo"), E("ElevenLabs"), E("Equinor"), E("FTI Consulting"), E("Faculty", [], true),
  E("Fever", [], true), E("Figma"), E("Financial Conduct Authority", ["FCA"]), E("Financial Technology Partners"), E("Flow Traders"), E("Form3"),
  E("Freshfields"), E("GSA Capital"), E("GSK"), E("GoCardless"), E("Graham Capital Management"), E("Guggenheim Securities", ["Guggenheim"]),
  E("Harrison Street", [], true), E("Houlihan Lokey"), E("Howden"), E("IMC Trading", ["IMC"]), E("Improbable", [], true), E("Intercom", [], true),
  E("Isidor"), E("Isomorphic Labs"), E("JLL"), E("Jump Trading"), E("KKR"), E("LSEG", ["London Stock Exchange Group"]), E("Lendable"),
  E("Linear", [], true), E("Lottie", [], true), E("MUFG"), E("Man Group"), E("Marshall Wace"), E("Marshmallow", [], true), E("Maven Securities"),
  E("Mercury", [], true), E("Miro"), E("Monzo"), E("Multiverse", [], true), E("Notion", [], true), E("Nova Founders Capital"), E("OakNorth"),
  E("PGIM"), E("PJT Partners"), E("Palantir"), E("Parloa"), E("Payhawk"), E("Plaid", [], true), E("Pleo"), E("Point72"), E("PolyAI"),
  E("Poolside", [], true), E("Quadrature Capital", ["Quadrature"]), E("Quantexa"), E("Ramp", [], true), E("Riverlane"), E("Rothesay"),
  E("Scale AI"), E("Schonfeld"), E("Shell", [], true), E("Snowflake", [], true), E("Sophos"), E("Spotify"), E("Stability AI"), E("Stripe", [], true),
  E("SumUp"), E("Synthesia"), E("TD Securities"), E("Talos", [], true), E("Thought Machine"), E("Tide", [], true), E("Tower Research Capital", ["Tower Research"]),
  E("Tractable", [], true), E("Trainline"), E("UNIQLO"), E("UiPath"), E("Vercel"), E("Verkada"), E("Viridien"), E("Virtu Financial", ["Virtu"]),
  E("Wayve"), E("Wellington Management"), E("Wise", [], true), E("Xantium"), E("Zilch", [], true), E("Zopa"), E("iSAM"), E("Econic Partners"),
  E("Lloyds"),
  // fix round 2: employers whose names look like ordinary words (-er/-ers/-ian/-ing) at sentence start
  E("Unilever"), E("Mercer"), E("Linklaters"), E("Boeing"), E("Schroders"), E("Gartner"), E("Experian"), E("Ocado"), E("Slaughter and May", [], true),
  // fix round 4: tool companies that also employ graduates
  E("Tableau"), E("Salesforce"),
  // seed/companies.yml additions (2026-10-14 coverage audit)
  E("Squarepoint Capital"), E("Qube Research & Technologies"), E("Forvis Mazars", ["Mazars"]), E("Ocado Group"), E("NatWest Group"),
  E("Brevan Howard"), E("PIMCO"), E("S&P Global"), E("M&G"), E("Aviva"), E("Mastercard"), E("Visa", [], true),
  E("Marsh McLennan", ["Marsh & McLennan"]), E("Norton Rose Fulbright"), E("Hogan Lovells"), E("White & Case", [], true),
  E("Procter & Gamble", ["P&G"]), E("Mars", [], true), E("Mondelez", ["Mondelez International"]), E("Diageo"), E("NVIDIA"),
  E("Intel", [], true), E("Cisco"), E("Adobe", [], true), E("Sky", [], true), E("AstraZeneca"), E("BP", [], true), E("Rolls-Royce"),
  E("Clifford Chance"), E("PA Consulting", [], true), E("Legal & General"), E("ASOS"),
  // placement-year boards (2026-10-18) and the EDT curated card
  E("Airbus"), E("GE Aerospace"), E("Caterpillar"), E("Northrop Grumman"), E("HP", [], true), E("Hewlett Packard Enterprise", ["HPE"]),
  E("Pfizer"), E("Sanofi"), E("Roche"), E("MSD", [], true), E("Johnson & Johnson", ["J&J"]), E("Year in Industry (EDT)", ["Engineering Development Trust"]), E("TargetJobs"),
];
