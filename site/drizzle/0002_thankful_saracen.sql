CREATE TABLE `error_log` (
	`fingerprint` text PRIMARY KEY NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'server' NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`path` text,
	`method` text,
	`actor_id` text,
	`user_agent` text,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `error_log_last_seen_idx` ON `error_log` (`last_seen_at`);