ALTER TABLE `gsec_seed_state` ADD `trade_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `gsec_seed_state` ADD `settlement_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `gsecs` ADD `maturity_date` text DEFAULT '' NOT NULL;