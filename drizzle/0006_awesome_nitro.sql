PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`ats` text NOT NULL,
	`api_host` text,
	`employer` text,
	`transport` text,
	`enabled` integer DEFAULT true NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	`added_at` text,
	CONSTRAINT "companies_ats_check" CHECK(ats in ('greenhouse', 'lever', 'ashby', 'workday', 'smartrecruiters', 'oracle', 'amazon', 'goldmansachs', 'morganstanley', 'bankofamerica', 'deutschebank', 'eightfold', 'phenom', 'apple', 'mckinsey', 'curated')),
	CONSTRAINT "companies_transport_check" CHECK(transport is null or transport in ('stealth'))
);
--> statement-breakpoint
INSERT INTO `__new_companies`("id", "slug", "name", "ats", "api_host", "employer", "transport", "enabled", "source", "added_at") SELECT "id", "slug", "name", "ats", "api_host", "employer", "transport", "enabled", "source", "added_at" FROM `companies`;--> statement-breakpoint
DROP TABLE `companies`;--> statement-breakpoint
ALTER TABLE `__new_companies` RENAME TO `companies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `companies_ats_slug_key` ON `companies` (`ats`,`slug`);