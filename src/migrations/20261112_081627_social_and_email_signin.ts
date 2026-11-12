import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- Old one-time codes are short-lived and incompatible with the new columns: clear them first.
  DELETE FROM "otp_challenges";
  CREATE TYPE "public"."enum_otp_challenges_purpose" AS ENUM('email-login', 'verify-phone');
  CREATE TABLE "users_identities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"provider" varchar NOT NULL,
  	"subject" varchar NOT NULL
  );
  
  DROP INDEX "otp_challenges_phone_idx";
  ALTER TABLE "users" ADD COLUMN "phone_verified" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false;
  ALTER TABLE "otp_challenges" ADD COLUMN "target" varchar NOT NULL;
  ALTER TABLE "otp_challenges" ADD COLUMN "purpose" "enum_otp_challenges_purpose" NOT NULL;
  ALTER TABLE "otp_challenges" ADD COLUMN "user_id" integer;
  ALTER TABLE "users_identities" ADD CONSTRAINT "users_identities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_identities_order_idx" ON "users_identities" USING btree ("_order");
  CREATE INDEX "users_identities_parent_id_idx" ON "users_identities" USING btree ("_parent_id");
  CREATE INDEX "users_identities_provider_idx" ON "users_identities" USING btree ("provider");
  CREATE INDEX "users_identities_subject_idx" ON "users_identities" USING btree ("subject");
  ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "otp_challenges_target_idx" ON "otp_challenges" USING btree ("target");
  CREATE INDEX "otp_challenges_purpose_idx" ON "otp_challenges" USING btree ("purpose");
  CREATE INDEX "otp_challenges_user_idx" ON "otp_challenges" USING btree ("user_id");
  ALTER TABLE "otp_challenges" DROP COLUMN "phone";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_identities" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_identities" CASCADE;
  ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_user_id_users_id_fk";
  
  DROP INDEX "otp_challenges_target_idx";
  DROP INDEX "otp_challenges_purpose_idx";
  DROP INDEX "otp_challenges_user_idx";
  ALTER TABLE "otp_challenges" ADD COLUMN "phone" varchar NOT NULL;
  CREATE INDEX "otp_challenges_phone_idx" ON "otp_challenges" USING btree ("phone");
  ALTER TABLE "users" DROP COLUMN "phone_verified";
  ALTER TABLE "users" DROP COLUMN "email_verified";
  ALTER TABLE "otp_challenges" DROP COLUMN "target";
  ALTER TABLE "otp_challenges" DROP COLUMN "purpose";
  ALTER TABLE "otp_challenges" DROP COLUMN "user_id";
  DROP TYPE "public"."enum_otp_challenges_purpose";`)
}
