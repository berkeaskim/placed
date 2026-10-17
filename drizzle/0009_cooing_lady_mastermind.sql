ALTER TABLE `autopilot_packs` ADD `suggestions` text;--> statement-breakpoint
ALTER TABLE `autopilot_packs` ADD `drafts` text DEFAULT '{}' NOT NULL;