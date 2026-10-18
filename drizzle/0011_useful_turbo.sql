DROP INDEX `cv_scores_cv_id_sector_key`;--> statement-breakpoint
DROP INDEX `cv_scores_cache_idx`;--> statement-breakpoint
ALTER TABLE `cv_scores` ADD `track` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cv_scores_cv_id_sector_track_key` ON `cv_scores` (`cv_id`,`sector`,`track`);--> statement-breakpoint
CREATE INDEX `cv_scores_cache_idx` ON `cv_scores` (`user_id`,`sector`,`track`,`text_hash`,`model_id`,`prompt_version`,`rules_version`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `grad_year` integer;