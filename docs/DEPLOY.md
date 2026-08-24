# Deploying ClaimOps for $0

The app runs fine with zero configuration (in-memory seed data). These
steps get you a shareable live URL on free tiers.

## 1. Push to GitHub
```
git init
git add .
git commit -m "Initial commit: ClaimOps"
gh repo create claimops --public --source=. --push
# or create the repo on github.com and:
# git remote add origin https://github.com/<you>/claimops.git
# git push -u origin main
```

## 2. Deploy to Vercel (free tier)
1. Go to vercel.com → sign in with GitHub.
2. "Add New Project" → import your `claimops` repo.
3. Framework preset auto-detects Next.js. Leave build settings as default.
4. Click Deploy. You'll get a `*.vercel.app` URL in about a minute.

The app works immediately at this point — it's using in-memory seed data.

## 3. (Optional) Add real persistence with Supabase (free tier)
1. Go to supabase.com → New project (free tier).
2. In the SQL editor, paste the contents of `supabase/schema.sql` and run it.
3. In Project Settings → API, copy the Project URL and `anon` public key.
4. In Vercel → your project → Settings → Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Redeploy. (Note: as shipped, the UI still reads from seed data — wiring
   the claim-detail approve/reject actions and the queue list to Supabase
   reads/writes is the natural next PR; the schema and client are ready for
   it. Being upfront about this in an interview is better than claiming
   it's already fully wired.)

## 4. Custom domain (optional, still free)
Vercel free tier supports custom domains if you already own one — add it
under Project → Settings → Domains.
