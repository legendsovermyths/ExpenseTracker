


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."entry_kind" AS ENUM (
    'SPLIT',
    'PAYMENT'
);


ALTER TYPE "public"."entry_kind" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_balance_pair"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  refresh materialized view concurrently balance_pair;
  return null;
end $$;


ALTER FUNCTION "public"."bump_balance_pair"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.email
  );
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_grp_creator"("gid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from grp g where g.id = gid and g.created_by = uid);
$$;


ALTER FUNCTION "public"."is_grp_creator"("gid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_grp_member"("gid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from grp_member m
    where m.grp_id = gid and m.user_id = uid and not m.is_deleted
  );
$$;


ALTER FUNCTION "public"."is_grp_member"("gid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_fund_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.is_shared and new.other_participant_id is not null then
    insert into notifications (user_id, type, actor_id, payload)
    values (
      new.other_participant_id,
      'fund_created',
      new.owner_id,
      jsonb_build_object('fund_id', new.id, 'fund_name', new.name)
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_fund_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_fund_participant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  f record;
  recipient uuid;
begin
  select owner_id, other_participant_id, name into f
    from fund where id = new.fund_id;

  recipient := case when f.owner_id = new.contributor_id
                     then f.other_participant_id
                     else f.owner_id end;

  if recipient is null then
    return new; -- solo fund, no one to notify
  end if;

  insert into notifications (user_id, type, actor_id, payload)
  values (
    recipient,
    case when new.direction = 'WITHDRAWAL' then 'fund_withdrawal' else 'fund_contribution' end,
    new.contributor_id,
    jsonb_build_object(
      'fund_id', new.fund_id,
      'fund_name', f.name,
      'amount_cents', new.amount_cents
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_fund_participant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_grp_member_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  g record;
begin
  select id, name, created_by into g from grp where id = new.grp_id;
  if auth.uid() is null or new.user_id = auth.uid() or new.is_deleted then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, payload)
  values (
    new.user_id,
    'group_added',
    auth.uid(),
    jsonb_build_object('grp_id', g.id, 'group_name', g.name)
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_grp_member_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_split_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  entry record;
begin
  select le.id, le.description, le.total_cents, le.created_by, le.kind, le.grp_id, g.name as grp_name
    into entry
    from ledger_entry le
    left join grp g on g.id = le.grp_id
    where le.id = new.entry_id;

  if entry.created_by is null or entry.created_by = new.user_id then
    return new;
  end if;

  -- Group members left out of an expense are stored as zero line items.
  if coalesce(new.paid_cents, 0) = 0 and coalesce(new.owed_cents, 0) = 0 then
    return new;
  end if;

  insert into notifications (user_id, type, actor_id, payload)
  values (
    new.user_id,
    case when entry.kind = 'PAYMENT' then 'split_payment' else 'split_added' end,
    entry.created_by,
    jsonb_build_object(
      'entry_id', entry.id,
      'description', entry.description,
      'amount_cents', new.amount_cents,
      'grp_id', entry.grp_id,
      'group_name', entry.grp_name
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."notify_split_participants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_balance_mv"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform 1;  -- noop, but keeps body non-empty
  refresh materialized view concurrently balance_pair;
  return null;
end $$;


ALTER FUNCTION "public"."refresh_balance_mv"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_balance_pair_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  refresh materialized view concurrently balance_pair;
  return null;              -- trigger functions must return null or NEW/OLD
end;
$$;


ALTER FUNCTION "public"."refresh_balance_pair_trg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_last_modified"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.last_modified := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_last_modified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_send_push"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'extensions'
    AS $$
declare
  service_key text;
  function_url text := 'https://vxytlhgnldfjmcafcewl.supabase.co/functions/v1/send-push';
begin
  select decrypted_secret into service_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;

  if service_key is null then
    -- Secret not seeded yet — don't fail the notification insert over it.
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', row_to_json(new)
    )
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."trigger_send_push"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_entry"("eid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from ledger_entry le
    where le.id = eid
      and (
        le.created_by = uid
        or exists (select 1 from line_item li where li.entry_id = le.id and li.user_id = uid)
        or (le.grp_id is not null and is_grp_member(le.grp_id, uid))
      )
  );
$$;


ALTER FUNCTION "public"."user_can_access_entry"("eid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  SELECT EXISTS (
    SELECT 1 FROM ledger_entry 
    WHERE ledger_entry.id::text = $1 AND ledger_entry.created_by::text = $2
  );
$_$;


ALTER FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM ledger_entry 
    WHERE ledger_entry.id::text = entry_id::text 
      AND ledger_entry.created_by::text = user_id::text
  );
$$;


ALTER FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_created_entry"("entry_id" "uuid", "user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM ledger_entry 
    WHERE ledger_entry.id = entry_id AND ledger_entry.created_by = user_id
  );
$$;


ALTER FUNCTION "public"."user_created_entry"("entry_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_in_entry"("eid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select exists (
    select 1 from line_item
    where entry_id = eid
      and user_id  = auth.uid()
  );
$$;


ALTER FUNCTION "public"."user_in_entry"("eid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  SELECT EXISTS (
    SELECT 1 FROM line_item 
    WHERE line_item.entry_id::text = $1 AND line_item.user_id::text = $2
  );
$_$;


ALTER FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  select exists (
    select 1 from line_item li where li.entry_id::text = $1 and li.user_id = $2
  );
$_$;


ALTER FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_participates_in_entry"("entry_id" "uuid", "user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
  select exists (
    select 1 from line_item li where li.entry_id = $1 and li.user_id = $2
  );
$_$;


ALTER FUNCTION "public"."user_participates_in_entry"("entry_id" "uuid", "user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ledger_entry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "public"."entry_kind" NOT NULL,
    "description" "text",
    "grp_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_cents" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false
);


ALTER TABLE "public"."ledger_entry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."line_item" (
    "entry_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_cents" bigint,
    "owed_cents" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "line_amount_consistency" CHECK (("amount_cents" = (COALESCE("paid_cents", (0)::bigint) - COALESCE("owed_cents", (0)::bigint))))
);


ALTER TABLE "public"."line_item" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."balance_pair" AS
 WITH "entry_credit" AS (
         SELECT "li"."entry_id",
            "count"(*) AS "n",
            "sum"("li"."amount_cents") FILTER (WHERE ("li"."amount_cents" > 0)) AS "credit"
           FROM ("public"."line_item" "li"
             JOIN "public"."ledger_entry" "le" ON (("le"."id" = "li"."entry_id")))
          WHERE (COALESCE("le"."is_deleted", false) = false)
          GROUP BY "li"."entry_id"
        )
 SELECT "lo"."user_id" AS "user_lo",
    "hi"."user_id" AS "user_hi",
    ("sum"("round"(
        CASE
            WHEN ("ec"."n" = 2) THEN (- ("hi"."amount_cents")::numeric)
            WHEN (("ec"."credit" IS NULL) OR ("ec"."credit" = (0)::numeric)) THEN (0)::numeric
            WHEN (("lo"."amount_cents" > 0) AND ("hi"."amount_cents" < 0)) THEN (((- ("hi"."amount_cents")::numeric) * ("lo"."amount_cents")::numeric) / "ec"."credit")
            WHEN (("lo"."amount_cents" < 0) AND ("hi"."amount_cents" > 0)) THEN ((("lo"."amount_cents")::numeric * ("hi"."amount_cents")::numeric) / "ec"."credit")
            ELSE (0)::numeric
        END)))::bigint AS "net_cents"
   FROM (("public"."line_item" "lo"
     JOIN "public"."line_item" "hi" ON ((("hi"."entry_id" = "lo"."entry_id") AND ("hi"."user_id" > "lo"."user_id"))))
     JOIN "entry_credit" "ec" ON (("ec"."entry_id" = "lo"."entry_id")))
  GROUP BY "lo"."user_id", "hi"."user_id"
  WITH NO DATA;


ALTER TABLE "public"."balance_pair" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."balance_pair_me" AS
 SELECT "balance_pair"."user_lo",
    "balance_pair"."user_hi",
    "balance_pair"."net_cents"
   FROM "public"."balance_pair"
  WHERE (("balance_pair"."user_lo" = "auth"."uid"()) OR ("balance_pair"."user_hi" = "auth"."uid"()));


ALTER TABLE "public"."balance_pair_me" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fund" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon_name" "text",
    "icon_type" "text",
    "is_shared" boolean DEFAULT false NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "other_participant_id" "uuid",
    "target_cents" bigint,
    "target_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "other_participant_name" "text"
);


ALTER TABLE "public"."fund" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fund_entry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fund_id" "uuid" NOT NULL,
    "contributor_id" "uuid" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "direction" "text" NOT NULL,
    "note" "text",
    "linked_transaction_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "fund_entry_direction_check" CHECK (("direction" = ANY (ARRAY['CONTRIBUTION'::"text", 'WITHDRAWAL'::"text"])))
);


ALTER TABLE "public"."fund_entry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."grp" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grp_member" (
    "grp_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_modified" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."grp_member" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "push_sent_at" timestamp with time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


ALTER TABLE ONLY "public"."fund_entry"
    ADD CONSTRAINT "fund_entry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fund"
    ADD CONSTRAINT "fund_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grp_member"
    ADD CONSTRAINT "grp_member_pkey" PRIMARY KEY ("grp_id", "user_id");



ALTER TABLE ONLY "public"."grp"
    ADD CONSTRAINT "grp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ledger_entry"
    ADD CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_item"
    ADD CONSTRAINT "line_item_pkey" PRIMARY KEY ("entry_id", "user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_token_key" UNIQUE ("user_id", "token");



CREATE UNIQUE INDEX "balance_pair_uidx" ON "public"."balance_pair" USING "btree" ("user_lo", "user_hi");



CREATE INDEX "grp_member_user_idx" ON "public"."grp_member" USING "btree" ("user_id");



CREATE INDEX "idx_fund_entry_fund_updated" ON "public"."fund_entry" USING "btree" ("fund_id", "updated_at");



CREATE INDEX "idx_fund_updated" ON "public"."fund" USING "btree" ("updated_at");



CREATE INDEX "idx_notifications_user_created" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "ledger_entry_grp_idx" ON "public"."ledger_entry" USING "btree" ("grp_id");



CREATE OR REPLACE TRIGGER "le_refresh_balance" AFTER UPDATE OF "is_deleted" ON "public"."ledger_entry" FOR EACH ROW WHEN (("new"."is_deleted" IS DISTINCT FROM "old"."is_deleted")) EXECUTE FUNCTION "public"."refresh_balance_pair_trg"();



CREATE OR REPLACE TRIGGER "refresh_balance_pair_after_insert" AFTER INSERT ON "public"."line_item" FOR EACH STATEMENT EXECUTE FUNCTION "public"."bump_balance_pair"();



CREATE OR REPLACE TRIGGER "refresh_balance_pair_after_li_change" AFTER DELETE OR UPDATE ON "public"."line_item" FOR EACH STATEMENT EXECUTE FUNCTION "public"."bump_balance_pair"();



CREATE OR REPLACE TRIGGER "touch_entry" BEFORE UPDATE ON "public"."ledger_entry" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_modified"();



CREATE OR REPLACE TRIGGER "touch_grp" BEFORE UPDATE ON "public"."grp" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_modified"();



CREATE OR REPLACE TRIGGER "touch_grp_member_updated_at" BEFORE UPDATE ON "public"."grp_member" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "touch_grp_updated_at" BEFORE UPDATE ON "public"."grp" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "touch_grpmem" BEFORE UPDATE ON "public"."grp_member" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_modified"();



CREATE OR REPLACE TRIGGER "touch_ledger_entry" BEFORE UPDATE ON "public"."ledger_entry" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "touch_line" BEFORE UPDATE ON "public"."line_item" FOR EACH ROW EXECUTE FUNCTION "public"."touch_last_modified"();



CREATE OR REPLACE TRIGGER "touch_line_item" BEFORE UPDATE ON "public"."line_item" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notify_fund_created" AFTER INSERT ON "public"."fund" FOR EACH ROW EXECUTE FUNCTION "public"."notify_fund_created"();



CREATE OR REPLACE TRIGGER "trg_notify_fund_participant" AFTER INSERT ON "public"."fund_entry" FOR EACH ROW EXECUTE FUNCTION "public"."notify_fund_participant"();



CREATE OR REPLACE TRIGGER "trg_notify_grp_member_added" AFTER INSERT ON "public"."grp_member" FOR EACH ROW EXECUTE FUNCTION "public"."notify_grp_member_added"();



CREATE OR REPLACE TRIGGER "trg_notify_split_participants" AFTER INSERT ON "public"."line_item" FOR EACH ROW EXECUTE FUNCTION "public"."notify_split_participants"();



CREATE OR REPLACE TRIGGER "trg_send_push" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_send_push"();



ALTER TABLE ONLY "public"."fund_entry"
    ADD CONSTRAINT "fund_entry_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fund_entry"
    ADD CONSTRAINT "fund_entry_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "public"."fund"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fund"
    ADD CONSTRAINT "fund_other_participant_id_fkey" FOREIGN KEY ("other_participant_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fund"
    ADD CONSTRAINT "fund_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grp"
    ADD CONSTRAINT "grp_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."grp_member"
    ADD CONSTRAINT "grp_member_grp_id_fkey" FOREIGN KEY ("grp_id") REFERENCES "public"."grp"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grp_member"
    ADD CONSTRAINT "grp_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledger_entry"
    ADD CONSTRAINT "ledger_entry_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ledger_entry"
    ADD CONSTRAINT "ledger_entry_grp_id_fkey" FOREIGN KEY ("grp_id") REFERENCES "public"."grp"("id");



ALTER TABLE ONLY "public"."line_item"
    ADD CONSTRAINT "line_item_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."line_item"
    ADD CONSTRAINT "line_item_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated read" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."fund" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fund_entry" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fund_entry_contributor_insert" ON "public"."fund_entry" FOR INSERT WITH CHECK ((("auth"."uid"() = "contributor_id") AND (EXISTS ( SELECT 1
   FROM "public"."fund" "f"
  WHERE (("f"."id" = "fund_entry"."fund_id") AND (("auth"."uid"() = "f"."owner_id") OR ("auth"."uid"() = "f"."other_participant_id")))))));



CREATE POLICY "fund_entry_contributor_update" ON "public"."fund_entry" FOR UPDATE USING (("auth"."uid"() = "contributor_id")) WITH CHECK (("auth"."uid"() = "contributor_id"));



CREATE POLICY "fund_entry_participant_select" ON "public"."fund_entry" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."fund" "f"
  WHERE (("f"."id" = "fund_entry"."fund_id") AND (("auth"."uid"() = "f"."owner_id") OR ("auth"."uid"() = "f"."other_participant_id"))))));



CREATE POLICY "fund_owner_insert" ON "public"."fund" FOR INSERT WITH CHECK ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "other_participant_id")));



