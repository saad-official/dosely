CREATE SCHEMA IF NOT EXISTS "dosely";
--> statement-breakpoint
CREATE TYPE "dosely"."circle_role" AS ENUM('member', 'caregiver');--> statement-breakpoint
CREATE TYPE "dosely"."platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TABLE "dosely"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dosely"."circle_members" (
	"circle_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "dosely"."circle_role" NOT NULL,
	"profile_name" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_members_circle_id_user_id_pk" PRIMARY KEY("circle_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "dosely"."circles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circles_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "dosely"."devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" "dosely"."platform" NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_expo_push_token_unique" UNIQUE("expo_push_token")
);
--> statement-breakpoint
CREATE TABLE "dosely"."doses" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"medication_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"taken_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"source" text DEFAULT 'schedule' NOT NULL,
	CONSTRAINT "doses_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "dosely"."escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"dose_id" text NOT NULL,
	"user_id" text NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dosely"."medications" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" text NOT NULL,
	"name" text NOT NULL,
	"strength" text,
	"form" text,
	"instructions" text,
	"color" text,
	"schedule" jsonb NOT NULL,
	"window_minutes" integer DEFAULT 60 NOT NULL,
	"inventory_count" integer,
	"refill_threshold" integer,
	CONSTRAINT "medications_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "dosely"."profiles" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	"server_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"avatar_initial" text,
	CONSTRAINT "profiles_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "dosely"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "dosely"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "dosely"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dosely"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."circle_members" ADD CONSTRAINT "circle_members_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "dosely"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."circle_members" ADD CONSTRAINT "circle_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."circles" ADD CONSTRAINT "circles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."devices" ADD CONSTRAINT "devices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."doses" ADD CONSTRAINT "doses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."escalations" ADD CONSTRAINT "escalations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."medications" ADD CONSTRAINT "medications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dosely"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "dosely"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "dosely"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "circle_members_user_id_idx" ON "dosely"."circle_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "circles_owner_user_id_idx" ON "dosely"."circles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "devices_user_id_idx" ON "dosely"."devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "doses_user_server_updated_idx" ON "dosely"."doses" USING btree ("user_id","server_updated_at");--> statement-breakpoint
CREATE INDEX "doses_user_due_idx" ON "dosely"."doses" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "doses_unmarked_due_idx" ON "dosely"."doses" USING btree ("due_at") WHERE "dosely"."doses"."taken_at" is null and "dosely"."doses"."skipped_at" is null and "dosely"."doses"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "escalations_user_dose_idx" ON "dosely"."escalations" USING btree ("user_id","dose_id");--> statement-breakpoint
CREATE INDEX "medications_user_server_updated_idx" ON "dosely"."medications" USING btree ("user_id","server_updated_at");--> statement-breakpoint
CREATE INDEX "profiles_user_server_updated_idx" ON "dosely"."profiles" USING btree ("user_id","server_updated_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "dosely"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "dosely"."verification" USING btree ("identifier");