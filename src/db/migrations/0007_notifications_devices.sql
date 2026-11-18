-- Nikki Multiplatform Notifications & Device Subscriptions

CREATE TABLE IF NOT EXISTS "notification_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "device_label" text NOT NULL DEFAULT 'Device',
  "endpoint" text,
  "p256dh" text,
  "auth_secret" text,
  "fcm_token" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notification_subs_user_idx" ON "notification_subscriptions" ("user_id", "is_active");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "category" text NOT NULL DEFAULT 'system',
  "title" text NOT NULL,
  "body" text NOT NULL,
  "href" text NOT NULL DEFAULT '/dashboard',
  "dedupe_key" text,
  "scheduled_for" timestamptz,
  "delivered_at" timestamptz,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_dedupe_uidx" ON "notifications" ("user_id", "dedupe_key");

ALTER TABLE "notification_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_subscriptions_owner_policy" ON "notification_subscriptions";
CREATE POLICY "notification_subscriptions_owner_policy" ON "notification_subscriptions" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());

DROP POLICY IF EXISTS "notifications_owner_policy" ON "notifications";
CREATE POLICY "notifications_owner_policy" ON "notifications" FOR ALL USING ("user_id" = public.nikki_current_user_id()) WITH CHECK ("user_id" = public.nikki_current_user_id());