CREATE POLICY "fund_participant_select" ON "public"."fund" FOR SELECT USING ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "other_participant_id")));



CREATE POLICY "fund_participant_update" ON "public"."fund" FOR UPDATE USING ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "other_participant_id"))) WITH CHECK ((("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "other_participant_id")));



ALTER TABLE "public"."grp" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "grp_insert" ON "public"."grp" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) OR "public"."is_grp_member"("id", "auth"."uid"())));



ALTER TABLE "public"."grp_member" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "grp_member_insert" ON "public"."grp_member" FOR INSERT WITH CHECK (("public"."is_grp_creator"("grp_id", "auth"."uid"()) OR "public"."is_grp_member"("grp_id", "auth"."uid"())));



CREATE POLICY "grp_member_select" ON "public"."grp_member" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_grp_member"("grp_id", "auth"."uid"()) OR "public"."is_grp_creator"("grp_id", "auth"."uid"())));



CREATE POLICY "grp_member_update" ON "public"."grp_member" FOR UPDATE USING (("public"."is_grp_creator"("grp_id", "auth"."uid"()) OR "public"."is_grp_member"("grp_id", "auth"."uid"()))) WITH CHECK (("public"."is_grp_creator"("grp_id", "auth"."uid"()) OR "public"."is_grp_member"("grp_id", "auth"."uid"())));



