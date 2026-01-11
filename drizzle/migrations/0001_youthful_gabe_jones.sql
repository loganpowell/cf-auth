CREATE TABLE `tenant_user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `tenant_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_user_sessions_session_token_unique` ON `tenant_user_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_tenant_session_token` ON `tenant_user_sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_tenant_session_user` ON `tenant_user_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `tenant_users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`username` text,
	`password_hash` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`name` text,
	`avatar` text,
	`metadata` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenant_user_email` ON `tenant_users` (`tenant_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_tenant_users_tenant` ON `tenant_users` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant_users_status` ON `tenant_users` (`status`);