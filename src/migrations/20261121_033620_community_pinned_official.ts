import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" ADD COLUMN "pinned" boolean DEFAULT false;
  ALTER TABLE "posts" ADD COLUMN "official" boolean DEFAULT false;
  CREATE INDEX "posts_pinned_idx" ON "posts" USING btree ("pinned");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "posts_pinned_idx";
  ALTER TABLE "posts" DROP COLUMN "pinned";
  ALTER TABLE "posts" DROP COLUMN "official";`)
}
