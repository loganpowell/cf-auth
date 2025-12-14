ALTER TABLE `organizations` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `is_active`;--> statement-breakpoint
ALTER TABLE `teams` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` DROP COLUMN `is_active`;--> statement-breakpoint
ALTER TABLE `users` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `is_active`;