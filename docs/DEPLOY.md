# Deploying ClaimOps

## 1. Set up Postgres (Supabase free tier)

1. Go to supabase.com → sign up → New project (free tier).
2. Once it's provisioned, click the **Connect** button on the project
   dashboard → copy the connection string under **URI**.
3. Replace `[YOUR-PASSWORD]` in that string with your actual database
   password.
4. In the **SQL Editor**, paste the entire contents of `supabase/schema.sql`
   from this repo and run it. Confirm it worked by checking **Table Editor**
   for `organizations`, `claims`, `rules`, `adjusters`, `claim_events`,
   `users`, `policy_documents`, `document_chunks`.

## 2. Run it locally first

Create `.env.local` in the project root:
```
DATABASE_URL=postgresql://postgres:your-password@your-host.supabase.co:5432/postgres
```

```bash
npm install
npm run db:seed
npm run dev
```
Open `http://localhost:3000` and confirm it works before deploying.

## 3. Push to GitHub

```bash
git add -A
git commit -m "Deploy prep"
git remote add origin https://github.com/<you>/claimops.git
git branch -M main
git push -u origin main
```

## 4. Deploy to Vercel (free tier)

1. Go to vercel.com → sign in with GitHub.
2. "Add New Project" → import your `claimops` repo.
3. Before clicking Deploy, expand **Environment Variables** and add:
   - `DATABASE_URL` — the same connection string from `.env.local`
4. Click Deploy. You'll get a `*.vercel.app` URL in about a minute.

Because the app now uses real Postgres rather than a local file, data
created on the deployed app (new claims, approvals, uploaded documents)
persists properly — it's the same database your local dev environment
talks to, unless you point production at a separate Supabase project.

## 5. Custom domain (optional, still free)

Vercel free tier supports custom domains if you already own one — add it
under Project → Settings → Domains.
