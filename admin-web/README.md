# TOPCIT Tutor — Admin Portal

A web administrator portal for the TOPCIT Tutor Unity app. It reads and writes the **same
Firestore database** the game uses (project `topcittutor`), so anything you change here is
live for students immediately.

No build step, no framework, no `npm install` — plain HTML/CSS/ES modules plus the Firebase
Web SDK from the CDN.

---

## 1. Set up your first administrator (5 minutes, do this once)

The portal only lets an account in if there is a document for it in the `Admins` collection.
The first one has to be created by hand, because the security rules stop anyone else from
creating it.

1. **Firebase console → Authentication → Users → Add user.**
   Enter the admin's email and a password. (If Email/Password sign-in isn't enabled yet:
   Authentication → Sign-in method → Email/Password → Enable.)
2. **Copy that account's User UID** from the users table.
3. **Firebase console → Firestore Database → Start collection.**
   - Collection ID: `Admins`
   - Document ID: **paste the UID from step 2**
   - Fields: `name` (string, e.g. `Sam`), `email` (string), `role` (string, e.g. `Administrator`)

Every other admin can be added from inside the portal afterwards (Settings & Admins), as long
as their Authentication account already exists.

## 2. Deploy the security rules

The rules in `../firestore.rules` are what grant admins access and what make the
**Deactivate** button actually block a student. Without them the portal will show
"permission denied" everywhere.

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Run it from the repository root (where `firebase.json` lives). If the CLI isn't linked to the
project yet, run `firebase login` then `firebase use topcittutor` first.

**Read `firestore.rules` before deploying** — it replaces whatever rules the project has now.
It is written to keep the Unity client working: a signed-in student can still read and write
their own `Users/{uid}` tree, and any signed-in account can read the `Users` collection so a
leaderboard works in-game.

The indexes file adds collection-group indexes on `completed`, which the dashboard's
"lessons/quizzes completed" counters use. They are optional — without them those three tiles
say `n/a` and everything else still works.

## 3. Run it

> ### ⚠️ Do not double-click `index.html`
>
> Opening the file directly gives the page a `file://` address, and every browser blocks
> JavaScript **modules** on `file://` for security. The login screen still draws (that's just
> HTML and CSS), but `main.js` never runs — so the **Sign in button does nothing at all**.
> No error, no message, nothing.
>
> The portal must be served over `http://`. That's what the steps below do.

**Easiest: double-click `start-admin-portal.bat`** (in this folder). It starts a local server
and opens the portal at <http://localhost:8080>. Leave that black window open while you work;
closing it stops the server.

**Or from a terminal** — any static server works:

```bash
npx http-server admin-web -p 8080 -c-1
```

Then open <http://localhost:8080>. `localhost` is an authorised Firebase Auth domain by default.

**Or with the Firebase CLI**, from the repository root:

```bash
firebase serve --only hosting
```

**To publish it** (Firebase Hosting, free tier):

```bash
firebase deploy --only hosting
```

That serves the portal at `https://topcittutor.web.app`. After deploying, add that domain
under **Authentication → Settings → Authorised domains** if sign-in is rejected.

---

## What each page does

| Page | What it covers |
|---|---|
| **Dashboard** | Registered/active students, XP in circulation, streaks, sign-ups over 14 days, top students, newest students, recent admin activity |
| **Leaderboard** | Rankings by total XP / level / points / streak / current XP, CSV export, **season reset** (zero chosen fields for everyone), **recalculate levels** from total XP |
| **Reports & Analytics** | Participation and completion rates, quiz score distribution, hardest modules, per-quiz average score and time, top performers, CSV exports |
| **User Management** | Search/sort/filter students, create accounts, edit every profile field, deactivate/reactivate, delete all data, bulk-grant XP/points/hints, CSV export |
| **Student detail** | Per student: overview, full **progress tree** (subject → module → lesson/quiz) with editable completion, **quiz scores and times**, achievements, inventory, and a raw field editor for anything else |
| **Progress Monitoring** | Every student's lesson/quiz/module completion and average quiz score in one sortable table |
| **Curriculum** | Master subjects → modules → lesson & quiz IDs; push a subject to all students; import the structure from an existing student |
| **Achievements** | Master achievement/badge catalog with XP and point rewards; push to all students |
| **In-App Economy** | Item/collectible/hint catalog with costs; currency reward rates; bulk point grants |
| **Announcements** | Create, publish, unpublish and expire messages for students |
| **Database Explorer** | Browse and edit *any* document in the project, including raw JSON editing and recursive delete |
| **Settings & Admins** | XP curve and reward tuning, administrator accounts, full audit log |

