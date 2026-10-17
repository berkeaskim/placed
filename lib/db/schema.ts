import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Archetype, ArchetypeScore, ParsedCV, Region, Requirement, Year } from "../types";

/**
 * SQLite port of supabase/migrations 0001–0015 (minus gmail_connections / inbox_events, and 0016's auth_attempts).
 * Column keys are the SQL snake_case names so rows keep the shape the Supabase-era code expects.
 * uuid → text, timestamptz/date → ISO text, jsonb and arrays → json text, boolean → 0/1 integer.
 */

const uuid = (name: string) => text(name).$defaultFn(() => crypto.randomUUID());
const now = (name: string) => text(name).$defaultFn(() => new Date().toISOString());
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
const bool = (name: string) => integer(name, { mode: "boolean" });
const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const YEAR_VALUES = ["1st", "2nd", "penultimate", "final", "masters"] as const;
export const APP_STATUS_VALUES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export const ATS_VALUES = ["greenhouse", "lever", "ashby", "workday", "smartrecruiters", "oracle", "amazon", "curated"] as const;
/** Fetch transports other than plain fetch; null = plain. "stealth" routes through the opt-in recon sidecar. */
export const TRANSPORT_VALUES = ["stealth"] as const;
export const SPONSORS_VISA_VALUES = ["yes", "no", "unknown"] as const;
export const TAG_STATUS_VALUES = ["ok", "failed", "pending"] as const;
export const DEADLINE_SOURCE_VALUES = ["ats", "text"] as const;
export const PLAYBOOK_STATUS_VALUES = ["planned", "done"] as const;
export const PACK_STATUS_VALUES = ["draft", "ready", "claimed"] as const;
export const OUTREACH_TARGET_VALUES = ["alumni", "recent_joiner", "team", "recruiter"] as const;
export const OUTREACH_STATUS_VALUES = ["drafted", "sent", "replied"] as const;
/** xp_events types that are earned once per user (xp_events_once_per_user, 0012). */
export const ONCE_PER_USER_XP = ["onboarding_complete", "cv_uploaded", "quiz_done", "autopilot_ready"] as const;

export type AtsKind = (typeof ATS_VALUES)[number];
export type PackStatus = (typeof PACK_STATUS_VALUES)[number];
export type OutreachTarget = (typeof OUTREACH_TARGET_VALUES)[number];
export type OutreachStatus = (typeof OUTREACH_STATUS_VALUES)[number];

export const profiles = sqliteTable("profiles", {
  user_id: text("user_id").primaryKey(),
  display_name: text("display_name"),
  year: text("year", { enum: YEAR_VALUES }).$type<Year>(),
  /** Broad field (one of FIELDS), derived from `course`; drives grouping and anywhere a category is enough. */
  field: text("field"),
  /** The course as the student named it ("BSc Economics and Statistics"); what AI prompts get. */
  course: text("course"),
  /** The student's university as they want it named (Settings); null = read it from the active CV. */
  university: text("university"),
  location_pref: json<Region[]>("location_pref").notNull().default(sql`'[]'`),
  needs_visa: bool("needs_visa").notNull().default(false),
  target_archetype: text("target_archetype").$type<Archetype>(),
  archetypes: json<ArchetypeScore[]>("archetypes").notNull().default(sql`'[]'`),
  skills: json<string[]>("skills").notNull().default(sql`'[]'`),
  onboarded: bool("onboarded").notNull().default(false),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak_days: integer("streak_days").notNull().default(0),
  last_active_date: text("last_active_date"),
  created_at: now("created_at").notNull(),
}, () => [check("profiles_year_check", sql`year is null or ${inList("year", YEAR_VALUES)}`)]);

export const cvs = sqliteTable("cvs", {
  id: uuid("id").primaryKey(),
  user_id: text("user_id").notNull(),
  storage_path: text("storage_path").notNull(),
  file_size: integer("file_size").notNull(),
  page_count: integer("page_count").notNull(),
  raw_text: text("raw_text").notNull(),
  page_texts: json<string[]>("page_texts").notNull().default(sql`'[]'`),
  parsed_json: json<ParsedCV>("parsed_json").notNull(),
  is_active: bool("is_active").notNull().default(true),
  uploaded_at: now("uploaded_at").notNull(),
}, (t) => [
  index("cvs_user_idx").on(t.user_id),
  uniqueIndex("cvs_one_active_per_user").on(t.user_id).where(sql`is_active = 1`),
]);

