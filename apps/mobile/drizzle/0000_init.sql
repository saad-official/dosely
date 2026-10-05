CREATE TABLE `doses` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`due_at` text NOT NULL,
	`window_ends_at` text NOT NULL,
	`taken_at` text,
	`skipped_at` text,
	`snoozed_until` text,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `doses_due_idx` ON `doses` (`due_at`);--> statement-breakpoint
CREATE INDEX `doses_med_due_idx` ON `doses` (`medication_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `doses_updated_idx` ON `doses` (`updated_at`);--> statement-breakpoint
CREATE TABLE `escalations_sent` (
	`dose_id` text PRIMARY KEY NOT NULL,
	`notified_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`strength` text,
	`form` text NOT NULL,
	`instructions` text,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`schedule_json` text NOT NULL,
	`window_minutes` integer DEFAULT 60 NOT NULL,
	`inventory_count` real,
	`refill_threshold` real,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `medications_profile_idx` ON `medications` (`profile_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`initial` text NOT NULL,
	`is_self` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`table_name` text PRIMARY KEY NOT NULL,
	`pushed_up_to` text,
	`pulled_at` text,
	`updated_at` text NOT NULL
);
