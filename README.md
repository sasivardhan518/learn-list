# Learnlist

Turn video playlists into courses: automatic progress tracking, completion checkmarks, timestamped notes, and everything synced to your own Google Drive (`playlist-notes-data.json` in My Drive).

Files: `index.html`, `style.css`, `app.js`, `config.js`

**Set your Client ID once in `config.js`** and the app never asks for it again, on any device. (It is not a secret.) Each person who signs in gets their own data in their own Google Drive.

## 1. Get a Google OAuth Client ID (one-time, free)

1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **OAuth consent screen / Google Auth Platform** → External → fill in app name + your email → under **Audience** add your Google account as a **Test user** (this avoids the "Access blocked" error).
4. **Credentials → Create credentials → OAuth client ID → Web application**
   - **Authorized JavaScript origins:** `http://localhost:8000` (plus your real URL if you host it).
5. Copy the Client ID. No client secret is needed.

> The app now also asks for your name/email/profile picture (basic profile scopes) so it can greet you and remember which account to reconnect. You'll see one new consent screen the first time.

## 2. Run it

```
python3 -m http.server 8000
```

Open http://localhost:8000 and sign in. (Google sign-in doesn't work from `file://`.) If `config.js` has no Client ID, the app asks for it once and remembers it in that browser only.

## How progress tracking works

| Source | Progress | How |
|---|---|---|
| YouTube (watch, youtu.be, shorts) | **Automatic** | YouTube IFrame Player API |
| Vimeo | **Automatic** | Vimeo Player SDK |
| Direct `.mp4/.webm/.ogg/.mov` links | **Automatic** | HTML5 `<video>` events |
| Loom, Dailymotion, Google Drive, other pages | **Manual** | These players don't expose playback — use the slider or **Mark complete** in the Progress tab |

- A lesson auto-completes at 90% watched (`AUTO_COMPLETE_PCT` at the top of `app.js`) or when it ends.
- Your position is saved, so lessons resume where you stopped.
- Every lesson also has a manual **Mark complete** button and a checkbox in the course list.
- Notes capture the current video time; click a note's timestamp to jump back to it (auto-tracked players only; for others you can type a time like `12:30`).

## Staying signed in

Google gives browser-only apps access tokens that last 1 hour and no refresh token, so the app works around it:

- Your courses are cached on the device, so the app opens instantly, even offline.
- On every open it reconnects to Google **silently** in the background.
- If the browser blocks that silent step, a banner appears with one **Reconnect** button. Your changes are safe on the device and sync as soon as you reconnect.
- Allowing pop-ups for the site makes the silent step work more reliably.
- Truly never-expiring login needs a small server to hold a refresh token. This can be added later (e.g. a Cloudflare Worker).

## Notes

- The app only requests the `drive.file` scope: it can see only the file it created, never the rest of your Drive.
- Conflicts are resolved by "newest change wins" for the whole file, so avoid editing from two devices at the very same time.
- Existing data from the first version of the app is migrated automatically (old per-video notes become "Key takeaways").
- To publish, host the three files on any static host and add its URL to the Authorized JavaScript origins.
