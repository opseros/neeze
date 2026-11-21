import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_posts_translations_locale" AS ENUM('en', 'bn', 'mni-Beng', 'mni-Mtei');
  CREATE TABLE "posts_translations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"locale" "enum_posts_translations_locale" NOT NULL,
  	"body" varchar NOT NULL
  );
  
  ALTER TABLE "posts_translations" ADD CONSTRAINT "posts_translations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_translations_order_idx" ON "posts_translations" USING btree ("_order");
  CREATE INDEX "posts_translations_parent_id_idx" ON "posts_translations" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "posts_translations" CASCADE;
  DROP TYPE "public"."enum_posts_translations_locale";`)
}
