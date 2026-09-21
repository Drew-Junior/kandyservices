# Running this migration

## 1. Run the schema
Open your Supabase project → **SQL Editor** → New query. Paste the full
contents of `001_initial_schema.sql`, then click **Run**. This creates every
table, RLS policy, and function. It's safe to re-run (uses `if not exists`
and `on conflict do nothing` throughout).

## 2. Create the storage bucket
Go to **Storage** → **New bucket** → name it exactly `site-media` (private is
fine — the policies below handle public read access at the row level, so it
does not need to be a "public" bucket).

Then run `002_storage_policies.sql` in the SQL Editor.

## 3. Create your admin login
This is the account you'll use to log into the dashboard.

1. Go to **Authentication → Users → Add user**.
2. Enter your email and a password, and check "Auto Confirm User".
3. Copy the new user's UID (shown in the users list).
4. Back in the SQL Editor, run:
   ```sql
   insert into public.profiles (id, role) values ('PASTE-THE-UID-HERE', 'admin');
   ```

That's it — the schema, storage policies, and admin account are all in
place. Once you've done these three steps, let me know and I'll wire the
actual site (`data.js`, `dashboard.js`, `script.js`) to read and write
through Supabase instead of localStorage.