## Collections

Read and written by the game (created by `NewUserDataInitializer.cs`):

```
Users/{uid}
  ├─ Achievements/{id}   Title, unlocked, unlockedAt
  ├─ Inventory/{id}      itemName, equipped, unlocked, unlockedAt
  └─ Subjects/{id}       title, completed, completedAt, completedModules, unlocked, unlockedAt
       └─ Modules/{id}   title, completed, completedAt, completedLessons, completedQuizzes, unlocked
            ├─ Lessons/{id}  completed, completedAt
            └─ Quizzes/{id}  completed, completedAt, score, elapsedTime
```

Added by this portal (the Unity client can read them, but doesn't have to):

| Collection | Purpose |
|---|---|
| `Admins/{uid}` | Who may sign in to the portal |
| `AchievementCatalog/{id}` | Master achievement/badge definitions |
| `ItemCatalog/{id}` | Master shop items, collectibles, hint packs |
| `SubjectCatalog/{id}` (+ `Modules`) | Master curriculum used to seed new students |
| `Announcements/{id}` | Messages for students |
| `Config/gamification` | XP curve and reward rates |
| `AdminLogs/{auto}` | Audit trail — every change made from the portal |

Three fields are added to `Users/{uid}` by the portal: `disabled`, `disabledReason` and
`adminNotes` (plus `email`, `updatedAt`, `updatedBy`). The game ignores them; the security
rules use `disabled`.

## Things worth knowing

- **Deactivating** a student sets `disabled: true` on their profile. The security rules then
  refuse their reads and writes, so the game cannot load or save their progress. Their
  Firebase Authentication login still exists.
- **Deleting** a student removes their profile and every nested document. It does **not**
  delete their Authentication login — do that in Firebase console → Authentication → hover the
  row → ⋮ → Delete account. (Removing Auth accounts from a web page requires the Admin SDK,
  which cannot run in a browser.)
- **Creating** a student from the portal makes a real Authentication account. It uses a
  throwaway secondary Firebase app instance, so you stay signed in as yourself.
- **Changing the XP curve** in Settings writes to `Config/gamification` — it does not change
  the constants compiled into `Assets/Scripts/Mechanics/LevelingRules.cs`. Keep the two in sync
  by hand, then use Leaderboard → *Recalculate levels* to re-derive everyone's level.
- **Progress Monitoring and Reports** walk every student's subcollections, so they load on
  demand rather than automatically. The result is cached until you press Refresh.
- **The API key in `js/firebase-config.js`** comes from `Assets/Data/Firebase/google-services.json`.
  It works as-is. For a cleaner setup, register a Web app in Firebase console → Project settings
  → Your apps → Web, and paste that config in instead. Firebase web API keys are not secrets —
  the security rules are what protect your data.

## Troubleshooting

**The Sign in button does nothing — no error, no spinner.**
You opened `index.html` directly from the file system. Check the address bar: if it starts with
`file:///` or says "File", that's the problem. Use `start-admin-portal.bat` instead and make
sure the address bar says `http://localhost:8080`.

**"Signed in, but the Admins collection could not be read."**
Your Firestore rules don't allow it yet. Deploy them (step 2 above):
`firebase deploy --only firestore:rules`

**"This account is not an administrator."**
The document ID under `Admins` must be the account's **Authentication UID**, character for
character — not their email, and not an auto-generated ID. The portal prints the UID it was
expecting to the browser console (press F12 → Console) so you can compare and fix the document.

**"Incorrect email or password."**
The sign-in itself failed, before any admin check. Confirm the account exists under
Firebase console → Authentication → Users.

**Everything says "permission denied" after signing in.**
The rules deployed, but your `Admins/{uid}` document is missing or under a different UID.
Re-check step 1.

## File layout

```
admin-web/
  start-admin-portal.bat  double-click this to run the portal
  index.html              app shell + login screen
  assets/topcit-logo.png  copy of Assets/Art/Icons/Custom Icons/TOPCIT LOGO.png
  css/styles.css          all styling (dark/light themes)
  js/
    firebase-config.js    project config — edit this if you register a web app
    firebase.js           loads the Firebase SDK, exports app/auth/db
    main.js               sign-in gate, admin check, hash router
    util.js               formatting, XP maths, toasts, modals, CSV
    store.js              every Firestore read/write, mirrored to the game's schema
    views/                one file per page
```
