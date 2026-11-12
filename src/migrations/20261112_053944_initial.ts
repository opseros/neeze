import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'bn');
  CREATE TYPE "public"."enum_providers_services_pricing_type" AS ENUM('fixed', 'from', 'quote');
  CREATE TYPE "public"."enum_providers_type" AS ENUM('service-professional', 'business', 'doctor', 'clinic', 'hospital', 'diagnostic');
  CREATE TYPE "public"."enum_providers_status" AS ENUM('draft', 'pending-review', 'published', 'suspended');
  CREATE TYPE "public"."enum_providers_verification" AS ENUM('none', 'phone', 'identity', 'credential');
  CREATE TYPE "public"."enum__providers_v_version_services_pricing_type" AS ENUM('fixed', 'from', 'quote');
  CREATE TYPE "public"."enum__providers_v_version_type" AS ENUM('service-professional', 'business', 'doctor', 'clinic', 'hospital', 'diagnostic');
  CREATE TYPE "public"."enum__providers_v_version_status" AS ENUM('draft', 'pending-review', 'published', 'suspended');
  CREATE TYPE "public"."enum__providers_v_version_verification" AS ENUM('none', 'phone', 'identity', 'credential');
  CREATE TYPE "public"."enum_requests_kind" AS ENUM('service', 'appointment', 'enquiry');
  CREATE TYPE "public"."enum_requests_preferred_window" AS ENUM('morning', 'afternoon', 'evening', 'any');
  CREATE TYPE "public"."enum_requests_urgency" AS ENUM('normal', 'urgent');
  CREATE TYPE "public"."enum_requests_status" AS ENUM('submitted', 'assigned', 'contacted', 'quoted', 'accepted', 'in-progress', 'completed', 'cancelled', 'rejected', 'expired');
  CREATE TYPE "public"."enum_categories_vertical" AS ENUM('health', 'services', 'business', 'market', 'education', 'fitness', 'travel');
  CREATE TYPE "public"."enum_news_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__news_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__news_v_published_locale" AS ENUM('en', 'bn');
  CREATE TYPE "public"."enum_users_roles" AS ENUM('super-admin', 'admin', 'moderator', 'editor', 'provider', 'customer');
  CREATE TYPE "public"."enum_users_preferred_language" AS ENUM('en', 'bn', 'as');
  CREATE TYPE "public"."enum_site_settings_alert_banner_tone" AS ENUM('info', 'warning', 'critical');
  CREATE TABLE "providers_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pricing_type" "enum_providers_services_pricing_type" DEFAULT 'quote',
  	"price" numeric
  );
  
  CREATE TABLE "providers_services_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "providers_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" varchar NOT NULL
  );
  
  CREATE TABLE "providers_hours_locales" (
  	"days" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "providers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"name_bn" varchar,
  	"type" "enum_providers_type" NOT NULL,
  	"phone" varchar NOT NULL,
  	"whatsapp" varchar,
  	"base_locality_id" integer NOT NULL,
  	"address" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"accepts_requests" boolean DEFAULT true,
  	"status" "enum_providers_status" DEFAULT 'pending-review',
  	"verification" "enum_providers_verification" DEFAULT 'none',
  	"verification_notes" varchar,
  	"last_confirmed_at" timestamp(3) with time zone,
  	"search_text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "providers_locales" (
  	"summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "providers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"localities_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "_providers_v_version_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"pricing_type" "enum__providers_v_version_services_pricing_type" DEFAULT 'quote',
  	"price" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_providers_v_version_services_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_providers_v_version_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"time" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_providers_v_version_hours_locales" (
  	"days" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_providers_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar NOT NULL,
  	"version_name_bn" varchar,
  	"version_type" "enum__providers_v_version_type" NOT NULL,
  	"version_phone" varchar NOT NULL,
  	"version_whatsapp" varchar,
  	"version_base_locality_id" integer NOT NULL,
  	"version_address" varchar,
  	"version_lat" numeric,
  	"version_lng" numeric,
  	"version_accepts_requests" boolean DEFAULT true,
  	"version_status" "enum__providers_v_version_status" DEFAULT 'pending-review',
  	"version_verification" "enum__providers_v_version_verification" DEFAULT 'none',
  	"version_verification_notes" varchar,
  	"version_last_confirmed_at" timestamp(3) with time zone,
  	"version_search_text" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_providers_v_locales" (
  	"version_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_providers_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"localities_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "requests_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" varchar,
  	"at" timestamp(3) with time zone,
  	"by" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"kind" "enum_requests_kind" DEFAULT 'service' NOT NULL,
  	"provider_id" integer NOT NULL,
  	"category_id" integer,
  	"customer_id" integer,
  	"contact_name" varchar NOT NULL,
  	"contact_phone" varchar NOT NULL,
  	"locality_id" integer NOT NULL,
  	"address" varchar,
  	"description" varchar NOT NULL,
  	"preferred_date" timestamp(3) with time zone,
  	"preferred_window" "enum_requests_preferred_window" DEFAULT 'any',
  	"urgency" "enum_requests_urgency" DEFAULT 'normal',
  	"status" "enum_requests_status" DEFAULT 'submitted',
  	"status_reason" varchar,
  	"quote_note" varchar,
  	"idempotency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"vertical" "enum_categories_vertical" NOT NULL,
  	"parent_id" integer,
  	"icon" varchar,
  	"active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 100,
  	"keywords" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "localities_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"alias" varchar NOT NULL
  );
  
  CREATE TABLE "localities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"town" varchar DEFAULT 'Silchar',
  	"district" varchar DEFAULT 'Cachar',
  	"state" varchar DEFAULT 'Assam',
  	"active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 100,
  	"search_text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "localities_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "news_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "news_corrections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "news_corrections_locales" (
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "news" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"image_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_news_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "news_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_news_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_news_v_version_corrections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_news_v_version_corrections_locales" (
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_news_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_image_id" integer,
  	"version_published_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__news_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__news_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_news_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"phone" varchar,
  	"preferred_language" "enum_users_preferred_language" DEFAULT 'bn',
  	"locality_id" integer,
  	"suspended" boolean DEFAULT false,
  	"suspension_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar,
  	"username" varchar,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "audit_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" varchar NOT NULL,
  	"target_collection" varchar NOT NULL,
  	"target_id" varchar NOT NULL,
  	"actor_id" integer,
  	"detail" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "otp_challenges" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0,
  	"consumed" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"providers_id" integer,
  	"requests_id" integer,
  	"categories_id" integer,
  	"localities_id" integer,
  	"news_id" integer,
  	"media_id" integer,
  	"users_id" integer,
  	"audit_logs_id" integer,
  	"otp_challenges_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_emergency_contacts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings_emergency_contacts_locales" (
  	"label" varchar NOT NULL,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alert_banner_enabled" boolean DEFAULT false,
  	"alert_banner_tone" "enum_site_settings_alert_banner_tone" DEFAULT 'warning',
  	"support_phone" varchar,
  	"grievance_email" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_settings_locales" (
  	"alert_banner_message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "providers_services" ADD CONSTRAINT "providers_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_services_locales" ADD CONSTRAINT "providers_services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."providers_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_hours" ADD CONSTRAINT "providers_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_hours_locales" ADD CONSTRAINT "providers_hours_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."providers_hours"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers" ADD CONSTRAINT "providers_base_locality_id_localities_id_fk" FOREIGN KEY ("base_locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "providers_locales" ADD CONSTRAINT "providers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_rels" ADD CONSTRAINT "providers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_rels" ADD CONSTRAINT "providers_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_rels" ADD CONSTRAINT "providers_rels_localities_fk" FOREIGN KEY ("localities_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_rels" ADD CONSTRAINT "providers_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "providers_rels" ADD CONSTRAINT "providers_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_version_services" ADD CONSTRAINT "_providers_v_version_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_providers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_version_services_locales" ADD CONSTRAINT "_providers_v_version_services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_providers_v_version_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_version_hours" ADD CONSTRAINT "_providers_v_version_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_providers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_version_hours_locales" ADD CONSTRAINT "_providers_v_version_hours_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_providers_v_version_hours"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v" ADD CONSTRAINT "_providers_v_parent_id_providers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_providers_v" ADD CONSTRAINT "_providers_v_version_base_locality_id_localities_id_fk" FOREIGN KEY ("version_base_locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_providers_v_locales" ADD CONSTRAINT "_providers_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_providers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_rels" ADD CONSTRAINT "_providers_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_providers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_rels" ADD CONSTRAINT "_providers_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_rels" ADD CONSTRAINT "_providers_v_rels_localities_fk" FOREIGN KEY ("localities_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_rels" ADD CONSTRAINT "_providers_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_providers_v_rels" ADD CONSTRAINT "_providers_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "requests_history" ADD CONSTRAINT "requests_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "requests" ADD CONSTRAINT "requests_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "requests" ADD CONSTRAINT "requests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "requests" ADD CONSTRAINT "requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "requests" ADD CONSTRAINT "requests_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "localities_aliases" ADD CONSTRAINT "localities_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "localities_locales" ADD CONSTRAINT "localities_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_sources" ADD CONSTRAINT "news_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_corrections" ADD CONSTRAINT "news_corrections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_corrections_locales" ADD CONSTRAINT "news_corrections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news_corrections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_locales" ADD CONSTRAINT "news_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_version_sources" ADD CONSTRAINT "_news_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_version_corrections" ADD CONSTRAINT "_news_v_version_corrections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_version_corrections_locales" ADD CONSTRAINT "_news_v_version_corrections_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v_version_corrections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v_locales" ADD CONSTRAINT "_news_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_providers_fk" FOREIGN KEY ("providers_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_requests_fk" FOREIGN KEY ("requests_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_localities_fk" FOREIGN KEY ("localities_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk" FOREIGN KEY ("audit_logs_id") REFERENCES "public"."audit_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_otp_challenges_fk" FOREIGN KEY ("otp_challenges_id") REFERENCES "public"."otp_challenges"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_emergency_contacts" ADD CONSTRAINT "site_settings_emergency_contacts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_emergency_contacts_locales" ADD CONSTRAINT "site_settings_emergency_contacts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_emergency_contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_locales" ADD CONSTRAINT "site_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "providers_services_order_idx" ON "providers_services" USING btree ("_order");
  CREATE INDEX "providers_services_parent_id_idx" ON "providers_services" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "providers_services_locales_locale_parent_id_unique" ON "providers_services_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "providers_services_locales_parent_id_idx" ON "providers_services_locales" USING btree ("_parent_id");
  CREATE INDEX "providers_hours_order_idx" ON "providers_hours" USING btree ("_order");
  CREATE INDEX "providers_hours_parent_id_idx" ON "providers_hours" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "providers_hours_locales_locale_parent_id_unique" ON "providers_hours_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "providers_hours_locales_parent_id_idx" ON "providers_hours_locales" USING btree ("_parent_id");
  CREATE INDEX "providers_type_idx" ON "providers" USING btree ("type");
  CREATE INDEX "providers_base_locality_idx" ON "providers" USING btree ("base_locality_id");
  CREATE INDEX "providers_status_idx" ON "providers" USING btree ("status");
  CREATE INDEX "providers_search_text_idx" ON "providers" USING btree ("search_text");
  CREATE INDEX "providers_updated_at_idx" ON "providers" USING btree ("updated_at");
  CREATE INDEX "providers_created_at_idx" ON "providers" USING btree ("created_at");
  CREATE UNIQUE INDEX "providers_locales_locale_parent_id_unique" ON "providers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "providers_locales_parent_id_idx" ON "providers_locales" USING btree ("_parent_id");
  CREATE INDEX "providers_rels_order_idx" ON "providers_rels" USING btree ("order");
  CREATE INDEX "providers_rels_parent_idx" ON "providers_rels" USING btree ("parent_id");
  CREATE INDEX "providers_rels_path_idx" ON "providers_rels" USING btree ("path");
  CREATE INDEX "providers_rels_categories_id_idx" ON "providers_rels" USING btree ("categories_id");
  CREATE INDEX "providers_rels_localities_id_idx" ON "providers_rels" USING btree ("localities_id");
  CREATE INDEX "providers_rels_media_id_idx" ON "providers_rels" USING btree ("media_id");
  CREATE INDEX "providers_rels_users_id_idx" ON "providers_rels" USING btree ("users_id");
  CREATE INDEX "_providers_v_version_services_order_idx" ON "_providers_v_version_services" USING btree ("_order");
  CREATE INDEX "_providers_v_version_services_parent_id_idx" ON "_providers_v_version_services" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_providers_v_version_services_locales_locale_parent_id_uniqu" ON "_providers_v_version_services_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_providers_v_version_services_locales_parent_id_idx" ON "_providers_v_version_services_locales" USING btree ("_parent_id");
  CREATE INDEX "_providers_v_version_hours_order_idx" ON "_providers_v_version_hours" USING btree ("_order");
  CREATE INDEX "_providers_v_version_hours_parent_id_idx" ON "_providers_v_version_hours" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_providers_v_version_hours_locales_locale_parent_id_unique" ON "_providers_v_version_hours_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_providers_v_version_hours_locales_parent_id_idx" ON "_providers_v_version_hours_locales" USING btree ("_parent_id");
  CREATE INDEX "_providers_v_parent_idx" ON "_providers_v" USING btree ("parent_id");
  CREATE INDEX "_providers_v_version_version_type_idx" ON "_providers_v" USING btree ("version_type");
  CREATE INDEX "_providers_v_version_version_base_locality_idx" ON "_providers_v" USING btree ("version_base_locality_id");
  CREATE INDEX "_providers_v_version_version_status_idx" ON "_providers_v" USING btree ("version_status");
  CREATE INDEX "_providers_v_version_version_search_text_idx" ON "_providers_v" USING btree ("version_search_text");
  CREATE INDEX "_providers_v_version_version_updated_at_idx" ON "_providers_v" USING btree ("version_updated_at");
  CREATE INDEX "_providers_v_version_version_created_at_idx" ON "_providers_v" USING btree ("version_created_at");
  CREATE INDEX "_providers_v_created_at_idx" ON "_providers_v" USING btree ("created_at");
  CREATE INDEX "_providers_v_updated_at_idx" ON "_providers_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_providers_v_locales_locale_parent_id_unique" ON "_providers_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_providers_v_locales_parent_id_idx" ON "_providers_v_locales" USING btree ("_parent_id");
  CREATE INDEX "_providers_v_rels_order_idx" ON "_providers_v_rels" USING btree ("order");
  CREATE INDEX "_providers_v_rels_parent_idx" ON "_providers_v_rels" USING btree ("parent_id");
  CREATE INDEX "_providers_v_rels_path_idx" ON "_providers_v_rels" USING btree ("path");
  CREATE INDEX "_providers_v_rels_categories_id_idx" ON "_providers_v_rels" USING btree ("categories_id");
  CREATE INDEX "_providers_v_rels_localities_id_idx" ON "_providers_v_rels" USING btree ("localities_id");
  CREATE INDEX "_providers_v_rels_media_id_idx" ON "_providers_v_rels" USING btree ("media_id");
  CREATE INDEX "_providers_v_rels_users_id_idx" ON "_providers_v_rels" USING btree ("users_id");
  CREATE INDEX "requests_history_order_idx" ON "requests_history" USING btree ("_order");
  CREATE INDEX "requests_history_parent_id_idx" ON "requests_history" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "requests_code_idx" ON "requests" USING btree ("code");
  CREATE INDEX "requests_provider_idx" ON "requests" USING btree ("provider_id");
  CREATE INDEX "requests_category_idx" ON "requests" USING btree ("category_id");
  CREATE INDEX "requests_customer_idx" ON "requests" USING btree ("customer_id");
  CREATE INDEX "requests_locality_idx" ON "requests" USING btree ("locality_id");
  CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");
  CREATE UNIQUE INDEX "requests_idempotency_key_idx" ON "requests" USING btree ("idempotency_key");
  CREATE INDEX "requests_updated_at_idx" ON "requests" USING btree ("updated_at");
  CREATE INDEX "requests_created_at_idx" ON "requests" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_vertical_idx" ON "categories" USING btree ("vertical");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_active_idx" ON "categories" USING btree ("active");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "categories_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "categories_locales_parent_id_idx" ON "categories_locales" USING btree ("_parent_id");
  CREATE INDEX "localities_aliases_order_idx" ON "localities_aliases" USING btree ("_order");
  CREATE INDEX "localities_aliases_parent_id_idx" ON "localities_aliases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "localities_slug_idx" ON "localities" USING btree ("slug");
  CREATE INDEX "localities_town_idx" ON "localities" USING btree ("town");
  CREATE INDEX "localities_active_idx" ON "localities" USING btree ("active");
  CREATE INDEX "localities_search_text_idx" ON "localities" USING btree ("search_text");
  CREATE INDEX "localities_updated_at_idx" ON "localities" USING btree ("updated_at");
  CREATE INDEX "localities_created_at_idx" ON "localities" USING btree ("created_at");
  CREATE UNIQUE INDEX "localities_locales_locale_parent_id_unique" ON "localities_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "localities_locales_parent_id_idx" ON "localities_locales" USING btree ("_parent_id");
  CREATE INDEX "news_sources_order_idx" ON "news_sources" USING btree ("_order");
  CREATE INDEX "news_sources_parent_id_idx" ON "news_sources" USING btree ("_parent_id");
  CREATE INDEX "news_corrections_order_idx" ON "news_corrections" USING btree ("_order");
  CREATE INDEX "news_corrections_parent_id_idx" ON "news_corrections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "news_corrections_locales_locale_parent_id_unique" ON "news_corrections_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "news_corrections_locales_parent_id_idx" ON "news_corrections_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "news_slug_idx" ON "news" USING btree ("slug");
  CREATE INDEX "news_image_idx" ON "news" USING btree ("image_id");
  CREATE INDEX "news_published_at_idx" ON "news" USING btree ("published_at");
  CREATE INDEX "news_updated_at_idx" ON "news" USING btree ("updated_at");
  CREATE INDEX "news_created_at_idx" ON "news" USING btree ("created_at");
  CREATE INDEX "news__status_idx" ON "news" USING btree ("_status");
  CREATE UNIQUE INDEX "news_locales_locale_parent_id_unique" ON "news_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "news_locales_parent_id_idx" ON "news_locales" USING btree ("_parent_id");
  CREATE INDEX "_news_v_version_sources_order_idx" ON "_news_v_version_sources" USING btree ("_order");
  CREATE INDEX "_news_v_version_sources_parent_id_idx" ON "_news_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_news_v_version_corrections_order_idx" ON "_news_v_version_corrections" USING btree ("_order");
  CREATE INDEX "_news_v_version_corrections_parent_id_idx" ON "_news_v_version_corrections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_news_v_version_corrections_locales_locale_parent_id_unique" ON "_news_v_version_corrections_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_news_v_version_corrections_locales_parent_id_idx" ON "_news_v_version_corrections_locales" USING btree ("_parent_id");
  CREATE INDEX "_news_v_parent_idx" ON "_news_v" USING btree ("parent_id");
  CREATE INDEX "_news_v_version_version_slug_idx" ON "_news_v" USING btree ("version_slug");
  CREATE INDEX "_news_v_version_version_image_idx" ON "_news_v" USING btree ("version_image_id");
  CREATE INDEX "_news_v_version_version_published_at_idx" ON "_news_v" USING btree ("version_published_at");
  CREATE INDEX "_news_v_version_version_updated_at_idx" ON "_news_v" USING btree ("version_updated_at");
  CREATE INDEX "_news_v_version_version_created_at_idx" ON "_news_v" USING btree ("version_created_at");
  CREATE INDEX "_news_v_version_version__status_idx" ON "_news_v" USING btree ("version__status");
  CREATE INDEX "_news_v_created_at_idx" ON "_news_v" USING btree ("created_at");
  CREATE INDEX "_news_v_updated_at_idx" ON "_news_v" USING btree ("updated_at");
  CREATE INDEX "_news_v_snapshot_idx" ON "_news_v" USING btree ("snapshot");
  CREATE INDEX "_news_v_published_locale_idx" ON "_news_v" USING btree ("published_locale");
  CREATE INDEX "_news_v_latest_idx" ON "_news_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_news_v_locales_locale_parent_id_unique" ON "_news_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_news_v_locales_parent_id_idx" ON "_news_v_locales" USING btree ("_parent_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_locales_parent_id_idx" ON "media_locales" USING btree ("_parent_id");
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "users_phone_idx" ON "users" USING btree ("phone");
  CREATE INDEX "users_locality_idx" ON "users" USING btree ("locality_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");
  CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
  CREATE INDEX "audit_logs_target_id_idx" ON "audit_logs" USING btree ("target_id");
  CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");
  CREATE INDEX "audit_logs_updated_at_idx" ON "audit_logs" USING btree ("updated_at");
  CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
  CREATE INDEX "otp_challenges_phone_idx" ON "otp_challenges" USING btree ("phone");
  CREATE INDEX "otp_challenges_consumed_idx" ON "otp_challenges" USING btree ("consumed");
  CREATE INDEX "otp_challenges_updated_at_idx" ON "otp_challenges" USING btree ("updated_at");
  CREATE INDEX "otp_challenges_created_at_idx" ON "otp_challenges" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_providers_id_idx" ON "payload_locked_documents_rels" USING btree ("providers_id");
  CREATE INDEX "payload_locked_documents_rels_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("requests_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_localities_id_idx" ON "payload_locked_documents_rels" USING btree ("localities_id");
  CREATE INDEX "payload_locked_documents_rels_news_id_idx" ON "payload_locked_documents_rels" USING btree ("news_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_audit_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_logs_id");
  CREATE INDEX "payload_locked_documents_rels_otp_challenges_id_idx" ON "payload_locked_documents_rels" USING btree ("otp_challenges_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_emergency_contacts_order_idx" ON "site_settings_emergency_contacts" USING btree ("_order");
  CREATE INDEX "site_settings_emergency_contacts_parent_id_idx" ON "site_settings_emergency_contacts" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_settings_emergency_contacts_locales_locale_parent_id_un" ON "site_settings_emergency_contacts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_settings_emergency_contacts_locales_parent_id_idx" ON "site_settings_emergency_contacts_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_settings_locales_locale_parent_id_unique" ON "site_settings_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "site_settings_locales_parent_id_idx" ON "site_settings_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "providers_services" CASCADE;
  DROP TABLE "providers_services_locales" CASCADE;
  DROP TABLE "providers_hours" CASCADE;
  DROP TABLE "providers_hours_locales" CASCADE;
  DROP TABLE "providers" CASCADE;
  DROP TABLE "providers_locales" CASCADE;
  DROP TABLE "providers_rels" CASCADE;
  DROP TABLE "_providers_v_version_services" CASCADE;
  DROP TABLE "_providers_v_version_services_locales" CASCADE;
  DROP TABLE "_providers_v_version_hours" CASCADE;
  DROP TABLE "_providers_v_version_hours_locales" CASCADE;
  DROP TABLE "_providers_v" CASCADE;
  DROP TABLE "_providers_v_locales" CASCADE;
  DROP TABLE "_providers_v_rels" CASCADE;
  DROP TABLE "requests_history" CASCADE;
  DROP TABLE "requests" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_locales" CASCADE;
  DROP TABLE "localities_aliases" CASCADE;
  DROP TABLE "localities" CASCADE;
  DROP TABLE "localities_locales" CASCADE;
  DROP TABLE "news_sources" CASCADE;
  DROP TABLE "news_corrections" CASCADE;
  DROP TABLE "news_corrections_locales" CASCADE;
  DROP TABLE "news" CASCADE;
  DROP TABLE "news_locales" CASCADE;
  DROP TABLE "_news_v_version_sources" CASCADE;
  DROP TABLE "_news_v_version_corrections" CASCADE;
  DROP TABLE "_news_v_version_corrections_locales" CASCADE;
  DROP TABLE "_news_v" CASCADE;
  DROP TABLE "_news_v_locales" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "audit_logs" CASCADE;
  DROP TABLE "otp_challenges" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_emergency_contacts" CASCADE;
  DROP TABLE "site_settings_emergency_contacts_locales" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_locales" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_providers_services_pricing_type";
  DROP TYPE "public"."enum_providers_type";
  DROP TYPE "public"."enum_providers_status";
  DROP TYPE "public"."enum_providers_verification";
  DROP TYPE "public"."enum__providers_v_version_services_pricing_type";
  DROP TYPE "public"."enum__providers_v_version_type";
  DROP TYPE "public"."enum__providers_v_version_status";
  DROP TYPE "public"."enum__providers_v_version_verification";
  DROP TYPE "public"."enum_requests_kind";
  DROP TYPE "public"."enum_requests_preferred_window";
  DROP TYPE "public"."enum_requests_urgency";
  DROP TYPE "public"."enum_requests_status";
  DROP TYPE "public"."enum_categories_vertical";
  DROP TYPE "public"."enum_news_status";
  DROP TYPE "public"."enum__news_v_version_status";
  DROP TYPE "public"."enum__news_v_published_locale";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_users_preferred_language";
  DROP TYPE "public"."enum_site_settings_alert_banner_tone";`)
}
