# Freedom 250 Picks

A mobile-friendly group prediction pool for the seven-fight UFC Freedom 250 card.

## Included features

- One continuous seven-fight main card
- Five mandatory predictions per fight:
  1. Winner/result
  2. Method
  3. Ending round or decision
  4. Fighter with more official takedowns landed
  5. Fighter with more official significant strikes landed
- One point for each correct answer; no negative points
- Organizer-controlled fight start, which locks and reveals that fight's picks
- Organizer result entry and automatic leaderboard
- Draw, no contest, disqualification, technical decision and technical draw support
- Fight cancellation and unavailable-stat handling
- CSV export
- Automatic local preview mode before Supabase is connected

---

# Part 1 — Preview the app before publishing

1. Unzip the downloaded package.
2. Open `index.html` in a browser.
3. Enter a display name and use `FREEDOM250`.
4. The yellow banner confirms that you are in **Preview mode**.
5. Open `admin.html` to test starting fights, entering results and exporting data.

Preview data is stored only on that device. Shared data begins after Parts 2–5 are completed.

---

# Part 2 — Create the Supabase database

## A. Create the project

1. Go to **supabase.com**.
2. Select **Start your project** and sign in.
3. Select **New project**.
4. Choose an organization or create one.
5. Enter:
   - **Name:** `freedom250-picks`
   - **Database password:** create a strong password and save it
   - **Region:** choose the closest available region
6. Select **Create new project**.

## B. Run the database setup

1. In the Supabase left menu, select **SQL Editor**.
2. Select **New query**.
3. Open the included file `supabase-setup.sql` on your computer.
4. Select all of its contents and copy them.
5. Paste the complete script into the Supabase SQL Editor.
6. Select **Run**.
7. A successful run should show **Success. No rows returned** or a similar success message.

## C. Enable anonymous participant sign-in

1. In the Supabase left menu, select **Authentication**.
2. Open **Providers**.
3. Find **Anonymous Sign-Ins** or **Anonymous**.
4. Turn it **On**.
5. Save the change.

Anonymous sign-in creates a private browser identity for each participant without requiring an email address or password.

---

# Part 3 — Copy the two Supabase browser settings

1. In Supabase, select the **gear icon / Project Settings**.
2. Open **Data API** or **API**.
3. Copy the **Project URL**.
4. Copy the **Publishable key**.
   - If the project shows legacy keys, use the **anon/public** key.
   - Never use a secret key or `service_role` key in this app.

Keep this browser tab open. You will paste these two values into GitHub.

---

# Part 4 — Upload the app to GitHub

## A. Create an account

1. Go to **github.com**.
2. Select **Sign up**.
3. Complete account creation and email verification.

## B. Create a repository

1. At the upper-right of GitHub, select the **+** icon.
2. Select **New repository**.
3. Enter:
   - **Repository name:** `freedom250-picks`
   - **Visibility:** Public
4. Do not add a README, `.gitignore`, or license.
5. Select **Create repository**.

## C. Upload the app files

1. On the empty repository page, select **uploading an existing file**.
2. Open the unzipped `freedom250-picks` folder on your computer.
3. Select all files inside the folder and drag them into the GitHub upload area.
   - Upload the files themselves, not the outer folder.
   - `index.html` must appear at the top level of the repository.
4. In the **Commit changes** box, enter `Initial app upload`.
5. Select **Commit changes**.

---

# Part 5 — Add your Supabase URL and publishable key

1. In the GitHub repository file list, select `config.js`.
2. Select the pencil icon labeled **Edit this file**.
3. Replace:

   `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE`

   with the Project URL copied from Supabase.

4. Replace:

   `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE`

   with the Supabase Publishable key or legacy anon/public key.

5. Do not alter the quotation marks.
6. Select **Commit changes**.
7. Keep **Commit directly to the main branch** selected.
8. Select **Commit changes** again.

The Supabase publishable/anon key is designed for browser apps. The included SQL script enables Row Level Security so the key does not grant unrestricted database access. Never paste a Supabase secret or service-role key into GitHub.

---

# Part 6 — Publish with GitHub Pages

