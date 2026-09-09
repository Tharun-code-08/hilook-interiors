ALTER TABLE `submissions` ADD `flagged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `flag_reason` text;--> statement-breakpoint
CREATE INDEX `submissions_flagged_idx` ON `submissions` (`flagged`,`created_at`);