CREATE TABLE `holidays` (
	`date` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` real NOT NULL,
	`month` real NOT NULL,
	`day` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `holidays_year_idx` ON `holidays` (`year`);--> statement-breakpoint
CREATE INDEX `holidays_month_idx` ON `holidays` (`month`);--> statement-breakpoint
CREATE INDEX `holidays_year_month_idx` ON `holidays` (`year`,`month`);--> statement-breakpoint
CREATE TABLE `instruments` (
	`instrument_token` real PRIMARY KEY NOT NULL,
	`exchange_token` text NOT NULL,
	`tradingsymbol` text NOT NULL,
	`name` text NOT NULL,
	`expiry` text,
	`strike` real,
	`tick_size` real,
	`lot_size` real,
	`instrument_type` text,
	`segment` text,
	`exchange` text,
	`dv` real,
	`av` real
);
--> statement-breakpoint
CREATE INDEX `name_idx` ON `instruments` (`name`);--> statement-breakpoint
CREATE INDEX `expiry_idx` ON `instruments` (`expiry`);--> statement-breakpoint
CREATE TABLE `stock_bans` (
	`name` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`ban_date` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stock_bans_type_idx` ON `stock_bans` (`type`);--> statement-breakpoint
CREATE INDEX `stock_bans_ban_date_idx` ON `stock_bans` (`ban_date`);