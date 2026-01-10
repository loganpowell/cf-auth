CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`expires_at` integer,
	`scope` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `platform_admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_provider` ON `accounts` (`user_id`,`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`environment` text NOT NULL,
	`permissions` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_api_key_prefix` ON `api_keys` (`key_prefix`);--> statement-breakpoint
CREATE INDEX `idx_api_key_tenant` ON `api_keys` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_api_key_revoked` ON `api_keys` (`revoked_at`);--> statement-breakpoint
CREATE TABLE `platform_admin_tenant_permissions` (
	`admin_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`permission` text NOT NULL,
	`granted_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `platform_admins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_admin_tenant_perm` ON `platform_admin_tenant_permissions` (`admin_id`,`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_admin_perm` ON `platform_admin_tenant_permissions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `idx_tenant_admin` ON `platform_admin_tenant_permissions` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `platform_admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'readonly' NOT NULL,
	`password_hash` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_admins_email_unique` ON `platform_admins` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_platform_admins_email` ON `platform_admins` (`email`);--> statement-breakpoint
CREATE INDEX `idx_platform_admins_role` ON `platform_admins` (`role`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `platform_admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_unique` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_session_token` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE TABLE `tenant_data_schemas` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`version` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`yaml_content` text NOT NULL,
	`yaml_hash` text NOT NULL,
	`compiled_drizzle_types` text,
	`compiled_validators` text,
	`compilation_status` text DEFAULT 'pending' NOT NULL,
	`compilation_error` text,
	`size_kb` real,
	`entity_count` integer,
	`relationship_count` integer,
	`published_at` integer NOT NULL,
	`activated_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_schema_version` ON `tenant_data_schemas` (`tenant_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_schema_active` ON `tenant_data_schemas` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_schema_status` ON `tenant_data_schemas` (`compilation_status`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`depth` integer DEFAULT 0 NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`public_key` text NOT NULL,
	`secret_key` text NOT NULL,
	`branding` text,
	`limits` text,
	`schema_version` text DEFAULT '1.0.0',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_public_key_unique` ON `tenants` (`public_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_secret_key_unique` ON `tenants` (`secret_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tenants_slug` ON `tenants` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_tenants_parent` ON `tenants` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_tenants_status` ON `tenants` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tenants_plan` ON `tenants` (`plan`);--> statement-breakpoint
CREATE INDEX `idx_tenants_depth` ON `tenants` (`depth`);--> statement-breakpoint
CREATE TABLE `usage_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`metric_type` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_metrics_tenant` ON `usage_metrics` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_metrics_type` ON `usage_metrics` (`metric_type`);--> statement-breakpoint
CREATE INDEX `idx_metrics_period` ON `usage_metrics` (`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_verification_token` ON `verification_tokens` (`identifier`,`token`);