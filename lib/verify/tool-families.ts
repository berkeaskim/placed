/**
 * Sibling tool families for `siblingContamination` (05 §3 check #4).
 * A member named in a tailored bullet must appear in one of its cited source bullets;
 * swapping one sibling for another (AWS → Azure) is the dominant fabrication mode (F12-H2).
 *
 * `terms` are matched as whole tokens. `caseSensitive` members match only as written, which keeps
 * common English words out ("react to", "excel at", "a rough sketch").
 */
export type FamilyMember = { name: string; terms: string[]; caseSensitive?: boolean; exactTerms?: string[] };
export type ToolFamily = { family: string; members: FamilyMember[] };

/** `exactTerms` always match case-sensitively, for generic words that are tools only when capitalised ("Node"). */
const m = (name: string, terms: string[] = [], caseSensitive = false, exactTerms: string[] = []): FamilyMember =>
  ({ name, terms: [name, ...terms], caseSensitive, exactTerms });

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
];
