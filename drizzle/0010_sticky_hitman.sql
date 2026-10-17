CREATE TABLE `autopilot_long_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`field_label` text NOT NULL,
	`company` text NOT NULL,
	`text` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `autopilot_long_answers_user_job_label_key` ON `autopilot_long_answers` (`user_id`,`job_id`,`field_label`);