1. In your GitHub repository, select **Settings**.
2. In the left menu, select **Pages** under **Code and automation**.
3. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Select **Save**.
5. GitHub will display the public site address after deployment. It will generally be:

   `https://YOUR-GITHUB-USERNAME.github.io/freedom250-picks/`

6. Open that address and verify that the yellow Preview mode banner is gone.

---

# Part 7 — Allow organizer email sign-in

The organizer page uses a secure email sign-in link.

1. Copy your final GitHub Pages address.
2. In Supabase, open **Authentication**.
3. Open **URL Configuration**.
4. Set **Site URL** to your GitHub Pages address.
5. Under **Redirect URLs**, add:
   - Your GitHub Pages address
   - The same address followed by `admin.html`

Example:

`https://YOUR-GITHUB-USERNAME.github.io/freedom250-picks/`

`https://YOUR-GITHUB-USERNAME.github.io/freedom250-picks/admin.html`

6. Save the changes.
7. Open the app and select **Open Admin**.
8. Select **Email me a sign-in link**.
9. Open the email sent to `niugrads1999@gmail.com`.
10. Select the sign-in link.

Check Spam/Junk if the message does not appear within a few minutes.

---

# Using the pool

## Participant workflow

1. Open the shared GitHub Pages link.
2. Enter a unique display name.
3. Enter `FREEDOM250`.
4. Make all five selections for a fight.
5. Select **Save this fight**.
6. Repeat for all seven fights.
7. Participants can change saved selections while a fight remains **Open**.
8. When the organizer starts a fight, that fight locks and everyone’s picks for it become visible.

## Organizer workflow

1. Open **Admin** and sign in using the email link.
2. Immediately before a fight begins, select **Start fight & reveal picks**.
3. After the fight:
   - Enter the official result
   - Enter the official method
   - Enter the ending
   - Enter who had more official takedowns landed
   - Enter who had more official significant strikes landed
4. Select **Save result & complete**.
5. The leaderboard updates automatically.

Use **Void / unavailable** when UFCStats does not publish an official value. That category awards no point to anyone for that fight.

## Rare outcomes

For participant method selections, choose **Other / rare** and then select:

- Disqualification
- Technical decision
- Technical draw
- No contest

A draw or no contest can also be selected in the separate winner/result category.

---

# Important operational rules

- All five categories must be completed before a fight can be saved.
- Correct answer: 1 point.
- Incorrect answer: 0 points.
- No negative points.
- A canceled fight awards no points.
- Takedowns means official takedowns **landed**.
- Strikes means official **significant strikes landed**.
- “Goes to decision” is the ending choice when a scheduled fight reaches the final horn.
- A fight started accidentally can be reopened, but reopening allows participants to change their selections again.
- Participant identity is tied to that browser. A participant using a different browser or device will create a separate entry and should use a different display name unless the organizer removes the old entry directly in Supabase.

---

# Troubleshooting

## The site shows Preview mode

Open `config.js` on GitHub and confirm that both placeholder values were replaced exactly, including no extra spaces outside the quotation marks.

## Participants receive “Anonymous sign-in failed”

In Supabase, open **Authentication → Providers** and enable **Anonymous Sign-Ins**.

## Organizer sign-in returns to the wrong page

Add the exact GitHub Pages site and `admin.html` address under **Authentication → URL Configuration → Redirect URLs**.

## GitHub Pages shows a 404 error

Confirm:

- The file is named exactly `index.html`.
- `index.html` is at the top level of the repository.
- Pages is configured for `main` and `/ (root)`.
- The deployment has finished under the repository’s **Actions** tab.

## A display name is unavailable

Display names must be unique. Use a different name or remove the old participant record in Supabase.

## A participant changed devices

The app intentionally uses an anonymous browser identity. The organizer can treat the new device as a new entry, or remove the old participant and picks in Supabase.

---

# Files

- `index.html` — participant interface
- `admin.html` — organizer interface
- `styles.css` — design and responsive layout
- `app.js` — participant behavior, scoring and leaderboard
- `admin.js` — organizer behavior and CSV export
- `config.js` — Supabase connection settings
- `data.js` — local preview fight card
- `supabase-setup.sql` — database, security policies and initial fight card