CREATE POLICY "grp_select" ON "public"."grp" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."grp_member" "m"
  WHERE (("m"."grp_id" = "grp"."id") AND ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "grp_update" ON "public"."grp" FOR UPDATE USING ((("created_by" = "auth"."uid"()) OR "public"."is_grp_member"("id", "auth"."uid"()))) WITH CHECK ((("created_by" = "auth"."uid"()) OR "public"."is_grp_member"("id", "auth"."uid"())));



ALTER TABLE "public"."ledger_entry" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ledger_entry_delete_policy" ON "public"."ledger_entry" FOR DELETE USING ((("created_by" = "auth"."uid"()) OR "public"."user_can_access_entry"("id", "auth"."uid"())));



CREATE POLICY "ledger_entry_insert_policy" ON "public"."ledger_entry" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "ledger_entry_select_policy" ON "public"."ledger_entry" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR "public"."user_can_access_entry"("id", "auth"."uid"())));



CREATE POLICY "ledger_entry_update_policy" ON "public"."ledger_entry" FOR UPDATE USING ((("created_by" = "auth"."uid"()) OR "public"."user_can_access_entry"("id", "auth"."uid"()))) WITH CHECK ((("created_by" = "auth"."uid"()) OR "public"."user_can_access_entry"("id", "auth"."uid"())));



