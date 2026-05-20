CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`old_data` text,
	`new_data` text,
	`ip_address` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `competition_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`digital_rounds_half1` integer DEFAULT 12 NOT NULL,
	`digital_rounds_half2` integer DEFAULT 12 NOT NULL,
	`overtime_enabled` integer DEFAULT true NOT NULL,
	`overtime_type` text DEFAULT 'MR3' NOT NULL,
	`digital_round_win_pts` real DEFAULT 1 NOT NULL,
	`phys_total_rounds` integer DEFAULT 12 NOT NULL,
	`phys_side_switch_round` integer DEFAULT 6 NOT NULL,
	`phys_activation_pts` real DEFAULT 2 NOT NULL,
	`phys_explosion_pts` real DEFAULT 3 NOT NULL,
	`phys_deactivation_pts` real DEFAULT 1 NOT NULL,
	`phys_frag_win_pts` real DEFAULT 1 NOT NULL,
	`digital_weight` real DEFAULT 1 NOT NULL,
	`physical_weight` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_settings_competition_id_unique` ON `competition_settings` (`competition_id`);--> statement-breakpoint
CREATE TABLE `competition_staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`judge_id` integer NOT NULL,
	`staff_role` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `competition_team_officials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comp_team_id` integer NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `competition_team_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comp_team_id` integer NOT NULL,
	`global_player_id` integer,
	`full_name` text NOT NULL,
	`number` integer,
	`position` text,
	`is_reserve` integer DEFAULT false NOT NULL,
	`is_captain` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`global_player_id`) REFERENCES `global_team_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `competition_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`global_team_id` integer,
	`name` text NOT NULL,
	`region` text,
	`snapshot_locked` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`global_team_id`) REFERENCES `global_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`venue` text,
	`planned_participants` integer,
	`format` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `digital_match_team_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`rounds_won` integer DEFAULT 0 NOT NULL,
	`rounds_lost` integer DEFAULT 0 NOT NULL,
	`total_kills` integer DEFAULT 0 NOT NULL,
	`total_deaths` integer DEFAULT 0 NOT NULL,
	`total_points` real DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `digital_round_player_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`digital_round_id` integer NOT NULL,
	`match_player_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`kills` integer DEFAULT 0 NOT NULL,
	`deaths` integer DEFAULT 0 NOT NULL,
	`alive_end` integer DEFAULT true NOT NULL,
	`extra_stats` text,
	FOREIGN KEY (`digital_round_id`) REFERENCES `digital_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_player_id`) REFERENCES `match_team_players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `digital_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`round_number` integer NOT NULL,
	`half` integer DEFAULT 1 NOT NULL,
	`team1_side` text NOT NULL,
	`team2_side` text NOT NULL,
	`team1_deaths` integer DEFAULT 0,
	`team2_deaths` integer DEFAULT 0,
	`activation` integer DEFAULT false NOT NULL,
	`explosion` integer DEFAULT false NOT NULL,
	`deactivation` integer DEFAULT false NOT NULL,
	`result` text,
	`winner_team_id` integer,
	`win_type` text,
	`points_awarded` real DEFAULT 0 NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`extra_data` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`doc_type` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`generated_by` integer,
	`generated_at` text NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `global_team_officials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `global_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `global_team_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`full_name` text NOT NULL,
	`number` integer,
	`position` text,
	`is_reserve` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`team_id`) REFERENCES `global_teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `global_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`region` text,
	`notes` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer,
	`import_type` text NOT NULL,
	`filename` text NOT NULL,
	`file_size` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`rows_total` integer,
	`rows_imported` integer,
	`error_log` text,
	`imported_by` integer,
	`source` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `judges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`category` text,
	`default_role` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `maps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`image_path` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `maps_name_unique` ON `maps` (`name`);--> statement-breakpoint
CREATE TABLE `match_map_veto` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`step_number` integer NOT NULL,
	`action` text NOT NULL,
	`team_slot` integer NOT NULL,
	`map_id` integer,
	`side` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`judge_id` integer NOT NULL,
	`staff_role` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`judge_id`) REFERENCES `judges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_status_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_by` integer,
	`note` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_substitutions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`player_out_id` integer NOT NULL,
	`player_in_id` integer NOT NULL,
	`phase` text NOT NULL,
	`round_number` integer,
	`reason` text,
	`note` text,
	`registered_by` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_out_id`) REFERENCES `match_team_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_in_id`) REFERENCES `match_team_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_team_officials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`full_name` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_team_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`comp_player_id` integer,
	`full_name` text NOT NULL,
	`number` integer,
	`is_reserve` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`played_digital` integer DEFAULT true NOT NULL,
	`played_physical` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comp_player_id`) REFERENCES `competition_team_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`team_slot` integer NOT NULL,
	`digital_start_side` text,
	`physical_start_side` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_violations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`match_player_id` integer,
	`violation_type_id` integer,
	`phase` text DEFAULT 'general' NOT NULL,
	`round_number` integer,
	`penalty_pts` real DEFAULT 0 NOT NULL,
	`note` text,
	`registered_by` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_player_id`) REFERENCES `match_team_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`violation_type_id`) REFERENCES `violation_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`match_number` text,
	`stage` text,
	`scheduled_at` text,
	`expected_viewers` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`winner_team_id` integer,
	`score_digital_team1` real,
	`score_digital_team2` real,
	`score_physical_team1` real,
	`score_physical_team2` real,
	`score_total_team1` real,
	`score_total_team2` real,
	`created_by` integer,
	`approved_by` integer,
	`approved_at` text,
	`locked_by` integer,
	`locked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `physical_round_player_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`physical_round_id` integer NOT NULL,
	`match_player_id` integer NOT NULL,
	`comp_team_id` integer NOT NULL,
	`frags` integer DEFAULT 0 NOT NULL,
	`deaths` integer DEFAULT 0 NOT NULL,
	`extra_stats` text,
	FOREIGN KEY (`physical_round_id`) REFERENCES `physical_rounds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_player_id`) REFERENCES `match_team_players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comp_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `physical_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`round_number` integer NOT NULL,
	`team1_side` text NOT NULL,
	`team2_side` text NOT NULL,
	`frags_team1` integer DEFAULT 0 NOT NULL,
	`frags_team2` integer DEFAULT 0 NOT NULL,
	`activation` integer DEFAULT false NOT NULL,
	`explosion` integer DEFAULT false NOT NULL,
	`deactivation` integer DEFAULT false NOT NULL,
	`win_type` text,
	`winner_team_id` integer,
	`points_awarded` real DEFAULT 0 NOT NULL,
	`penalty_points` real DEFAULT 0 NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`extra_data` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_team_id`) REFERENCES `competition_teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `presence_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`match_id` integer,
	`socket_id` text NOT NULL,
	`current_view` text,
	`is_editing` text,
	`connected_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presence_sessions_socket_id_unique` ON `presence_sessions` (`socket_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'tech_secretary' NOT NULL,
	`pin_hash` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `violation_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article` text NOT NULL,
	`description` text NOT NULL,
	`penalty_pts` real DEFAULT 0 NOT NULL,
	`vtype` text DEFAULT 'other' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
