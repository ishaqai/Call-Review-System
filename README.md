# Call-Review-System
This repository is going to hold all records of my calls and get an insight of my calls like how it went with different clients.

# Call Review System

A lightweight, private call-recording interface for tracking leads, conversations, outcomes, conclusions, feedback, ratings, and follow-ups.

Each record can include Lead ID, company, job title, source, skill/category, required skill, achievement date, lead owner, candidate, lead type, interview stage, call purpose, recruiter/assignee, outcome, rating, conclusion, feedback, and next follow-up.

## Use it

Open `index.html` in a browser. Records work locally; sign in to enable Supabase cloud sync across devices.

Use **Export JSON** regularly to create a backup. The exported file can be restored with **Import JSON**.

## Supabase cloud setup

1. Run `supabase-setup.sql` in the Supabase SQL Editor.
2. In Supabase Authentication settings, enable email/password sign-in. Set the site's URL to `https://ishaqai.github.io/Call-Review-System/` and add it to the allowed redirect URLs.
3. Deploy the site. The project URL and publishable key are configured in `supabase-config.js`; only a publishable key belongs in browser code.
4. Sign in or create your account in the app. Browser-only records are uploaded at sign-in, and subsequent saves sync to the cloud.

The table has row-level security enabled. Each authenticated user can access only rows whose `user_id` matches their account. Never add a database password, secret key, or service-role key to this repository.

## Suggested future upgrades

- Add a small backend/database if records need to sync across devices.
- Add authentication before storing sensitive call information remotely.
- Add tags, attachments, reminders, and weekly/monthly trend charts.
