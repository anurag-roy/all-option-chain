DROP INDEX `gsecs_tradingsymbol_unique`;--> statement-breakpoint
ALTER TABLE `gsecs` ADD `exchange` text DEFAULT 'NSE' NOT NULL;--> statement-breakpoint
ALTER TABLE `gsecs` ADD `tick_size` real DEFAULT 0.01 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `gsecs_exchange_symbol_unique` ON `gsecs` (`exchange`,`tradingsymbol`);