export const cvScores = sqliteTable("cv_scores", {
  id: uuid("id").primaryKey(),
  cv_id: text("cv_id").notNull().references(() => cvs.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull(),
  sector: text("sector").notNull(),
  total: integer("total").notNull(),
  dimensions: json<unknown>("dimensions").notNull(),
  caps_applied: json<string[]>("caps_applied").notNull().default(sql`'[]'`),
  rule_results: json<unknown>("rule_results").notNull(),
  fixes: json<unknown[]>("fixes").notNull().default(sql`'[]'`),
  text_hash: text("text_hash"),
  model_id: text("model_id"),
  prompt_version: text("prompt_version"),
  rules_version: text("rules_version"),
  created_at: now("created_at").notNull(),
}, (t) => [
  unique("cv_scores_cv_id_sector_key").on(t.cv_id, t.sector),
  index("cv_scores_user_idx").on(t.user_id),
  index("cv_scores_cv_idx").on(t.cv_id),
  index("cv_scores_cache_idx").on(t.user_id, t.sector, t.text_hash, t.model_id, t.prompt_version, t.rules_version),
]);

export const cvFeedback = sqliteTable("cv_feedback", {
  id: uuid("id").primaryKey(),
  user_id: text("user_id").notNull(),
  cv_id: text("cv_id").references(() => cvs.id, { onDelete: "cascade" }),
  rule_id: text("rule_id").notNull(),
  sector: text("sector").notNull(),
  created_at: now("created_at"),
}, (t) => [index("cv_feedback_user_idx").on(t.user_id), index("cv_feedback_cv_idx").on(t.cv_id)]);

export const confirmedFacts = sqliteTable("confirmed_facts", {
  id: uuid("id").primaryKey(),
  user_id: text("user_id").notNull(),
  claim: text("claim").notNull(),
  source: text("source").notNull().default("user-stated"),
  created_at: now("created_at").notNull(),
}, (t) => [index("confirmed_facts_user_idx").on(t.user_id)]);

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  ats: text("ats", { enum: ATS_VALUES }).notNull(),
  api_host: text("api_host"),
  /** Employer key shared by boards of one employer (e.g. a live board and its curated cards); null = the slug is the employer. */
  employer: text("employer"),
  transport: text("transport", { enum: TRANSPORT_VALUES }),
  enabled: bool("enabled").notNull().default(true),
  /** "seed" (seed/companies.yml) or "discovered" (added by the AI company search, lib/ingest/discover.ts). */
  source: text("source").notNull().default("seed"),
  added_at: text("added_at"),
}, (t) => [
  unique("companies_ats_slug_key").on(t.ats, t.slug),
  check("companies_ats_check", inList("ats", ATS_VALUES)),
  check("companies_transport_check", sql`transport is null or ${inList("transport", TRANSPORT_VALUES)}`),
]);

