CREATE TABLE "iboss_gateways" (
	"id" serial PRIMARY KEY NOT NULL,
	"gateway_host" text NOT NULL,
	"categorization_port" integer DEFAULT 8026 NOT NULL,
	"security_key" text,
	"school_district_lea_id" text,
	"school_district_name" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"submitted_by_user_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "iboss_gateways" ADD CONSTRAINT "iboss_gateways_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "iboss_gateways_host_lea_idx" ON "iboss_gateways" USING btree ("gateway_host","school_district_lea_id");--> statement-breakpoint
CREATE INDEX "iboss_gateways_lea_id_idx" ON "iboss_gateways" USING btree ("school_district_lea_id");