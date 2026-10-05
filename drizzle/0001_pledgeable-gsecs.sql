CREATE TABLE `gsec_seed_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`seeded_date` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gsecs` (
	`instrument_token` integer PRIMARY KEY NOT NULL,
	`tradingsymbol` text NOT NULL,
	`isin` text NOT NULL,
	`coupon` integer NOT NULL,
	`maturity_year` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gsecs_tradingsymbol_unique` ON `gsecs` (`tradingsymbol`);