ALTER TABLE "public"."line_item" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "line_item_delete_policy" ON "public"."line_item" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR "public"."user_created_entry"("entry_id", "auth"."uid"())));



CREATE POLICY "line_item_insert_policy" ON "public"."line_item" FOR INSERT WITH CHECK ("public"."user_can_access_entry"("entry_id", "auth"."uid"()));



CREATE POLICY "line_item_select_policy" ON "public"."line_item" FOR SELECT USING ("public"."user_can_access_entry"("entry_id", "auth"."uid"()));



CREATE POLICY "line_item_update_policy" ON "public"."line_item" FOR UPDATE USING ("public"."user_can_access_entry"("entry_id", "auth"."uid"())) WITH CHECK ("public"."user_can_access_entry"("entry_id", "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_owner_select" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_owner_update" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_tokens_owner_rw" ON "public"."push_tokens" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_balance_pair"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_balance_pair"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_balance_pair"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_grp_creator"("gid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_grp_creator"("gid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_grp_creator"("gid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_grp_member"("gid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_grp_member"("gid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_grp_member"("gid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_fund_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_fund_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_fund_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_fund_participant"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_fund_participant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_fund_participant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_grp_member_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_grp_member_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_grp_member_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_split_participants"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_split_participants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_split_participants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_balance_mv"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_balance_mv"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_balance_mv"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_balance_pair_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_balance_pair_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_balance_pair_trg"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_last_modified"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_last_modified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_last_modified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_send_push"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_send_push"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_send_push"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_entry"("eid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_entry"("eid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_entry"("eid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "text", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_created_entry"("entry_id" "uuid", "user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_in_entry"("eid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_in_entry"("eid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_in_entry"("eid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_in_entry"("eid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "text", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_participates_in_entry"("entry_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."ledger_entry" TO "anon";
GRANT ALL ON TABLE "public"."ledger_entry" TO "authenticated";
GRANT ALL ON TABLE "public"."ledger_entry" TO "service_role";



GRANT ALL ON TABLE "public"."line_item" TO "anon";
GRANT ALL ON TABLE "public"."line_item" TO "authenticated";
GRANT ALL ON TABLE "public"."line_item" TO "service_role";



GRANT ALL ON TABLE "public"."balance_pair" TO "service_role";



GRANT ALL ON TABLE "public"."balance_pair_me" TO "anon";
GRANT ALL ON TABLE "public"."balance_pair_me" TO "authenticated";
GRANT ALL ON TABLE "public"."balance_pair_me" TO "service_role";



GRANT ALL ON TABLE "public"."fund" TO "anon";
GRANT ALL ON TABLE "public"."fund" TO "authenticated";
GRANT ALL ON TABLE "public"."fund" TO "service_role";



GRANT ALL ON TABLE "public"."fund_entry" TO "anon";
GRANT ALL ON TABLE "public"."fund_entry" TO "authenticated";
GRANT ALL ON TABLE "public"."fund_entry" TO "service_role";



GRANT ALL ON TABLE "public"."grp" TO "anon";
GRANT ALL ON TABLE "public"."grp" TO "authenticated";
GRANT ALL ON TABLE "public"."grp" TO "service_role";



GRANT ALL ON TABLE "public"."grp_member" TO "anon";
GRANT ALL ON TABLE "public"."grp_member" TO "authenticated";
GRANT ALL ON TABLE "public"."grp_member" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";







