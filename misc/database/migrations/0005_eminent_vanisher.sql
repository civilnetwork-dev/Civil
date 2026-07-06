CREATE TABLE "site_proxy_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostname" text NOT NULL,
	"proxy" text NOT NULL,
	"transport" text DEFAULT 'epoxy' NOT NULL,
	"wisp_version" integer DEFAULT 2 NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "site_proxy_configs_hostname_idx" ON "site_proxy_configs" USING btree ("hostname");