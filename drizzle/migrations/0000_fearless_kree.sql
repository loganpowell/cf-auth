CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE TABLE `email_verification_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_verification_tokens_token_unique` ON `email_verification_tokens` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_email_verification_token` ON `email_verification_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_email_verification_user` ON `email_verification_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_providers` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`provider_username` text,
	`provider_email` text,
	`access_token` text,
	`refresh_token` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pk_oauth_providers` ON `oauth_providers` (`user_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_oauth_provider_user` ON `oauth_providers` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organizations_slug` ON `organizations` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_organizations_owner` ON `organizations` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_unique` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_password_reset_token` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `idx_password_reset_user` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `permission_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`target_user_id` text,
	`role_id` text,
	`organization_id` text,
	`team_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_permission_audit_actor` ON `permission_audit` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_permission_audit_target` ON `permission_audit` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `idx_permission_audit_org` ON `permission_audit` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_permission_audit_created` ON `permission_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_user` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_hash` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`organization_id` text,
	`team_id` text,
	`granted_by` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_role_assignments_user` ON `role_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_role_assignments_role` ON `role_assignments` (`role_id`);--> statement-breakpoint
CREATE INDEX `idx_role_assignments_org` ON `role_assignments` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_role_assignments_team` ON `role_assignments` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_role_assignments_unique` ON `role_assignments` (`user_id`,`role_id`,`organization_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions_low` text DEFAULT '0' NOT NULL,
	`permissions_high` text DEFAULT '0' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`organization_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_roles_org` ON `roles` (`organization_id`);--> statement-breakpoint
CREATE INDEX `idx_roles_system` ON `roles` (`is_system`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_teams_org` ON `teams` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_teams_slug` ON `teams` (`organization_id`,`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);