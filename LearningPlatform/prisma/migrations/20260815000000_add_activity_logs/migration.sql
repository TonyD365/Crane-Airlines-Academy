CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_logs_timestamp_idx"
ON "activity_logs"("timestamp" DESC);

CREATE INDEX "activity_logs_actorUserId_idx"
ON "activity_logs"("actorUserId");

CREATE INDEX "activity_logs_action_idx"
ON "activity_logs"("action");

CREATE INDEX "activity_logs_resourceType_idx"
ON "activity_logs"("resourceType");
