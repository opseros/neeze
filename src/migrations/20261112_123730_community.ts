import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_topic" AS ENUM('question', 'recommendation', 'announcement', 'lost-found', 'general');
  CREATE TYPE "public"."enum_posts_status" AS ENUM('pending', 'published', 'hidden', 'removed');
  CREATE TYPE "public"."enum_comments_status" AS ENUM('pending', 'published', 'hidden', 'removed');
  CREATE TYPE "public"."enum_content_reports_target_type" AS ENUM('post', 'comment', 'news', 'provider');
  CREATE TYPE "public"."enum_content_reports_reason" AS ENUM('spam', 'abuse', 'false-info', 'privacy', 'other', 'correction', 'wrong-info', 'closed', 'fraud');
  CREATE TYPE "public"."enum_content_reports_status" AS ENUM('open', 'resolved', 'dismissed');
  CREATE TYPE "public"."enum_site_settings_community_posting_mode" AS ENUM('open', 'first-post', 'all');
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'new-comment';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'post-approved';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'post-removed';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'report-outcome';
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_id" integer,
  	"author_name" varchar,
  	"body" varchar NOT NULL,
  	"image_id" integer,
  	"topic" "enum_posts_topic" DEFAULT 'general' NOT NULL,
  	"locality_id" integer,
  	"status" "enum_posts_status" DEFAULT 'published',
  	"comments_locked" boolean DEFAULT false,
  	"comment_count" numeric DEFAULT 0,
  	"helpful_count" numeric DEFAULT 0,
  	"edited_at" timestamp(3) with time zone,
  	"report_count" numeric DEFAULT 0,
  	"moderation_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"post_id" integer NOT NULL,
  	"author_id" integer,
  	"author_name" varchar,
  	"body" varchar NOT NULL,
  	"status" "enum_comments_status" DEFAULT 'published',
  	"report_count" numeric DEFAULT 0,
  	"moderation_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "content_reports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"target_type" "enum_content_reports_target_type" NOT NULL,
  	"target_id" numeric NOT NULL,
  	"link" varchar,
  	"excerpt" varchar,
  	"reporter_id" integer,
  	"reason" "enum_content_reports_reason" NOT NULL,
  	"note" varchar,
  	"status" "enum_content_reports_status" DEFAULT 'open',
  	"resolution" varchar,
  	"resolved_by_id" integer,
  	"resolved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "community_restrictions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"until" timestamp(3) with time zone NOT NULL,
  	"reason" varchar NOT NULL,
  	"by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "media_locales" ALTER COLUMN "alt" DROP NOT NULL;
  ALTER TABLE "media" ADD COLUMN "uploaded_by_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "content_reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_restrictions_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "community_posting_mode" "enum_site_settings_community_posting_mode" DEFAULT 'first-post';
  ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_restrictions" ADD CONSTRAINT "community_restrictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "community_restrictions" ADD CONSTRAINT "community_restrictions_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id");
  CREATE INDEX "posts_image_idx" ON "posts" USING btree ("image_id");
  CREATE INDEX "posts_topic_idx" ON "posts" USING btree ("topic");
  CREATE INDEX "posts_locality_idx" ON "posts" USING btree ("locality_id");
  CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status");
  CREATE INDEX "posts_report_count_idx" ON "posts" USING btree ("report_count");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_users_id_idx" ON "posts_rels" USING btree ("users_id");
  CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id");
  CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");
  CREATE INDEX "comments_status_idx" ON "comments" USING btree ("status");
  CREATE INDEX "comments_report_count_idx" ON "comments" USING btree ("report_count");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE INDEX "comments_rels_order_idx" ON "comments_rels" USING btree ("order");
  CREATE INDEX "comments_rels_parent_idx" ON "comments_rels" USING btree ("parent_id");
  CREATE INDEX "comments_rels_path_idx" ON "comments_rels" USING btree ("path");
  CREATE INDEX "comments_rels_users_id_idx" ON "comments_rels" USING btree ("users_id");
  CREATE INDEX "content_reports_target_type_idx" ON "content_reports" USING btree ("target_type");
  CREATE INDEX "content_reports_target_id_idx" ON "content_reports" USING btree ("target_id");
  CREATE INDEX "content_reports_reporter_idx" ON "content_reports" USING btree ("reporter_id");
  CREATE INDEX "content_reports_status_idx" ON "content_reports" USING btree ("status");
  CREATE INDEX "content_reports_resolved_by_idx" ON "content_reports" USING btree ("resolved_by_id");
  CREATE INDEX "content_reports_updated_at_idx" ON "content_reports" USING btree ("updated_at");
  CREATE INDEX "content_reports_created_at_idx" ON "content_reports" USING btree ("created_at");
  CREATE UNIQUE INDEX "community_restrictions_user_idx" ON "community_restrictions" USING btree ("user_id");
  CREATE INDEX "community_restrictions_by_idx" ON "community_restrictions" USING btree ("by_id");
  CREATE INDEX "community_restrictions_updated_at_idx" ON "community_restrictions" USING btree ("updated_at");
  CREATE INDEX "community_restrictions_created_at_idx" ON "community_restrictions" USING btree ("created_at");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_users_id_idx" ON "users_rels" USING btree ("users_id");
  ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_reports_fk" FOREIGN KEY ("content_reports_id") REFERENCES "public"."content_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_restrictions_fk" FOREIGN KEY ("community_restrictions_id") REFERENCES "public"."community_restrictions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_uploaded_by_idx" ON "media" USING btree ("uploaded_by_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_content_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("content_reports_id");
  CREATE INDEX "payload_locked_documents_rels_community_restrictions_id_idx" ON "payload_locked_documents_rels" USING btree ("community_restrictions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comments_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "content_reports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "community_restrictions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "posts_rels" CASCADE;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "comments_rels" CASCADE;
  DROP TABLE "content_reports" CASCADE;
  DROP TABLE "community_restrictions" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  ALTER TABLE "media" DROP CONSTRAINT "media_uploaded_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_posts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_content_reports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_community_restrictions_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('new-request', 'request-update', 'new-review');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";
  DROP INDEX "media_uploaded_by_idx";
  DROP INDEX "payload_locked_documents_rels_posts_id_idx";
  DROP INDEX "payload_locked_documents_rels_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_content_reports_id_idx";
  DROP INDEX "payload_locked_documents_rels_community_restrictions_id_idx";
  ALTER TABLE "media_locales" ALTER COLUMN "alt" SET NOT NULL;
  ALTER TABLE "media" DROP COLUMN "uploaded_by_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "content_reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "community_restrictions_id";
  ALTER TABLE "site_settings" DROP COLUMN "community_posting_mode";
  DROP TYPE "public"."enum_posts_topic";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum_comments_status";
  DROP TYPE "public"."enum_content_reports_target_type";
  DROP TYPE "public"."enum_content_reports_reason";
  DROP TYPE "public"."enum_content_reports_status";
  DROP TYPE "public"."enum_site_settings_community_posting_mode";`)
}
