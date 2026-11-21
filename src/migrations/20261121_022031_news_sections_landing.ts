import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_news_section" AS ENUM('local', 'civic', 'health', 'education', 'transport', 'events', 'business', 'alerts');
  CREATE TYPE "public"."enum__news_v_version_section" AS ENUM('local', 'civic', 'health', 'education', 'transport', 'events', 'business', 'alerts');
  CREATE TYPE "public"."enum_site_settings_landing_default_page" AS ENUM('news', 'directory', 'community');
  CREATE TYPE "public"."enum_site_settings_landing_temporary_page" AS ENUM('same', 'news', 'directory', 'community');
  CREATE TYPE "public"."enum_site_settings_landing_temporary_tone" AS ENUM('navy', 'teal', 'alert');
  ALTER TABLE "news" ADD COLUMN "section" "enum_news_section" DEFAULT 'local';
  ALTER TABLE "news" ADD COLUMN "featured" boolean DEFAULT false;
  ALTER TABLE "_news_v" ADD COLUMN "version_section" "enum__news_v_version_section" DEFAULT 'local';
  ALTER TABLE "_news_v" ADD COLUMN "version_featured" boolean DEFAULT false;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_filename" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "landing_default_page" "enum_site_settings_landing_default_page" DEFAULT 'news';
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_active" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_from" timestamp(3) with time zone;
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_until" timestamp(3) with time zone;
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_page" "enum_site_settings_landing_temporary_page" DEFAULT 'same';
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_show_spotlight" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_image_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_button_link" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "landing_temporary_tone" "enum_site_settings_landing_temporary_tone" DEFAULT 'navy';
  ALTER TABLE "site_settings_locales" ADD COLUMN "landing_temporary_headline" varchar;
  ALTER TABLE "site_settings_locales" ADD COLUMN "landing_temporary_text" varchar;
  ALTER TABLE "site_settings_locales" ADD COLUMN "landing_temporary_button_label" varchar;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_landing_temporary_image_id_media_id_fk" FOREIGN KEY ("landing_temporary_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "news_section_idx" ON "news" USING btree ("section");
  CREATE INDEX "news_featured_idx" ON "news" USING btree ("featured");
  CREATE INDEX "_news_v_version_version_section_idx" ON "_news_v" USING btree ("version_section");
  CREATE INDEX "_news_v_version_version_featured_idx" ON "_news_v" USING btree ("version_featured");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "site_settings_landing_temporary_landing_temporary_image_idx" ON "site_settings" USING btree ("landing_temporary_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_landing_temporary_image_id_media_id_fk";
  
  DROP INDEX "news_section_idx";
  DROP INDEX "news_featured_idx";
  DROP INDEX "_news_v_version_version_section_idx";
  DROP INDEX "_news_v_version_version_featured_idx";
  DROP INDEX "media_sizes_hero_sizes_hero_filename_idx";
  DROP INDEX "site_settings_landing_temporary_landing_temporary_image_idx";
  ALTER TABLE "news" DROP COLUMN "section";
  ALTER TABLE "news" DROP COLUMN "featured";
  ALTER TABLE "_news_v" DROP COLUMN "version_section";
  ALTER TABLE "_news_v" DROP COLUMN "version_featured";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_url";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_width";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_height";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_filename";
  ALTER TABLE "site_settings" DROP COLUMN "landing_default_page";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_active";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_from";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_until";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_page";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_show_spotlight";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_image_id";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_button_link";
  ALTER TABLE "site_settings" DROP COLUMN "landing_temporary_tone";
  ALTER TABLE "site_settings_locales" DROP COLUMN "landing_temporary_headline";
  ALTER TABLE "site_settings_locales" DROP COLUMN "landing_temporary_text";
  ALTER TABLE "site_settings_locales" DROP COLUMN "landing_temporary_button_label";
  DROP TYPE "public"."enum_news_section";
  DROP TYPE "public"."enum__news_v_version_section";
  DROP TYPE "public"."enum_site_settings_landing_default_page";
  DROP TYPE "public"."enum_site_settings_landing_temporary_page";
  DROP TYPE "public"."enum_site_settings_landing_temporary_tone";`)
}
