ALTER TABLE `profiles` ADD `work_auth` text;--> statement-breakpoint
UPDATE `profiles` SET `work_auth` = 'student_visa' WHERE `needs_visa` = 1;
