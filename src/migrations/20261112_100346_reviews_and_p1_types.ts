import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_reviews_status" AS ENUM('published', 'hidden');
  ALTER TYPE "public"."enum_providers_type" ADD VALUE 'school';
  ALTER TYPE "public"."enum_providers_type" ADD VALUE 'gym';
  ALTER TYPE "public"."enum_providers_type" ADD VALUE 'hotel';
  ALTER TYPE "public"."enum_providers_type" ADD VALUE 'bus-operator';
  ALTER TYPE "public"."enum__providers_v_version_type" ADD VALUE 'school';
  ALTER TYPE "public"."enum__providers_v_version_type" ADD VALUE 'gym';
  ALTER TYPE "public"."enum__providers_v_version_type" ADD VALUE 'hotel';
  ALTER TYPE "public"."enum__providers_v_version_type" ADD VALUE 'bus-operator';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'new-review';
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"request_id" integer NOT NULL,
  	"provider_id" integer NOT NULL,
  	"customer_id" integer,
  	"author_name" varchar,
  	"rating" numeric NOT NULL,
  	"comment" varchar,
  	"reply" varchar,
  	"replied_at" timestamp(3) with time zone,
  	"status" "enum_reviews_status" DEFAULT 'published',
  	"report_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  ALTER TABLE "providers" ADD COLUMN "rating_avg" numeric;
  ALTER TABLE "providers" ADD COLUMN "rating_count" numeric DEFAULT 0;
  ALTER TABLE "_providers_v" ADD COLUMN "version_rating_avg" numeric;
  ALTER TABLE "_providers_v" ADD COLUMN "version_rating_count" numeric DEFAULT 0;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reviews_id" integer;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "reviews_request_idx" ON "reviews" USING btree ("request_id");
  CREATE INDEX "reviews_provider_idx" ON "reviews" USING btree ("provider_id");
  CREATE INDEX "reviews_customer_idx" ON "reviews" USING btree ("customer_id");
  CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE INDEX "reviews_rels_order_idx" ON "reviews_rels" USING btree ("order");
  CREATE INDEX "reviews_rels_parent_idx" ON "reviews_rels" USING btree ("parent_id");
  CREATE INDEX "reviews_rels_path_idx" ON "reviews_rels" USING btree ("path");
  CREATE INDEX "reviews_rels_users_id_idx" ON "reviews_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reviews" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reviews_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "reviews_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reviews_fk";
  
  ALTER TABLE "providers" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_providers_type";
  CREATE TYPE "public"."enum_providers_type" AS ENUM('service-professional', 'business', 'doctor', 'clinic', 'hospital', 'diagnostic');
  ALTER TABLE "providers" ALTER COLUMN "type" SET DATA TYPE "public"."enum_providers_type" USING "type"::"public"."enum_providers_type";
  ALTER TABLE "_providers_v" ALTER COLUMN "version_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__providers_v_version_type";
  CREATE TYPE "public"."enum__providers_v_version_type" AS ENUM('service-professional', 'business', 'doctor', 'clinic', 'hospital', 'diagnostic');
  ALTER TABLE "_providers_v" ALTER COLUMN "version_type" SET DATA TYPE "public"."enum__providers_v_version_type" USING "version_type"::"public"."enum__providers_v_version_type";
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('new-request', 'request-update');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";
  DROP INDEX "payload_locked_documents_rels_reviews_id_idx";
  ALTER TABLE "providers" DROP COLUMN "rating_avg";
  ALTER TABLE "providers" DROP COLUMN "rating_count";
  ALTER TABLE "_providers_v" DROP COLUMN "version_rating_avg";
  ALTER TABLE "_providers_v" DROP COLUMN "version_rating_count";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reviews_id";
  DROP TYPE "public"."enum_reviews_status";`)
}
