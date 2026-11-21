import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "news" ADD COLUMN "byline" varchar DEFAULT 'Neeze Editor';
  ALTER TABLE "_news_v" ADD COLUMN "version_byline" varchar DEFAULT 'Neeze Editor';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "news" DROP COLUMN "byline";
  ALTER TABLE "_news_v" DROP COLUMN "version_byline";`)
}
