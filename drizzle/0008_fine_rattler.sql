CREATE TABLE `company_research` (
	`id` text PRIMARY KEY NOT NULL,
	`company_key` text NOT NULL,
	`facts` text DEFAULT '[]' NOT NULL,
	`rivals` text DEFAULT '[]' NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` text NOT NULL,
	CONSTRAINT "company_research_provider_check" CHECK(provider in ('gemini', 'serper', 'none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_research_company_key_key` ON `company_research` (`company_key`);--> statement-breakpoint
CREATE TABLE `cover_letter_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`letter_id` text NOT NULL,
	`target` text NOT NULL,
	`mode` text NOT NULL,
	`limit` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`spans` text DEFAULT '[]' NOT NULL,
	`lint` text DEFAULT '[]' NOT NULL,
	`undo` text DEFAULT '[]' NOT NULL,
	`pdf_path` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`letter_id`) REFERENCES `cover_letters`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cover_letter_outputs_status_check" CHECK(status in ('draft', 'ready'))
);
--> statement-breakpoint
CREATE INDEX `cover_letter_outputs_letter_idx` ON `cover_letter_outputs` (`letter_id`);--> statement-breakpoint
CREATE TABLE `cover_letter_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cv_entry_id` text,
	`company` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_used_at` text,
	CONSTRAINT "cover_letter_stories_kind_check" CHECK(kind in ('story', 'why_firm'))
);
--> statement-breakpoint
CREATE INDEX `cover_letter_stories_user_idx` ON `cover_letter_stories` (`user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `cover_letters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`chat` text DEFAULT '[]' NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`facts` text DEFAULT '[]' NOT NULL,
	`evidence` text,
	`research_state` text DEFAULT 'idle' NOT NULL,
	`draft_state` text DEFAULT 'idle' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cover_letters_research_state_check" CHECK(research_state in ('idle', 'running', 'done', 'none', 'failed')),
	CONSTRAINT "cover_letters_draft_state_check" CHECK(draft_state in ('idle', 'streaming', 'done', 'interrupted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cover_letters_user_id_job_id_key` ON `cover_letters` (`user_id`,`job_id`);