CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
    `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
    `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK___EFMigrationsHistory` PRIMARY KEY (`MigrationId`)
) CHARACTER SET=utf8mb4;

START TRANSACTION;
ALTER DATABASE CHARACTER SET utf8mb4;

CREATE TABLE `AspNetRoles` (
    `Id` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `Name` varchar(256) CHARACTER SET utf8mb4 NULL,
    `NormalizedName` varchar(256) CHARACTER SET utf8mb4 NULL,
    `ConcurrencyStamp` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetRoles` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `AspNetUsers` (
    `Id` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `FirstName` longtext CHARACTER SET utf8mb4 NOT NULL,
    `LastName` longtext CHARACTER SET utf8mb4 NOT NULL,
    `UserName` varchar(256) CHARACTER SET utf8mb4 NULL,
    `NormalizedUserName` varchar(256) CHARACTER SET utf8mb4 NULL,
    `Email` varchar(256) CHARACTER SET utf8mb4 NULL,
    `NormalizedEmail` varchar(256) CHARACTER SET utf8mb4 NULL,
    `EmailConfirmed` tinyint(1) NOT NULL,
    `PasswordHash` longtext CHARACTER SET utf8mb4 NULL,
    `SecurityStamp` longtext CHARACTER SET utf8mb4 NULL,
    `ConcurrencyStamp` longtext CHARACTER SET utf8mb4 NULL,
    `PhoneNumber` longtext CHARACTER SET utf8mb4 NULL,
    `PhoneNumberConfirmed` tinyint(1) NOT NULL,
    `TwoFactorEnabled` tinyint(1) NOT NULL,
    `LockoutEnd` datetime(6) NULL,
    `LockoutEnabled` tinyint(1) NOT NULL,
    `AccessFailedCount` int NOT NULL,
    CONSTRAINT `PK_AspNetUsers` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `blocked_terms` (
    `id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `term` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
    `normalized_term` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
    `action` varchar(16) CHARACTER SET utf8mb4 NOT NULL,
    `is_active` tinyint(1) NOT NULL,
    `created_at` datetime(6) NOT NULL,
    `updated_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_blocked_terms` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `idea_assignments` (
    `idea_id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `evaluator_user_id` varchar(450) CHARACTER SET utf8mb4 NOT NULL,
    `assigned_by_user_id` varchar(450) CHARACTER SET utf8mb4 NOT NULL,
    `assigned_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_idea_assignments` PRIMARY KEY (`idea_id`, `evaluator_user_id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `idea_categories` (
    `id` int NOT NULL,
    `name` varchar(80) CHARACTER SET utf8mb4 NOT NULL,
    `is_active` tinyint(1) NOT NULL,
    CONSTRAINT `PK_idea_categories` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `idea_evaluations` (
    `idea_id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `evaluator_user_id` varchar(450) CHARACTER SET utf8mb4 NOT NULL,
    `criterion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    `score` int NOT NULL,
    `comment` varchar(2000) CHARACTER SET utf8mb4 NULL,
    `evaluated_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_idea_evaluations` PRIMARY KEY (`idea_id`, `evaluator_user_id`, `criterion`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `idea_read_receipts` (
    `idea_id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `user_id` varchar(450) CHARACTER SET utf8mb4 NOT NULL,
    `read_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_idea_read_receipts` PRIMARY KEY (`idea_id`, `user_id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `implementation_reports` (
    `id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `idea_id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `status` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    `note` varchar(2000) CHARACTER SET utf8mb4 NOT NULL,
    `reported_by_user_id` varchar(450) CHARACTER SET utf8mb4 NOT NULL,
    `reported_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_implementation_reports` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `period_selections` (
    `period_id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `category_id` int NOT NULL,
    `idea_id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `selected_by_user_id` varchar(450) CHARACTER SET utf8mb4 NOT NULL,
    `selected_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_period_selections` PRIMARY KEY (`period_id`, `category_id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `periods` (
    `id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `label` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
    `start_at` datetime(6) NOT NULL,
    `end_at` datetime(6) NOT NULL,
    `status` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    `created_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_periods` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `province_user_assignments` (
    `id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `user_id` varchar(450) CHARACTER SET utf8mb4 NOT NULL,
    `province_id` int NOT NULL,
    `role` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `assigned_by_user_id` varchar(450) CHARACTER SET utf8mb4 NULL,
    `assigned_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_province_user_assignments` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `provinces` (
    `id` int NOT NULL,
    `name` varchar(40) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_provinces` PRIMARY KEY (`id`)
) CHARACTER SET=utf8mb4;

CREATE TABLE `AspNetRoleClaims` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `RoleId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `ClaimType` longtext CHARACTER SET utf8mb4 NULL,
    `ClaimValue` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetRoleClaims` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_AspNetRoleClaims_AspNetRoles_RoleId` FOREIGN KEY (`RoleId`) REFERENCES `AspNetRoles` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `AspNetUserClaims` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `UserId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `ClaimType` longtext CHARACTER SET utf8mb4 NULL,
    `ClaimValue` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetUserClaims` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_AspNetUserClaims_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `AspNetUserLogins` (
    `LoginProvider` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `ProviderKey` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `ProviderDisplayName` longtext CHARACTER SET utf8mb4 NULL,
    `UserId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_AspNetUserLogins` PRIMARY KEY (`LoginProvider`, `ProviderKey`),
    CONSTRAINT `FK_AspNetUserLogins_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `AspNetUserRoles` (
    `UserId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `RoleId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_AspNetUserRoles` PRIMARY KEY (`UserId`, `RoleId`),
    CONSTRAINT `FK_AspNetUserRoles_AspNetRoles_RoleId` FOREIGN KEY (`RoleId`) REFERENCES `AspNetRoles` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_AspNetUserRoles_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `AspNetUserTokens` (
    `UserId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `LoginProvider` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `Name` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `Value` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetUserTokens` PRIMARY KEY (`UserId`, `LoginProvider`, `Name`),
    CONSTRAINT `FK_AspNetUserTokens_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `student_profiles` (
    `id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `application_user_id` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `province_id` int NOT NULL,
    `district` varchar(60) CHARACTER SET utf8mb4 NULL,
    `school` varchar(150) CHARACTER SET utf8mb4 NULL,
    `grade` int NULL,
    `student_number` varchar(20) CHARACTER SET utf8mb4 NULL,
    `created_at` datetime(6) NOT NULL,
    `updated_at` datetime(6) NOT NULL,
    CONSTRAINT `PK_student_profiles` PRIMARY KEY (`id`),
    CONSTRAINT `FK_student_profiles_provinces_province_id` FOREIGN KEY (`province_id`) REFERENCES `provinces` (`id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

CREATE TABLE `ideas` (
    `id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `student_id` char(36) COLLATE utf8mb4_general_ci NOT NULL,
    `province_id` int NOT NULL,
    `category_id` int NOT NULL,
    `content` varchar(1500) CHARACTER SET utf8mb4 NOT NULL,
    `status` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
    `created_at` datetime(6) NOT NULL,
    `updated_at` datetime(6) NOT NULL,
    `submitted_at` datetime(6) NULL,
    CONSTRAINT `PK_ideas` PRIMARY KEY (`id`),
    CONSTRAINT `FK_ideas_idea_categories_category_id` FOREIGN KEY (`category_id`) REFERENCES `idea_categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_ideas_provinces_province_id` FOREIGN KEY (`province_id`) REFERENCES `provinces` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_ideas_student_profiles_student_id` FOREIGN KEY (`student_id`) REFERENCES `student_profiles` (`id`) ON DELETE RESTRICT
) CHARACTER SET=utf8mb4;

INSERT INTO `idea_categories` (`id`, `is_active`, `name`)
VALUES (1, TRUE, 'Kültür ve Sanat'),
(2, TRUE, 'Spor ve Sağlıklı Yaşam'),
(3, TRUE, 'Bilim ve Teknoloji'),
(4, TRUE, 'Yapay Zekâ'),
(5, TRUE, 'Çevre ve Sürdürülebilirlik'),
(6, TRUE, 'Sosyal Sorumluluk'),
(7, TRUE, 'Girişimcilik'),
(8, TRUE, 'Afet Farkındalığı ve Güvenli Yaşam'),
(9, TRUE, 'Değerler Eğitimi'),
(10, TRUE, 'Yerli ve Millî Üretim – Millî Savunma');

INSERT INTO `provinces` (`id`, `name`)
VALUES (1, 'Adana'),
(2, 'Adıyaman'),
(3, 'Afyonkarahisar'),
(4, 'Ağrı'),
(5, 'Amasya'),
(6, 'Ankara'),
(7, 'Antalya'),
(8, 'Artvin'),
(9, 'Aydın'),
(10, 'Balıkesir'),
(11, 'Bilecik'),
(12, 'Bingöl'),
(13, 'Bitlis'),
(14, 'Bolu'),
(15, 'Burdur'),
(16, 'Bursa'),
(17, 'Çanakkale'),
(18, 'Çankırı'),
(19, 'Çorum'),
(20, 'Denizli'),
(21, 'Diyarbakır'),
(22, 'Edirne'),
(23, 'Elazığ'),
(24, 'Erzincan'),
(25, 'Erzurum'),
(26, 'Eskişehir'),
(27, 'Gaziantep'),
(28, 'Giresun'),
(29, 'Gümüşhane'),
(30, 'Hakkâri'),
(31, 'Hatay'),
(32, 'Isparta'),
(33, 'Mersin'),
(34, 'İstanbul'),
(35, 'İzmir'),
(36, 'Kars'),
(37, 'Kastamonu'),
(38, 'Kayseri'),
(39, 'Kırklareli'),
(40, 'Kırşehir'),
(41, 'Kocaeli'),
(42, 'Konya');
INSERT INTO `provinces` (`id`, `name`)
VALUES (43, 'Kütahya'),
(44, 'Malatya'),
(45, 'Manisa'),
(46, 'Kahramanmaraş'),
(47, 'Mardin'),
(48, 'Muğla'),
(49, 'Muş'),
(50, 'Nevşehir'),
(51, 'Niğde'),
(52, 'Ordu'),
(53, 'Rize'),
(54, 'Sakarya'),
(55, 'Samsun'),
(56, 'Siirt'),
(57, 'Sinop'),
(58, 'Sivas'),
(59, 'Tekirdağ'),
(60, 'Tokat'),
(61, 'Trabzon'),
(62, 'Tunceli'),
(63, 'Şanlıurfa'),
(64, 'Uşak'),
(65, 'Van'),
(66, 'Yozgat'),
(67, 'Zonguldak'),
(68, 'Aksaray'),
(69, 'Bayburt'),
(70, 'Karaman'),
(71, 'Kırıkkale'),
(72, 'Batman'),
(73, 'Şırnak'),
(74, 'Bartın'),
(75, 'Ardahan'),
(76, 'Iğdır'),
(77, 'Yalova'),
(78, 'Karabük'),
(79, 'Kilis'),
(80, 'Osmaniye'),
(81, 'Düzce');

CREATE INDEX `IX_AspNetRoleClaims_RoleId` ON `AspNetRoleClaims` (`RoleId`);

CREATE UNIQUE INDEX `RoleNameIndex` ON `AspNetRoles` (`NormalizedName`);

CREATE INDEX `IX_AspNetUserClaims_UserId` ON `AspNetUserClaims` (`UserId`);

CREATE INDEX `IX_AspNetUserLogins_UserId` ON `AspNetUserLogins` (`UserId`);

CREATE INDEX `IX_AspNetUserRoles_RoleId` ON `AspNetUserRoles` (`RoleId`);

CREATE INDEX `EmailIndex` ON `AspNetUsers` (`NormalizedEmail`);

CREATE UNIQUE INDEX `UserNameIndex` ON `AspNetUsers` (`NormalizedUserName`);

CREATE UNIQUE INDEX `ux_blocked_terms_normalized_term` ON `blocked_terms` (`normalized_term`);

CREATE INDEX `ix_idea_assignments_evaluator` ON `idea_assignments` (`evaluator_user_id`);

CREATE INDEX `ix_idea_evaluations_evaluator` ON `idea_evaluations` (`evaluator_user_id`);

CREATE INDEX `ix_idea_evaluations_idea_criterion` ON `idea_evaluations` (`idea_id`, `criterion`);

CREATE INDEX `ix_idea_read_receipts_user_id` ON `idea_read_receipts` (`user_id`);

CREATE INDEX `IX_ideas_category_id` ON `ideas` (`category_id`);

CREATE INDEX `ix_ideas_province_status` ON `ideas` (`province_id`, `status`);

CREATE INDEX `ix_ideas_student_id` ON `ideas` (`student_id`);

CREATE INDEX `ix_ideas_submitted_at` ON `ideas` (`submitted_at`);

CREATE INDEX `ix_implementation_reports_idea` ON `implementation_reports` (`idea_id`);

CREATE INDEX `ix_implementation_reports_idea_reported_at` ON `implementation_reports` (`idea_id`, `reported_at`);

CREATE INDEX `ix_period_selections_idea` ON `period_selections` (`idea_id`);

CREATE UNIQUE INDEX `ux_period_selections_period_category` ON `period_selections` (`period_id`, `category_id`);

CREATE INDEX `ix_periods_status` ON `periods` (`status`);

CREATE INDEX `ix_province_user_province` ON `province_user_assignments` (`province_id`);

CREATE UNIQUE INDEX `ux_province_user_one_manager` ON `province_user_assignments` (`province_id`, `role`);

CREATE UNIQUE INDEX `ux_province_user_user_role` ON `province_user_assignments` (`user_id`, `role`);

CREATE INDEX `IX_student_profiles_province_id` ON `student_profiles` (`province_id`);

CREATE UNIQUE INDEX `ux_student_profiles_user_id` ON `student_profiles` (`application_user_id`);

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924134535_InitialMySql', '9.0.0');

ALTER TABLE `AspNetUsers` ADD `MustChangePassword` tinyint(1) NOT NULL DEFAULT FALSE;

ALTER TABLE `AspNetUsers` ADD `PasswordChangedAt` datetime(6) NULL;

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924135612_AddAuthSecurity', '9.0.0');

INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`)
VALUES ('20260924135849_FixPasswordChangedAtType', '9.0.0');

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

COMMIT;

