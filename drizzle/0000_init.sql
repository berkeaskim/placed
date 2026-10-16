CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`tailored_json` text,
	`tailored_cv_path` text,
	`verify_report` text,
	`updated_at` text NOT NULL,
	`next_deadline` text,
	`last_event_at` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "applications_status_check" CHECK(status in ('saved', 'applied', 'interview', 'offer', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `applications_job_idx` ON `applications` (`job_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_user_id_job_id_key` ON `applications` (`user_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `autopilot_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`form` text NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`token_hash` text,
	`token_expires_at` text,
	`token_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "autopilot_packs_status_check" CHECK(status in ('draft', 'ready', 'claimed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `autopilot_packs_token_hash_unique` ON `autopilot_packs` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `autopilot_packs_user_id_job_id_key` ON `autopilot_packs` (`user_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `autopilot_vault` (
	`user_id` text PRIMARY KEY NOT NULL,
	`core` text DEFAULT '{}' NOT NULL,
	`extra` text DEFAULT '{}' NOT NULL,
	`completed_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`user_id` text NOT NULL,
	`badge_key` text NOT NULL,
	`earned_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `badge_key`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`ats` text NOT NULL,
	`api_host` text,
	`enabled` integer DEFAULT true NOT NULL,
	CONSTRAINT "companies_ats_check" CHECK(ats in ('greenhouse', 'lever', 'ashby', 'workday', 'smartrecruiters'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_ats_slug_key` ON `companies` (`ats`,`slug`);--> statement-breakpoint
CREATE TABLE `confirmed_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`claim` text NOT NULL,
	`source` text DEFAULT 'user-stated' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `confirmed_facts_user_idx` ON `confirmed_facts` (`user_id`);--> statement-breakpoint
CREATE TABLE `cv_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cv_id` text,
	`rule_id` text NOT NULL,
	`sector` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cv_feedback_user_idx` ON `cv_feedback` (`user_id`);--> statement-breakpoint
CREATE INDEX `cv_feedback_cv_idx` ON `cv_feedback` (`cv_id`);--> statement-breakpoint
CREATE TABLE `cv_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`cv_id` text NOT NULL,
	`user_id` text NOT NULL,
	`sector` text NOT NULL,
	`total` integer NOT NULL,
	`dimensions` text NOT NULL,
	`caps_applied` text DEFAULT '[]' NOT NULL,
	`rule_results` text NOT NULL,
	`fixes` text DEFAULT '[]' NOT NULL,
	`text_hash` text,
	`model_id` text,
	`prompt_version` text,
	`rules_version` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cv_id`) REFERENCES `cvs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cv_scores_user_idx` ON `cv_scores` (`user_id`);--> statement-breakpoint
CREATE INDEX `cv_scores_cv_idx` ON `cv_scores` (`cv_id`);--> statement-breakpoint
CREATE INDEX `cv_scores_cache_idx` ON `cv_scores` (`user_id`,`sector`,`text_hash`,`model_id`,`prompt_version`,`rules_version`);--> statement-breakpoint
CREATE UNIQUE INDEX `cv_scores_cv_id_sector_key` ON `cv_scores` (`cv_id`,`sector`);--> statement-breakpoint
CREATE TABLE `cvs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`page_count` integer NOT NULL,
	`raw_text` text NOT NULL,
	`page_texts` text DEFAULT '[]' NOT NULL,
	`parsed_json` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cvs_user_idx` ON `cvs` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cvs_one_active_per_user` ON `cvs` (`user_id`) WHERE is_active = 1;--> statement-breakpoint
CREATE TABLE `ingest_state` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interview_preps` (
	`company_id` integer NOT NULL,
	`role_key` text NOT NULL,
	`pack` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	`grounded` integer NOT NULL,
	`model_id` text NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`company_id`, `role_key`),
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interview_preps_created_by_idx` ON `interview_preps` (`created_by`,`created_at`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` integer NOT NULL,
	`ext_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`remote` integer DEFAULT false NOT NULL,
	`deadline` text,
	`posted_at` text,
	`archetype` text,
	`field_tags` text DEFAULT '[]' NOT NULL,
	`year_eligibility` text DEFAULT '[]' NOT NULL,
	`sponsors_visa` text DEFAULT 'unknown' NOT NULL,
	`employment_type` text DEFAULT 'internship' NOT NULL,
	`first_year_friendly` integer DEFAULT false NOT NULL,
	`cohort_clash` integer DEFAULT false NOT NULL,
	`requirements` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`raw_html` text DEFAULT '' NOT NULL,
	`text_lines` text DEFAULT '[]' NOT NULL,
	`fingerprint` text,
	`content_hash` text,
	`tag_status` text DEFAULT 'pending' NOT NULL,
	`is_live` integer DEFAULT true NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`deadline_source` text,
	`rolling` integer DEFAULT false NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "jobs_sponsors_visa_check" CHECK(sponsors_visa in ('yes', 'no', 'unknown')),
	CONSTRAINT "jobs_tag_status_check" CHECK(tag_status in ('ok', 'failed', 'pending')),
	CONSTRAINT "jobs_deadline_source_check" CHECK(deadline_source is null or deadline_source in ('ats', 'text'))
);
--> statement-breakpoint
CREATE INDEX `jobs_live_idx` ON `jobs` (`is_live`,`deadline`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_company_id_ext_id_key` ON `jobs` (`company_id`,`ext_id`);--> statement-breakpoint
CREATE TABLE `linkedin_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sector` text NOT NULL,
	`year` text NOT NULL,
	`total` integer NOT NULL,
	`label` text NOT NULL,
	`dimensions` text NOT NULL,
	`caps_applied` text DEFAULT '[]' NOT NULL,
	`fixes` text DEFAULT '[]' NOT NULL,
	`rule_results` text DEFAULT '[]' NOT NULL,
	`tips` text DEFAULT '[]' NOT NULL,
	`meta` text DEFAULT '{}' NOT NULL,
	`profile_json` text NOT NULL,
	`text_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `linkedin_scores_user_sector` ON `linkedin_scores` (`user_id`,`sector`,`created_at`);--> statement-breakpoint
CREATE TABLE `matches` (
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`explanation_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `job_id`),
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `outreach` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`application_id` text,
	`job_id` text,
	`company` text NOT NULL,
	`target` text NOT NULL,
	`recipient_name` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'drafted' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "outreach_target_check" CHECK(target in ('alumni', 'recent_joiner', 'team', 'recruiter')),
	CONSTRAINT "outreach_status_check" CHECK(status in ('drafted', 'sent', 'replied')),
	CONSTRAINT "outreach_recipient_name_check" CHECK(recipient_name is null or length(recipient_name) <= 60),
	CONSTRAINT "outreach_body_check" CHECK(length(body) <= 4000)
);
--> statement-breakpoint
CREATE INDEX `outreach_user_job` ON `outreach` (`user_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `playbook_progress` (
	`user_id` text NOT NULL,
	`action_id` text NOT NULL,
	`status` text NOT NULL,
	`evidence_note` text,
	`evidence_url` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `action_id`),
	CONSTRAINT "playbook_progress_action_id_check" CHECK(action_id GLOB 'PB-[A-Z]*-[A-Z][0-9]*'),
	CONSTRAINT "playbook_progress_status_check" CHECK(status in ('planned', 'done')),
	CONSTRAINT "playbook_progress_evidence_url_check" CHECK(evidence_url is null or evidence_url GLOB 'https://*'),
	CONSTRAINT "done_needs_evidence" CHECK(status <> 'done' or length(trim(coalesce(evidence_note, ''))) >= 10)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`year` text,
	`field` text,
	`location_pref` text DEFAULT '[]' NOT NULL,
	`needs_visa` integer DEFAULT false NOT NULL,
	`target_archetype` text,
	`archetypes` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`onboarded` integer DEFAULT false NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`streak_days` integer DEFAULT 0 NOT NULL,
	`last_active_date` text,
	`created_at` text NOT NULL,
	CONSTRAINT "profiles_year_check" CHECK(year is null or year in ('1st', '2nd', 'penultimate', 'final', 'masters'))
);
--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`xp` integer NOT NULL,
	`job_id` text,
	`ref` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `xp_events_user_idx` ON `xp_events` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `xp_events_once_per_job` ON `xp_events` (`user_id`,`type`,`job_id`) WHERE job_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `xp_events_once_per_user` ON `xp_events` (`user_id`,`type`) WHERE type in ('onboarding_complete', 'cv_uploaded', 'quiz_done', 'autopilot_ready');--> statement-breakpoint
CREATE UNIQUE INDEX `xp_events_once_per_ref` ON `xp_events` (`user_id`,`type`,`ref`) WHERE ref is not null;