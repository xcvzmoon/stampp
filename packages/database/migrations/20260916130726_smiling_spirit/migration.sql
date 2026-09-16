CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"actor_user_id" text,
	"action" varchar(128) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
