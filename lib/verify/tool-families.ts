/**
 * Sibling tool families for `siblingContamination` (05 §3 check #4).
 * A member named in a tailored bullet must appear in one of its cited source bullets;
 * swapping one sibling for another (AWS → Azure) is the dominant fabrication mode (F12-H2).
 *
 * `terms` are matched as whole tokens. `caseSensitive` members match only as written, which keeps
 * common English words out ("react to", "excel at", "a rough sketch").
 */
export type FamilyMember = { name: string; terms: string[]; caseSensitive?: boolean; exactTerms?: string[]; pattern?: RegExp };
export type ToolFamily = { family: string; members: FamilyMember[] };

/** `exactTerms` always match case-sensitively, for generic words that are tools only when capitalised ("Node"). */
const m = (name: string, terms: string[] = [], caseSensitive = false, exactTerms: string[] = []): FamilyMember =>
  ({ name, terms: [name, ...terms], caseSensitive, exactTerms });

/** A bare "R" is a language only after a tool word or in a list ("used R", "in R", "R and Python", "R Studio"). */
function r(): FamilyMember {
  return { name: "R", terms: ["RStudio", "R Studio"], caseSensitive: true, exactTerms: [],
    pattern: /(?:\b(?:[Uu]sed|[Uu]sing|[Uu]se|[Ii]n|[Ww]ith|and|or|via)\s+|[,/(]\s*)R(?![A-Za-z0-9&+#'’.-])|(?<![A-Za-z0-9])R(?=\s*(?:,|\/|\band\b|\bor\b)\s*(?:Python|SQL|MATLAB|Stata|Excel|SPSS|Julia))|\bR\s+(?:programming|language|script|scripts|package|packages|Studio|Markdown)\b/ };
}
/** A bare "C" is a language only in the same kind of tool context ("in C", "C and Python"). */
function cLang(): FamilyMember {
  return { name: "C", terms: [], caseSensitive: true, exactTerms: [],
    pattern: /(?:\b(?:[Uu]sed|[Uu]sing|[Ii]n|[Ww]ith|and|or)\s+|[,/(]\s*)C(?![A-Za-z0-9&+#'’.-])(?!\s*(?:grade|level|class))|\bC\s+(?:programming|language)\b/ };
}

export const TOOL_FAMILIES: ToolFamily[] = [
  { family: "cloud", members: [m("AWS", ["Amazon Web Services"]), m("GCP", ["Google Cloud", "Google Cloud Platform"]), m("Azure", ["Microsoft Azure"])] },
  { family: "deep-learning", members: [m("PyTorch"), m("TensorFlow"), m("JAX", [], true), m("Keras")] },
  { family: "frontend-framework", members: [m("React", ["React.js", "ReactJS"], true), m("Vue", ["Vue.js", "VueJS"]), m("Angular", ["AngularJS"], true), m("Svelte", ["SvelteKit"])] },
  { family: "bi", members: [m("Tableau"), m("Power BI", ["PowerBI"]), m("Looker", ["Looker Studio", "Google Data Studio"]), m("Qlik", ["QlikView", "Qlik Sense"])] },
  { family: "spreadsheet", members: [m("Excel", ["MS Excel", "Microsoft Excel"], true), m("Google Sheets", ["GSheets"])] },
  { family: "sql-database", members: [m("PostgreSQL", ["Postgres"]), m("MySQL"), m("SQL Server", ["MSSQL", "MS SQL"]), m("Oracle", ["Oracle DB", "Oracle Database"], true),
    m("SQLite"), m("BigQuery"), m("Snowflake", [], true), m("Redshift")] },
  { family: "nosql-database", members: [m("MongoDB"), m("DynamoDB"), m("Firestore", ["Firebase"]), m("Cassandra"), m("Cosmos DB", ["CosmosDB"])] },
  { family: "jvm-language", members: [m("Java", [], true), m("Kotlin"), m("Scala", [], true)] },
  { family: "ci", members: [m("GitHub Actions"), m("GitLab CI", ["GitLab CI/CD"]), m("Jenkins", [], true), m("CircleCI"), m("Travis CI")] },
  { family: "container", members: [m("Docker"), m("Podman")] },
  { family: "design", members: [m("Figma"), m("Sketch", [], true), m("Adobe XD")] },
  { family: "python-web", members: [m("Django"), m("Flask", [], true), m("FastAPI")] },
  { family: "js-runtime", members: [m("Node.js", ["NodeJS"], false, ["Node"]), m("Deno", [], true), m("Bun.js")] },
  { family: "dataframe", members: [m("Pandas", [], false), m("Polars"), m("PySpark")] },
  { family: "iac", members: [m("Terraform"), m("CloudFormation"), m("Pulumi")] },
  { family: "llm-provider", members: [m("OpenAI", ["GPT-3.5", "GPT-4", "GPT-4o", "ChatGPT"]), m("Anthropic", ["Claude API"]), m("Gemini API"), m("Llama", ["LLaMA"], true), m("Mistral", [], true)] },
  { family: "crm", members: [m("Salesforce"), m("HubSpot")] },
  { family: "stats-package", members: [m("SPSS"), m("Stata", [], true), m("SAS", [], true)] },
  { family: "market-data", members: [m("Bloomberg", [], true), m("Refinitiv", ["Eikon", "LSEG Workspace"]), m("FactSet"), m("Capital IQ", ["CapIQ"])] },
  { family: "project-tracker", members: [m("Jira"), m("Trello"), m("Asana", [], true)] },
  { family: "mobile-cross-platform", members: [m("Flutter", [], true), m("React Native", [], true)] },
  // audit 05 #18: programming-language and adjacent swaps ("Used Python" → "Used R") were invisible
  // Python stays out: pandas/NumPy lines that gain the word "Python" are honest, and skillInjection already guards it
  { family: "general-language", members: [r(), m("MATLAB", [], true), m("Julia", [], true), m("Stata", [], true), m("SAS", [], true)] },
  { family: "systems-language", members: [m("C++", ["CPP"]), m("C#", ["CSharp"]), m("Rust", [], true), m("Go", ["Golang"], true), cLang()] },
  { family: "js-language", members: [m("JavaScript"), m("TypeScript")] },
  { family: "notebook", members: [m("Jupyter", ["Jupyter Notebook", "JupyterLab"]), m("Google Colab", ["Colab"])] },
  { family: "analytics", members: [m("Google Analytics", ["GA4"]), m("Adobe Analytics"), m("Mixpanel"), m("Amplitude", [], true)] },
  { family: "email-marketing", members: [m("Mailchimp"), m("Klaviyo"), m("HubSpot")] },
  { family: "accounting-standard", members: [m("IFRS"), m("US GAAP", ["GAAP"])] },
  { family: "valuation-method", members: [m("DCF", ["discounted cash flow"]), m("LBO", ["leveraged buyout"]), m("comps", ["comparable company analysis", "comparable companies", "trading comps"]), m("precedent transactions")] },
];
