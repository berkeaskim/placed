CREATE TABLE `bank_bullets` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`source_ids` text DEFAULT '[]' NOT NULL,
	`source_text` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `bank_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bank_bullets_entry_idx` ON `bank_bullets` (`entry_id`);--> statement-breakpoint
CREATE INDEX `bank_bullets_user_idx` ON `bank_bullets` (`user_id`);--> statement-breakpoint
CREATE TABLE `bank_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`section` text NOT NULL,
	`org` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`dates` text DEFAULT '' NOT NULL,
	`start_ym` text,
	`end_ym` text,
	`location` text DEFAULT '' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`source_ids` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "bank_entries_section_check" CHECK(section in ('experience', 'projects', 'leadership'))
);
--> statement-breakpoint
CREATE INDEX `bank_entries_user_section_idx` ON `bank_entries` (`user_id`,`section`);--> statement-breakpoint
CREATE TABLE `bank_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref` text,
	`raw_text` text DEFAULT '' NOT NULL,
	`imported_at` text NOT NULL,
	CONSTRAINT "bank_sources_kind_check" CHECK(kind in ('cv', 'linkedin_capture', 'linkedin_export', 'linkedin_post', 'manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_sources_kind_ref` ON `bank_sources` (`user_id`,`kind`,`ref`) WHERE ref is not null;--> statement-breakpoint
CREATE TABLE `bank_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_entry_id` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `bank_sources`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bank_suggestions_kind_check" CHECK(kind in ('new_entry', 'merge_into', 'new_bullet')),
	CONSTRAINT "bank_suggestions_status_check" CHECK(status in ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `bank_suggestions_user_status_idx` ON `bank_suggestions` (`user_id`,`status`);