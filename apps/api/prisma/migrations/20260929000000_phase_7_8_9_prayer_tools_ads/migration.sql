-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SheetMusicJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdvertiserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdCreativeFormat" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "AdEventType" AS ENUM ('IMPRESSION', 'VIEW', 'CLICK');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "ad_campaign_id" TEXT;

-- CreateTable
CREATE TABLE "prayer_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prayer_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayers" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "audio_url" TEXT,
    "audio_storage_key" TEXT,
    "audio_duration_sec" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prayers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prayer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prayer_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sermons" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "category_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "speaker_name" TEXT NOT NULL,
    "audio_url" TEXT NOT NULL,
    "audio_duration_sec" INTEGER,
    "image_url" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sermons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_music_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_song_id" TEXT,
    "source_url" TEXT,
    "source_storage_key" TEXT,
    "source_name" TEXT NOT NULL,
    "status" "SheetMusicJobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "sheet_music_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_sheet_music" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "tempo_bpm" INTEGER,
    "time_signature" TEXT,
    "note_count" INTEGER NOT NULL,
    "measure_count" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "engine" TEXT NOT NULL,
    "notes" JSONB NOT NULL,
    "music_xml" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_sheet_music_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "business_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "status" "AdvertiserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_placements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "placement_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "budget" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "rejection_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_creatives" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "format" "AdCreativeFormat" NOT NULL,
    "media_url" TEXT NOT NULL,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "duration_sec" INTEGER,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta_label" TEXT,
    "action_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creative_id" TEXT,
    "placement_key" TEXT NOT NULL,
    "event_type" "AdEventType" NOT NULL,
    "user_id" TEXT,
    "client_id" TEXT NOT NULL,
    "client_event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prayer_categories_slug_key" ON "prayer_categories"("slug");

-- CreateIndex
CREATE INDEX "prayers_status_published_at_idx" ON "prayers"("status", "published_at");

-- CreateIndex
CREATE INDEX "prayers_category_id_status_idx" ON "prayers"("category_id", "status");

-- CreateIndex
CREATE INDEX "prayers_author_id_created_at_idx" ON "prayers"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "prayer_favorites_prayer_id_idx" ON "prayer_favorites"("prayer_id");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_favorites_user_id_prayer_id_key" ON "prayer_favorites"("user_id", "prayer_id");

-- CreateIndex
CREATE INDEX "sermons_status_published_at_idx" ON "sermons"("status", "published_at");

-- CreateIndex
CREATE INDEX "sermons_category_id_idx" ON "sermons"("category_id");

-- CreateIndex
CREATE INDEX "sheet_music_jobs_user_id_created_at_idx" ON "sheet_music_jobs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sheet_music_jobs_status_created_at_idx" ON "sheet_music_jobs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "generated_sheet_music_job_id_key" ON "generated_sheet_music"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_user_id_key" ON "advertisers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_placements_key_key" ON "ad_placements"("key");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_placement_id_idx" ON "ad_campaigns"("status", "placement_id");

-- CreateIndex
CREATE INDEX "ad_campaigns_advertiser_id_created_at_idx" ON "ad_campaigns"("advertiser_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_creatives_campaign_id_idx" ON "ad_creatives"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_events_client_event_id_key" ON "ad_events"("client_event_id");

-- CreateIndex
CREATE INDEX "ad_events_campaign_id_event_type_idx" ON "ad_events"("campaign_id", "event_type");

-- CreateIndex
CREATE INDEX "ad_events_placement_key_event_type_created_at_idx" ON "ad_events"("placement_key", "event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_ad_campaign_id_key" ON "payment_transactions"("ad_campaign_id");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_ad_campaign_id_fkey" FOREIGN KEY ("ad_campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayers" ADD CONSTRAINT "prayers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayers" ADD CONSTRAINT "prayers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "prayer_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_favorites" ADD CONSTRAINT "prayer_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_favorites" ADD CONSTRAINT "prayer_favorites_prayer_id_fkey" FOREIGN KEY ("prayer_id") REFERENCES "prayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "prayer_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_music_jobs" ADD CONSTRAINT "sheet_music_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_music_jobs" ADD CONSTRAINT "sheet_music_jobs_source_song_id_fkey" FOREIGN KEY ("source_song_id") REFERENCES "songs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_sheet_music" ADD CONSTRAINT "generated_sheet_music_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "sheet_music_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisers" ADD CONSTRAINT "advertisers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "ad_placements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "ad_creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

