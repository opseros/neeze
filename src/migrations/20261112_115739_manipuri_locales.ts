import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."_locales" ADD VALUE 'mni-Mtei';
  ALTER TYPE "public"."_locales" ADD VALUE 'mni-Beng';
  ALTER TYPE "public"."enum__news_v_published_locale" ADD VALUE 'mni-Mtei';
  ALTER TYPE "public"."enum__news_v_published_locale" ADD VALUE 'mni-Beng';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Postgres can't drop enum values: remove Manipuri content, then rebuild the type without them.
  await db.execute(sql`
  DELETE FROM "providers_services_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "providers_hours_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "providers_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "_providers_v_version_services_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "_providers_v_version_hours_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "_providers_v_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "categories_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "localities_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "news_corrections_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "news_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "_news_v_version_corrections_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "_news_v_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "media_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "site_settings_emergency_contacts_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  DELETE FROM "site_settings_locales" WHERE "_locale"::text IN ('mni-Mtei', 'mni-Beng');
  UPDATE "_news_v" SET "published_locale" = NULL WHERE "published_locale"::text IN ('mni-Mtei', 'mni-Beng');
   ALTER TABLE "providers_services_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "providers_hours_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "providers_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "_providers_v_version_services_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "_providers_v_version_hours_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "_providers_v_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "categories_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "localities_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "news_corrections_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "news_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "_news_v_version_corrections_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "_news_v_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "media_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "site_settings_emergency_contacts_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "site_settings_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  DROP TYPE "public"."_locales";
  CREATE TYPE "public"."_locales" AS ENUM('en', 'bn');
  ALTER TABLE "providers_services_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "providers_hours_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "providers_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_providers_v_version_services_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_providers_v_version_hours_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_providers_v_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "categories_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "localities_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "news_corrections_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "news_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_news_v_version_corrections_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_news_v_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "media_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "site_settings_emergency_contacts_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "site_settings_locales" ALTER COLUMN "_locale" SET DATA TYPE "public"."_locales" USING "_locale"::"public"."_locales";
  ALTER TABLE "_news_v" ALTER COLUMN "published_locale" SET DATA TYPE text;
  DROP TYPE "public"."enum__news_v_published_locale";
  CREATE TYPE "public"."enum__news_v_published_locale" AS ENUM('en', 'bn');
  ALTER TABLE "_news_v" ALTER COLUMN "published_locale" SET DATA TYPE "public"."enum__news_v_published_locale" USING "published_locale"::"public"."enum__news_v_published_locale";`)
}
