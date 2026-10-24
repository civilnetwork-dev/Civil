CREATE TABLE "goguardian_manifest_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"manifest_key" text NOT NULL,
	"extension_id" text NOT NULL,
	"school_district_lea_id" text,
	"school_district_name" text,
	"submitted_by_user_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "goguardian_manifest_keys" ADD CONSTRAINT "goguardian_manifest_keys_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goguardian_manifest_keys_extension_id_idx" ON "goguardian_manifest_keys" USING btree ("extension_id");--> statement-breakpoint
CREATE INDEX "goguardian_manifest_keys_lea_id_idx" ON "goguardian_manifest_keys" USING btree ("school_district_lea_id");