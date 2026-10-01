# Forge 75

Private 75 Hard tracker. Works as an installable app (PWA), fully offline.

## Use it right away (no account)
Host this folder on any HTTPS static host (Netlify Drop, GitHub Pages, Cloudflare Pages) and open the link. Progress is saved on that device. Use **Backup / Restore** to move it between devices.

## Optional: sync across phone and laptop (free)
1. Create a project at supabase.com.
2. SQL Editor: paste and run `supabase.sql`.
3. Project Settings > API: copy the Project URL and the publishable (anon) key into `config.js`.
4. Authentication > URL Configuration: set Site URL (and add it to Redirect URLs) to your hosted address.
5. Re-upload. You'll now get an email sign-in screen.

## Installing
- Android/Chrome: "Install app" button (or menu > Install).
- iPhone: Safari > Share > Add to Home Screen.

When you change any file, bump `CACHE_NAME` in `service-worker.js`.
