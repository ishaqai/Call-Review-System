# Call Review System

A personal workspace for logging calls, tracking lead outcomes, preparing follow-ups, and learning from past conversations.

## Call records

Records can include lead and company details, candidate, call type and stage, purpose, outcome, rating, conclusion, feedback, tags, and follow-up date. Records support search and filters by date, stage, source, and outcome. Export/import JSON for backups, or export CSV for analysis.

The dashboard includes a six-month activity chart, outcome summary, comparisons by call type, interview stage, and lead source, and a follow-up reminder list with overdue items and a mark-done action. Export open follow-ups as an `.ics` calendar file for Google Calendar, Outlook, or another calendar app. Open any record to view its full details, preparation checklist, and chronological timeline of related calls.

The lead pipeline groups calls by lead and tracks each lead through New, Contacted, Interviewing, Offer, and Closed. Change a lead’s status on the board or in its call form. Duplicate review flags leads with the same person and company; merging groups their histories while preserving the individual calls and original Lead IDs. AI progress summarizes strengths and improvement themes from coaching reviews saved to records.

Quick Actions in the header (or **Ctrl/⌘+K**) opens a command palette for navigating sections, starting a new call or weekly recap, and finding a saved call by person or company. Press `/` outside a text field to focus call search.

Use the header theme toggle to switch between light and dark appearance. The selection is saved in the current browser.

Call templates for HR interviews, technical interviews, client calls, and follow-ups fill in starter call details and checklist items. Checklist items can be edited before saving and checked off from the call detail view.

## AI workspace

The AI workspace provides:

- Call coaching, focused feedback, and coaching history saved with the related record.
- Pre-call briefs that include earlier calls for the same lead.
- Practice scenarios with feedback on a response you type.
- Rough-note cleanup that creates a draft for review before applying it to the call form.
- Weekly recaps of saved calls from the current week.

AI requests require sign-in and use the Supabase Edge Function at `supabase/functions/call-coach/index.ts`, which calls Anthropic's Claude Haiku 4.5 API. Before submitting a request, the app explains what information may be sent to Anthropic. For saved call analysis, you can omit contact, owner, recruiter, and lead ID fields. Review AI output before using it.

## Local use and cloud sync

Open `index.html` in a browser for local use. Local records are stored in that browser. Sign in to sync records to Supabase and access them across devices. Local data is not automatically shared across browsers unless you sign in and sync it.

Use **Export JSON** regularly to create a backup. Restore it with **Import JSON**.

### Supabase setup

1. Run `supabase-setup.sql` in the Supabase SQL Editor.
2. Enable email/password sign-in. Set the site URL to `https://ishaqai.github.io/Call-Review-System/` and add it to allowed redirect URLs.
3. Configure the project URL and publishable key in `supabase-config.js`. Only a publishable key belongs in browser code.
4. Publish the static site, then sign in to sync records.

The `call_records` table uses row-level security so authenticated users can access only their own rows. Never add a database password, secret key, or service-role key to this repository.

### Deploying AI changes

Keep `ANTHROPIC_API_KEY` in Supabase Edge Function secrets. The Edge Function uses model ID `claude-haiku-4-5-20251001`. Put the key in the ignored `.env` file using the name `ANTHROPIC_API_KEY`; the file is not automatically available to a deployed function. From this directory, after installing and authenticating the Supabase CLI, deploy with:

```sh
supabase secrets set --env-file .env --project-ref zvcumwgsrgxnzmlclpem
supabase functions deploy call-coach --project-ref zvcumwgsrgxnzmlclpem
```

After changing the front end, publish the repository to update the GitHub Pages site. Never commit or paste `.env` contents. If an API key has been exposed, revoke it and create a replacement.
