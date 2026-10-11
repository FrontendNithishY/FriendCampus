# FriendCampus

Capacitor app with a Supabase backend: login, admin-posted notices, reminders, polls, help requests and live notifications.

## 1. Set up Supabase (5 minutes, free)
1. Go to supabase.com → **New project**.
2. **Authentication → Providers → Email**: turn **OFF "Confirm email"** (users sign up with a username, not a real email).
3. **SQL Editor** → paste all of `supabase.sql` → **Run**. This creates the tables, security rules, live updates and the admin account.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `www/config.js`.

Admin login: username `Admin`, password `nathaadmin` (change it in the app: menu → Change Password).

## 2. Get the APK (no installs needed)
1. Create a GitHub repo and upload this whole folder (keep `.github`).
2. **Actions** → **Build FriendCampus APK** → Run workflow → wait ~4 min.
3. Download `FriendCampus-apk` → unzip → install `app-debug.apk`.

Build locally instead: `npm install && npx cap add android && npm run build:apk`.

## Features
- **Login / Sign up** (username + password). Only the username `admin` gets admin rights.
- **Feed**: admin posts/deletes notices; everyone sees them live and gets a notification.
- **Reminders**: personal reminders for everyone; admin can send a reminder to all users.
- **Help Center**: users send requests; admin replies and resolves; the user is notified.
- **Community**: member list and polls (admin creates, everyone votes once).
- **Notifications**: bell with unread count, mark all as read.
