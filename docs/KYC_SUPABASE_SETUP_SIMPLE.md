# KYC Supabase Setup - Simple Guide

## What You Need to Do

Your Supabase is **already configured** for the database! You just need to add **one more key** for document uploads.

### Step 1: Get Your Service Role Key

1. Go to https://supabase.com/dashboard
2. Click on your project: **htdehmkqfrwjewzjingm**
3. Go to **Settings** → **API**
4. Scroll down to **Project API keys**
5. Copy the **`service_role`** key (NOT the `anon` key you already have)

### Step 2: Add to .env

Open your `.env` file and replace this line:

```
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
```

With your actual service role key:

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 3: Create the Bucket

Run this command:

```bash
npx tsx scripts/setup-kyc-supabase-bucket.ts
```

This will:
- ✅ Check your Supabase connection
- ✅ Create the `kyc-documents` bucket (private)
- ✅ Set file size limit to 5MB
- ✅ Allow only images and PDFs
- ✅ Test the upload

### Step 4: Test It

1. Start your dev server: `npm run dev`
2. Go to http://localhost:3000/vendor/kyc/tier2-manual
3. Fill the form and upload documents
4. Submit!

---

## Why Do You Need This?

- **`SUPABASE_URL`** - You already have this ✅
- **`SUPABASE_ANON_KEY`** - You already have this ✅ (for database)
- **`NEXT_PUBLIC_SUPABASE_URL`** - I just added this ✅ (same as SUPABASE_URL)
- **`SUPABASE_SERVICE_ROLE_KEY`** - You need to add this ⚠️ (for file uploads with admin privileges)

The **service role key** has admin privileges to upload files to private buckets. The anon key can't do this for security reasons.

---

## What If I Don't Want to Use Supabase?

The KYC system will still work! It will just show an error when trying to upload documents. You can:

1. **Option A**: Use Supabase (recommended - it's free for your usage)
2. **Option B**: Modify the code to use Cloudinary (you already have this configured)
3. **Option C**: Store documents locally (not recommended for production)

---

## Quick Check

After adding the service role key, run:

```bash
npx tsx scripts/test-kyc-complete-flow.ts
```

You should see:
```
✅ Supabase configured
✅ Bucket check complete
```

Instead of:
```
⚠️  Supabase not configured
```

---

**That's it!** Just one environment variable to add, then run the setup script.
