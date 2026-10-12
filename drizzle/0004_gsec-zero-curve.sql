CREATE TABLE `gsec_curve_seed_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`seeded_date` text NOT NULL,
	`attempted_at` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `gsec_curve_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_date` text NOT NULL,
	`available_from` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gsec_curve_reference_idx` ON `gsec_curve_snapshots` (`reference_date`);