export const jobs = sqliteTable("jobs", {
  id: uuid("id").primaryKey(),
  company_id: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  ext_id: text("ext_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  location: text("location").notNull().default(""),
  remote: bool("remote").notNull().default(false),
  deadline: text("deadline"),
  posted_at: text("posted_at"),
  /** YYYY-MM-DD the application window opens (curated programme cards); null for live boards. */
  opens_on: text("opens_on"),
  archetype: text("archetype").$type<Archetype>(),
  field_tags: json<string[]>("field_tags").notNull().default(sql`'[]'`),
  year_eligibility: json<Year[]>("year_eligibility").notNull().default(sql`'[]'`),
  sponsors_visa: text("sponsors_visa", { enum: SPONSORS_VISA_VALUES }).notNull().default("unknown"),
  employment_type: text("employment_type").notNull().default("internship"),
  first_year_friendly: bool("first_year_friendly").notNull().default(false),
  cohort_clash: bool("cohort_clash").notNull().default(false),
  requirements: json<Requirement[]>("requirements").notNull().default(sql`'[]'`),
  skills: json<string[]>("skills").notNull().default(sql`'[]'`),
  summary: text("summary").notNull().default(""),
  raw_html: text("raw_html").notNull().default(""),
  text_lines: json<string[]>("text_lines").notNull().default(sql`'[]'`),
  fingerprint: text("fingerprint"),
  content_hash: text("content_hash"),
  tag_status: text("tag_status", { enum: TAG_STATUS_VALUES }).notNull().default("pending"),
  is_live: bool("is_live").notNull().default(true),
  first_seen: now("first_seen").notNull(),
  last_seen: now("last_seen").notNull(),
  deadline_source: text("deadline_source", { enum: DEADLINE_SOURCE_VALUES }),
  rolling: bool("rolling").notNull().default(false),
  closed_at: text("closed_at"),
}, (t) => [
  unique("jobs_company_id_ext_id_key").on(t.company_id, t.ext_id),
  index("jobs_live_idx").on(t.is_live, t.deadline),
  check("jobs_sponsors_visa_check", inList("sponsors_visa", SPONSORS_VISA_VALUES)),
  check("jobs_tag_status_check", inList("tag_status", TAG_STATUS_VALUES)),
  check("jobs_deadline_source_check", sql`deadline_source is null or ${inList("deadline_source", DEADLINE_SOURCE_VALUES)}`),
]);

export const matches = sqliteTable("matches", {
  user_id: text("user_id").notNull(),
  job_id: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  explanation_json: json<unknown>("explanation_json").notNull(),
  created_at: now("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.user_id, t.job_id] })]);

export const applications = sqliteTable("applications", {
  id: uuid("id").primaryKey(),
  user_id: text("user_id").notNull(),
  job_id: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  status: text("status", { enum: APP_STATUS_VALUES }).notNull().default("saved"),
  tailored_json: json<unknown>("tailored_json"),
  tailored_cv_path: text("tailored_cv_path"),
  verify_report: json<unknown>("verify_report"),
  updated_at: now("updated_at").notNull(),
  next_deadline: text("next_deadline"),
  last_event_at: text("last_event_at"),
}, (t) => [
  unique("applications_user_id_job_id_key").on(t.user_id, t.job_id),
  index("applications_job_idx").on(t.job_id),
  check("applications_status_check", inList("status", APP_STATUS_VALUES)),
]);

export const xpEvents = sqliteTable("xp_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull(),
  type: text("type").notNull(),
  xp: integer("xp").notNull(),
  job_id: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
  ref: text("ref"),
  created_at: now("created_at").notNull(),
}, (t) => [
  index("xp_events_user_idx").on(t.user_id),
  uniqueIndex("xp_events_once_per_job").on(t.user_id, t.type, t.job_id).where(sql`job_id is not null`),
  uniqueIndex("xp_events_once_per_user").on(t.user_id, t.type).where(inList("type", ONCE_PER_USER_XP)),
  uniqueIndex("xp_events_once_per_ref").on(t.user_id, t.type, t.ref).where(sql`ref is not null`),
]);

export const badges = sqliteTable("badges", {
  user_id: text("user_id").notNull(),
  badge_key: text("badge_key").notNull(),
  earned_at: now("earned_at").notNull(),
}, (t) => [primaryKey({ columns: [t.user_id, t.badge_key] })]);

export const ingestState = sqliteTable("ingest_state", {
  id: integer("id").primaryKey().default(1),
  cursor: integer("cursor").notNull().default(0),
  updated_at: now("updated_at").notNull(),
});

/** action_id looks like PB-DAT-P01 (Postgres checked a regex; GLOB is the closest SQLite has). */
export const playbookProgress = sqliteTable("playbook_progress", {
  user_id: text("user_id").notNull(),
  action_id: text("action_id").notNull(),
  status: text("status", { enum: PLAYBOOK_STATUS_VALUES }).notNull(),
  evidence_note: text("evidence_note"),
  evidence_url: text("evidence_url"),
  updated_at: now("updated_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.user_id, t.action_id] }),
  check("playbook_progress_action_id_check", sql`action_id GLOB 'PB-[A-Z]*-[A-Z][0-9]*'`),
  check("playbook_progress_status_check", inList("status", PLAYBOOK_STATUS_VALUES)),
  check("playbook_progress_evidence_url_check", sql`evidence_url is null or evidence_url GLOB 'https://*'`),
  check("done_needs_evidence", sql`status <> 'done' or length(trim(coalesce(evidence_note, ''))) >= 10`),
]);

/** core/extra hold the sealed vault ({ $enc }) from lib/autopilot/vault-crypto.ts. */
export const autopilotVault = sqliteTable("autopilot_vault", {
  user_id: text("user_id").primaryKey(),
  core: json<unknown>("core").notNull().default(sql`'{}'`),
  extra: json<unknown>("extra").notNull().default(sql`'{}'`),
  completed_at: text("completed_at"),
  updated_at: now("updated_at").notNull(),
});

export const autopilotPacks = sqliteTable("autopilot_packs", {
  id: uuid("id").primaryKey(),
  user_id: text("user_id").notNull(),
  job_id: text("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  form: json<unknown>("form").notNull(),
  answers: json<Record<string, unknown>>("answers").notNull().default(sql`'{}'`),
  status: text("status", { enum: PACK_STATUS_VALUES }).notNull().default("draft"),
  token_hash: text("token_hash").unique(),
  token_expires_at: text("token_expires_at"),
  token_used_at: text("token_used_at"),
  created_at: now("created_at").notNull(),
}, (t) => [
  unique("autopilot_packs_user_id_job_id_key").on(t.user_id, t.job_id),
  check("autopilot_packs_status_check", inList("status", PACK_STATUS_VALUES)),
]);

export const outreach = sqliteTable("outreach", {
  id: uuid("id").primaryKey(),
  user_id: text("user_id").notNull(),
  application_id: text("application_id").references(() => applications.id, { onDelete: "set null" }),
  job_id: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
  company: text("company").notNull(),
  target: text("target", { enum: OUTREACH_TARGET_VALUES }).notNull(),
  recipient_name: text("recipient_name"),
  body: text("body").notNull(),
  status: text("status", { enum: OUTREACH_STATUS_VALUES }).notNull().default("drafted"),
  created_at: now("created_at").notNull(),
  updated_at: now("updated_at").notNull(),
}, (t) => [
  index("outreach_user_job").on(t.user_id, t.job_id),
  check("outreach_target_check", inList("target", OUTREACH_TARGET_VALUES)),
  check("outreach_status_check", inList("status", OUTREACH_STATUS_VALUES)),
  check("outreach_recipient_name_check", sql`recipient_name is null or length(recipient_name) <= 60`),
  check("outreach_body_check", sql`length(body) <= 4000`),
]);

export const linkedinScores = sqliteTable("linkedin_scores", {
  id: uuid("id").primaryKey(),
  user_id: text("user_id").notNull(),
  sector: text("sector").notNull(),
  year: text("year").notNull(),
  total: integer("total").notNull(),
  label: text("label").notNull(),
  dimensions: json<unknown>("dimensions").notNull(),
  caps_applied: json<string[]>("caps_applied").notNull().default(sql`'[]'`),
  fixes: json<unknown[]>("fixes").notNull().default(sql`'[]'`),
  rule_results: json<unknown[]>("rule_results").notNull().default(sql`'[]'`),
  tips: json<unknown[]>("tips").notNull().default(sql`'[]'`),
  meta: json<Record<string, unknown>>("meta").notNull().default(sql`'{}'`),
  profile_json: json<unknown>("profile_json").notNull(),
  text_hash: text("text_hash").notNull(),
  created_at: now("created_at").notNull(),
}, (t) => [index("linkedin_scores_user_sector").on(t.user_id, t.sector, t.created_at)]);

export const interviewPreps = sqliteTable("interview_preps", {
  company_id: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  role_key: text("role_key").notNull(),
  pack: json<unknown>("pack").notNull(),
  sources: json<unknown[]>("sources").notNull().default(sql`'[]'`),
  grounded: bool("grounded").notNull(),
  model_id: text("model_id").notNull(),
  created_by: text("created_by"),
  created_at: now("created_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.company_id, t.role_key] }),
  index("interview_preps_created_by_idx").on(t.created_by, t.created_at),
]);

/** Local app settings (AI provider, model overrides, ...). Secrets live under `secret.<key>`, sealed (lib/settings/store.ts). */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: now("updated_at"),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Cv = typeof cvs.$inferSelect;
export type NewCv = typeof cvs.$inferInsert;
export type CvScore = typeof cvScores.$inferSelect;
export type NewCvScore = typeof cvScores.$inferInsert;
export type CvFeedback = typeof cvFeedback.$inferSelect;
export type ConfirmedFact = typeof confirmedFacts.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type XpEvent = typeof xpEvents.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type IngestState = typeof ingestState.$inferSelect;
export type PlaybookProgress = typeof playbookProgress.$inferSelect;
export type AutopilotVault = typeof autopilotVault.$inferSelect;
export type AutopilotPack = typeof autopilotPacks.$inferSelect;
export type NewAutopilotPack = typeof autopilotPacks.$inferInsert;
export type Outreach = typeof outreach.$inferSelect;
export type NewOutreach = typeof outreach.$inferInsert;
export type LinkedinScore = typeof linkedinScores.$inferSelect;
export type NewLinkedinScore = typeof linkedinScores.$inferInsert;
export type InterviewPrep = typeof interviewPreps.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
