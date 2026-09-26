START TRANSACTION;
CREATE TABLE `auth_events` (
    `id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `user_id` varchar(255) CHARACTER SET utf8mb4 NULL,
    `email` varchar(256) CHARACTER SET utf8mb4 NULL,
    `ip_address` varchar(45) CHARACTER SET utf8mb4 NULL,
    `user_agent` varchar(512) CHARACTER SET utf8mb4 NULL,
    `event_type` int NOT NULL,
    `success` tinyint(1) NOT NULL,
    `failure_reason` varchar(120) CHARACTER SET utf8mb4 NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_auth_events` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE INDEX `ix_auth_events_created_at` ON `auth_events` (`created_at`);

CREATE INDEX `ix_auth_events_type_created` ON `auth_events` (`event_type`, `created_at`);

CREATE INDEX `ix_auth_events_user_id` ON `auth_events` (`user_id`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924140454_AddAuthEvents', '9.0.0');

ALTER TABLE `AspNetUsers` ADD `TwoFactorSecret` longtext CHARACTER SET utf8mb4 NULL;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924142256_AddMfaSecret', '9.0.0');

UPDATE `auth_events` SET `email` = CONCAT(LEFT(`email`, 1), '***@', SUBSTRING(`email`, LOCATE('@', `email`) + 1)) WHERE `email` IS NOT NULL   AND `email` <> ''   AND LOCATE('@', `email`) > 1   AND LOCATE('***@', `email`) = 0;

UPDATE `auth_events` SET `ip_address` = REGEXP_REPLACE(`ip_address`, '[0-9]+$', '***') WHERE `ip_address` IS NOT NULL   AND `ip_address` <> ''   AND `ip_address` NOT LIKE '%***'   AND LOCATE(':', `ip_address`) = 0   AND `ip_address` REGEXP '^[0-9.]+$';

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924170736_MaskOldAuthEventsPii', '9.0.0');

CREATE TABLE `DataProtectionKeys` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `FriendlyName` longtext CHARACTER SET utf8mb4 NULL,
    `Xml` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_DataProtectionKeys` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924172319_AddDataProtectionKeys', '9.0.0');

ALTER TABLE `ideas` DROP INDEX `IX_ideas_category_id`;

CREATE INDEX `ix_ideas_category_submitted` ON `ideas` (`category_id`, `submitted_at`);

CREATE INDEX `ix_ideas_province_submitted` ON `ideas` (`province_id`, `submitted_at`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924175614_OptimizeIdeaIndexes', '9.0.0');

ALTER TABLE `AspNetUsers` ADD `TwoFactorMethod` int NOT NULL DEFAULT 0;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924231618_AddTwoFactorMethod', '9.0.0');

CREATE TABLE `gmail_refresh_tokens` (
    `Id` int NOT NULL,
    `EncryptedRefreshToken` text CHARACTER SET utf8mb4 NOT NULL,
    `UpdatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_gmail_refresh_tokens` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260926225829_AddGmailRefreshToken_v2', '9.0.0');

CREATE TABLE IF NOT EXISTS `gmail_refresh_tokens` (`Id` int NOT NULL,`EncryptedRefreshToken` text NOT NULL,`UpdatedAt` datetime(6) NOT NULL,PRIMARY KEY (`Id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260926230000_AddGmailRefreshToken', '9.0.0');

COMMIT;

