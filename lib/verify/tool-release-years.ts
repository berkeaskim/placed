/**
 * First public release year per tool, for the `temporal` anachronism check (05 §3 check #10).
 * Only years we are confident in; when a tool had a preview and a GA, the EARLIER year is used so the
 * check never blocks a genuine early adopter. Ambiguous names (Gemini, Cursor, Notion, Zoom, Threads,
 * Vercel/ZEIT, Angular vs AngularJS) are deliberately left out.
 */
export type ToolRelease = { name: string; year: number; pattern: RegExp };

const word = (s: string, flags = "i") => new RegExp(`(?<![A-Za-z0-9])(?:${s})(?![A-Za-z0-9])`, flags);

export const TOOL_RELEASE_YEARS: ToolRelease[] = [
  // LLM era
  { name: "ChatGPT", year: 2022, pattern: word("ChatGPT") },
  { name: "GPT-3.5", year: 2022, pattern: word("GPT-?3\\.5") },
  { name: "GPT-4", year: 2023, pattern: word("GPT-?4(?:\\.\\d)?(?:\\s?Turbo)?") },
  { name: "GPT-4o", year: 2024, pattern: word("GPT-?4o") },
  { name: "Claude", year: 2023, pattern: /(?<![A-Za-z])Claude(?![A-Za-z])(?!\s+[A-Z][a-z])/ },
  { name: "Llama", year: 2023, pattern: /(?<![A-Za-z])(?:LLaMA|Llama\s?[234](?:\.\d)?)(?![A-Za-z])/ },
  { name: "Mistral 7B", year: 2023, pattern: word("Mistral\\s?7B") },
  { name: "LangChain", year: 2022, pattern: word("LangChain") },
  { name: "LlamaIndex", year: 2022, pattern: word("LlamaIndex|GPT\\s?Index") },
  { name: "AutoGPT", year: 2023, pattern: word("Auto-?GPT") },
  { name: "Ollama", year: 2023, pattern: word("Ollama") },
  { name: "Stable Diffusion", year: 2022, pattern: word("Stable\\s?Diffusion") },
  { name: "Midjourney", year: 2022, pattern: word("Midjourney") },
  { name: "DALL-E", year: 2021, pattern: word("DALL[-·\\s]?E") },
  { name: "GitHub Copilot", year: 2021, pattern: word("Copilot") },
  { name: "Hugging Face Transformers", year: 2018, pattern: word("Hugging\\s?Face") },
  { name: "BERT", year: 2018, pattern: /(?<![A-Za-z])BERT(?![A-Za-z])/ },
  // ML / data
  { name: "TensorFlow", year: 2015, pattern: word("TensorFlow") },
  { name: "Keras", year: 2015, pattern: word("Keras") },
  { name: "PyTorch", year: 2016, pattern: word("PyTorch") },
  { name: "JAX", year: 2018, pattern: /(?<![A-Za-z])JAX(?![A-Za-z])/ },
  { name: "Polars", year: 2020, pattern: word("Polars") },
  { name: "Streamlit", year: 2019, pattern: word("Streamlit") },
  { name: "dbt", year: 2016, pattern: /(?<![A-Za-z])dbt(?![A-Za-z])/ },
  { name: "Airflow", year: 2015, pattern: word("Airflow") },
  { name: "Snowflake", year: 2014, pattern: /(?<![A-Za-z])Snowflake(?![A-Za-z])(?!\s+schema)/ },
  { name: "Databricks", year: 2013, pattern: word("Databricks") },
  { name: "Power BI", year: 2014, pattern: word("Power\\s?BI") },
  { name: "Microsoft Fabric", year: 2023, pattern: word("Microsoft Fabric") },
  // Web / app
  { name: "React Hooks", year: 2019, pattern: word("(?:React\\s)?Hooks", "") },
  { name: "Next.js App Router", year: 2022, pattern: word("App Router|Next\\.?js\\s?1[3-9]") },
  { name: "Next.js", year: 2016, pattern: word("Next\\.?js") },
  { name: "Svelte", year: 2016, pattern: word("Svelte") },
  { name: "Tailwind CSS", year: 2017, pattern: word("Tailwind") },
  { name: "Vite", year: 2020, pattern: /(?<![A-Za-z])Vite(?![A-Za-z])/ },
  { name: "Bun", year: 2022, pattern: /(?<![A-Za-z])Bun(?:\.js|\s+runtime)(?![A-Za-z])/ },
  { name: "Deno", year: 2018, pattern: /(?<![A-Za-z])Deno(?![A-Za-z])/ },
  { name: "Supabase", year: 2020, pattern: word("Supabase") },
  { name: "FastAPI", year: 2018, pattern: word("FastAPI") },
  { name: "GraphQL", year: 2015, pattern: word("GraphQL") },
  { name: "React Native", year: 2015, pattern: word("React Native") },
  { name: "Flutter", year: 2017, pattern: /(?<![A-Za-z])Flutter(?![A-Za-z])/ },
  { name: "Figma", year: 2016, pattern: word("Figma") },
  // Languages / platforms / infra
  { name: "Swift", year: 2014, pattern: /(?<![A-Za-z])Swift(?![A-Za-z])/ },
  { name: "SwiftUI", year: 2019, pattern: word("SwiftUI") },
  { name: "Kotlin", year: 2016, pattern: word("Kotlin") },
  { name: "Jetpack Compose", year: 2021, pattern: word("Jetpack Compose") },
  { name: "Rust", year: 2015, pattern: /(?<![A-Za-z])Rust(?![A-Za-z])/ },
  { name: "visionOS", year: 2023, pattern: word("visionOS|Vision Pro") },
  { name: "Docker", year: 2013, pattern: word("Docker") },
  { name: "Kubernetes", year: 2014, pattern: word("Kubernetes|k8s") },
  { name: "Terraform", year: 2014, pattern: word("Terraform") },
  { name: "Slack", year: 2013, pattern: /(?<![A-Za-z])Slack(?![A-Za-z])/ },
  { name: "Microsoft Teams", year: 2017, pattern: word("(?:Microsoft|MS) Teams") },
  { name: "TikTok", year: 2016, pattern: word("TikTok") },
  { name: "Instagram Reels", year: 2020, pattern: word("(?:Instagram\\s)?Reels") },
];
