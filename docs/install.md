# Install Fairspace

This guide takes you from no accounts to a live site, with you signed in as the first admin. You do not need to write code. Each step names the button or field to use.

Checked on 2026-11-26. The menus of other companies change. If a button has a different name, use the linked official page for that step.

## 1. Before you start

You get one Fairspace site on the internet, with a free `.vercel.app` address. Later you can add your own domain name.

The install takes about 1 hour. Email verification can make you wait longer (see step 4).

You need these accounts. All of them have a free plan:

- [GitHub](https://github.com/signup): keeps a copy of the Fairspace code.
- [Vercel](https://vercel.com/signup): runs the site. Sign up with your GitHub account.
- [Cloudflare](https://dash.cloudflare.com/sign-up): keeps the images and PDFs that you upload (R2 storage).
- [Resend](https://resend.com/signup): sends the sign-in emails.

You also need a domain name that you control, for example `example.org`. You must be able to add DNS records to it. Resend sends email only from a domain that you verify, so you cannot skip this. The site itself can use the `.vercel.app` address until you are ready to move it to your domain.

Use an email inbox that your organization controls for these accounts, for example `web@example.org`. Do not use the private email of one volunteer.

### Values to copy

You collect 9 values during the install. Make a text file for them, in a place that only you can open (a password manager is best). Do not put the file in GitHub, in email, or in chat.

- [ ] `AUTH_SECRET` (step 2)
- [ ] `S3_BUCKET` (step 3)
- [ ] `S3_ACCESS_KEY_ID` (step 3)
- [ ] `S3_SECRET_ACCESS_KEY` (step 3)
- [ ] `S3_ENDPOINT` (step 3)
- [ ] `S3_REGION`: this is always `auto` for R2
- [ ] `EMAIL_SERVER` (step 4)
- [ ] `EMAIL_FROM` (step 4)
- [ ] `ADMIN_EMAIL` (step 5)

## 2. Make a sign-in secret (`AUTH_SECRET`)

The site uses this secret to sign the sign-in sessions. It must be long and random.

- **Best:** use the password generator in your password manager. Make a password of 40 or more characters, with letters and digits only. Copy it into your file as `AUTH_SECRET`.
- **On a Mac:** open the **Terminal** app, type `openssl rand -base64 32`, and press Return. Copy the line it shows.

Do not use a website that makes secrets for you. The secret must not come from another company.

## 3. Media storage: Cloudflare R2

Fairspace keeps uploaded images and PDFs in a storage "bucket". These steps use Cloudflare R2. Official guide: [R2 get started](https://developers.cloudflare.com/r2/get-started/).

Other providers (Backblaze B2, AWS S3) also work. See [Media storage](../README.md#media-storage) in the README.

### Turn on R2

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/).
2. Open **R2 object storage** > **Overview**.
3. If Cloudflare asks you to add R2 to your account, complete the checkout. R2 has a free monthly amount, but Cloudflare may ask for a payment method before your first bucket.

### Make the bucket

1. On the **R2 object storage** > **Overview** page, click **Create bucket**.
2. Type a name, for example `fairspace-media`. Copy the name into your file as `S3_BUCKET`.
3. Keep the default location. Do **not** choose a jurisdiction (EU or FedRAMP): a jurisdiction gives the bucket a different address.
4. Click **Create bucket**.

Use this bucket for Fairspace only. Fairspace deletes old files in the `uploads/` folder, so do not share the bucket with another app. Keep the bucket private: do not turn on public access.

### Make the access key

Official guide: [R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/).

1. Go to **R2 object storage** > **Overview**.
2. Under **Account Details**, find **API Tokens** and click **Manage**.
3. Click **Create Account API token**. Use an account token, not a user token: an account token stays valid when a volunteer leaves your Cloudflare account.
4. Give the token a name, for example `fairspace`.
5. Under **Permissions**, choose **Object Read & Write**.
6. Limit the token to the bucket that you made. Do not give it all buckets.
7. Click **Create Account API token**.
8. Copy the **Access Key ID** into your file as `S3_ACCESS_KEY_ID`.
9. Copy the **Secret Access Key** into your file as `S3_SECRET_ACCESS_KEY`. Do it now: Cloudflare shows the secret only one time.

### Write down the endpoint

1. On the **R2 object storage** > **Overview** page, find your **Account ID** under **Account Details**.
2. Write this in your file as `S3_ENDPOINT`, with your Account ID in the middle:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

Do not add the bucket name at the end. Fairspace adds it.

You add the CORS rule (the rule that lets the browser upload) in step 6, after the site has an address.

## 4. Email: Resend

Fairspace has no passwords. People sign in with a link in an email. Resend sends these emails. Official guide: [Resend domains](https://resend.com/docs/dashboard/domains/introduction).

### Verify your domain

1. Sign in to [Resend](https://resend.com/) and open **Domains**.
2. Add a domain. Use a subdomain, for example `mail.example.org`. Resend recommends a subdomain for sending.
3. Resend shows a list of DNS records. Sign in to the company that hosts the DNS for your domain. Add each record exactly as Resend shows it.
4. If your DNS host is Cloudflare, set **Proxy status** to **DNS only** on each record. See [Resend and Cloudflare](https://resend.com/docs/knowledge-base/cloudflare).
5. Back in Resend, click **Verify DNS Records**. Verification is often done in a few minutes. It can take up to 72 hours.

### Make the API key

1. In Resend, open **API Keys** and create a key. Give it permission to send email.
2. Copy the key. It starts with `re_`.
3. Write this in your file as `EMAIL_SERVER`, with your key in place of `<API_KEY>`:
   `smtps://resend:<API_KEY>@smtp.resend.com:465`

   It must start with `smtps://` (with an "s"). Port 465 uses an encrypted connection from the start.
4. Write the sender in your file as `EMAIL_FROM`. Use your site name and an address on the verified domain:
   `Our Charity <noreply@mail.example.org>`

The `EMAIL_FROM` address must use the domain that you verified. If it does not, Resend sends no email.

## 5. Deploy to Vercel

1. Open the [Fairspace README](../README.md#deploy-to-vercel) and click **Deploy with Vercel**.
2. Sign in to Vercel with GitHub if it asks.
3. **Create Git Repository:** choose your GitHub account (or your organization's), and keep the name `fairspace` or type a new one. Vercel copies the Fairspace code into a new repository there.
4. **Neon (the database):** Vercel asks you to add a Neon Postgres database. Choose the **Free** plan. If Vercel asks for a region, choose a US East region (for example Washington, D.C.): Vercel runs the site there by default, and a near database makes the site faster. Neon sets `DATABASE_URL` for you.
5. **Environment variables:** Vercel shows one field for each value. Paste each value from your file:

   | Field | Value |
   | --- | --- |
   | `AUTH_SECRET` | from step 2 |
   | `EMAIL_SERVER` | from step 4 |
   | `EMAIL_FROM` | from step 4 |
   | `ADMIN_EMAIL` | the email of the first admin (see below) |
   | `S3_REGION` | `auto` (already filled in) |
   | `S3_BUCKET` | from step 3 |
   | `S3_ACCESS_KEY_ID` | from step 3 |
   | `S3_SECRET_ACCESS_KEY` | from step 3 |

6. Click **Deploy**. The first build takes a few minutes.

**About `ADMIN_EMAIL`.** The first person who signs in with this email becomes the admin. Use an inbox that your organization controls, for example `web@example.org`. Do not use the private email of one volunteer. Keep this value set after the install. While an admin exists, it does nothing. But if all admins are removed, the next sign-in with this email makes an admin again. It is your way back in after a lockout.

## 6. After the first deploy

When the build is done, Vercel shows your site address, for example `https://fairspace-abc.vercel.app`. Copy it.

### a. Add the storage endpoint

1. In Vercel, open your project, then **Settings** > **Environment Variables**.
2. Add a variable with the name `S3_ENDPOINT` and the value from your file.
3. Click **Save**.

The site builds without `S3_ENDPOINT`, but uploads fail without it.

### b. Let the browser upload to R2 (CORS)

Official guide: [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

1. In Cloudflare, open **R2 object storage** > **Overview** and click your bucket.
2. Open the **Settings** tab.
3. Under **CORS Policy**, click **Add CORS policy**.
4. Open the **JSON** tab and paste this. Put your site address in place of the example address. Use no `/` at the end.

   ```json
   [
     {
       "AllowedOrigins": ["https://fairspace-abc.vercel.app"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"]
     }
   ]
   ```

5. Click **Save**.

### c. Redeploy

Vercel uses new variables only after a new deploy.

1. In Vercel, open **Deployments**.
2. On the newest deployment, click the **…** menu, then **Redeploy**.

### d. Optional: an extra cleanup rule

Fairspace deletes unfinished uploads itself. As a second safety net, you can add an R2 lifecycle rule that deletes objects with the prefix `uploads/` after 1 day. In your bucket, open **Settings** > **Object Lifecycle Rules** > **Add rule**. See [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

## 7. First sign-in

1. Open `https://<your site>/sign-in`.
2. Type the `ADMIN_EMAIL` address and submit.
3. Open the email from your site and click the link. You land on `/admin`.

Next steps:

1. **Settings** (`/admin/settings`): the site name, the logo, and the colors.
2. **Pages** (`/admin/pages`): make a page with the address (slug) `home` and publish it. It becomes your front page. Until then, the front page shows welcome text.
3. **Users** (`/admin/users`): invite your editors. Each invite sends a sign-in link.

## 8. Your own domain name

Official guide: [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

1. In Vercel, open your project, then **Settings** > **Domains**.
2. Click **Add Existing** and type your domain, for example `example.org`.
3. Vercel shows the DNS records to add. For the main domain (`example.org`) it is an **A** record. For `www` or another subdomain it is a **CNAME** record. Copy the values that Vercel shows into your DNS host.
4. Wait until Vercel shows the domain as ready.
5. In **Settings** > **Environment Variables**, add `AUTH_URL` with your new address, for example `https://example.org`.
6. In Cloudflare, add your new address to the CORS rule of your bucket (step 6b). Keep the old address in the list too:
   `"AllowedOrigins": ["https://example.org", "https://fairspace-abc.vercel.app"]`
7. Redeploy (step 6c).

Why `AUTH_URL`: the sign-in links, the sitemap, and the share links use it. Pages are made when the site builds, so the address is fixed at build time. Without the redeploy, emails and share links can keep the old address.

## 9. Settings you can change later

Change these in Vercel, at **Settings** > **Environment Variables**. Each change needs a redeploy (step 6c).

| Variable | What it does | Where the value comes from |
| --- | --- | --- |
| `DATABASE_URL` | The database address. | Neon sets it. Change it only to move to another database. |
| `AUTH_SECRET` | Signs sign-in sessions. A new value signs out all users. | Step 2. |
| `AUTH_URL` | The public site address, for links in emails and shares. Optional on Vercel until you add a domain. | Step 8. |
| `EMAIL_SERVER` | How the site sends email. | Step 4. |
| `EMAIL_FROM` | The sender name and address of the emails. | Step 4. |
| `ADMIN_EMAIL` | The way back in after a lockout. | Step 5. |
| `S3_ENDPOINT` | The address of the storage. | Step 3. |
| `S3_REGION` | The storage region. `auto` for R2. | Step 3. |
| `S3_BUCKET` | The bucket name. | Step 3. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | The storage key. | Step 3. |
| `S3_FORCE_PATH_STYLE` | Not needed for R2. `true` for Backblaze B2. | [Media storage](../README.md#media-storage). |

Analytics (Plausible or Google Analytics) is not a variable. Admins set it at `/admin/settings`. See [Site settings](../README.md#site-settings).

## 10. Updates

The **Deploy with Vercel** button makes a copy of Fairspace, not a GitHub fork. Your copy does not get new Fairspace versions by itself, and GitHub shows no **Sync fork** button for it. The copy may also start with a new history, without the Fairspace history.

So for now, an update needs a technical helper. An easier way to update is planned: see [issue #64](https://github.com/grcodemonkey/fairspace/issues/64).

Before each update, make a database snapshot (step 11).

**For a technical helper.** In a clone of the organization's repository:

```sh
git remote add upstream https://github.com/grcodemonkey/fairspace.git
git fetch upstream
# --allow-unrelated-histories: the Vercel copy may not share history with upstream
git merge upstream/main --allow-unrelated-histories
# resolve any conflicts, then:
git push origin main
```

Vercel builds the push and runs the database migrations before the new version goes live. Read the release notes and the README for new required variables first: a build with a missing variable fails and lists the missing names.

## 11. Backups

**Database.** Neon keeps a short restore history. On the Free plan you can go back up to 6 hours. In the [Neon console](https://console.neon.tech/), open your project, then **Backup & restore**. The Free plan also allows 1 manual snapshot: on the same page, click **Create snapshot**. Make a new snapshot before each update. Automatic snapshot schedules need a paid Neon plan. See [Neon backup and restore](https://neon.com/docs/guides/backup-restore).

**Media files.** Images and PDFs are in R2, not in the database. The database backup does not include them.

## 12. Costs

Checked on 2026-11-26. Prices change; read each linked page.

- **Vercel Hobby:** free. Vercel's [Terms of Service](https://vercel.com/legal/terms) say: "You shall only use the Services under a Hobby plan for your personal or non-commercial use." Read Vercel's [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) and choose for your organization: Hobby, or [Pro](https://vercel.com/docs/plans/pro-plan) ($20 a month for each developer seat). Fairspace gives no legal advice on this.
- **Neon Free:** 1 GB of storage and 100 CU-hours of compute a month for each project. If you use all the compute, the database stops until the next month. Your data stays. See [Neon plans](https://neon.com/docs/introduction/plans).
- **Cloudflare R2:** 10 GB-month of storage, 1 million Class A and 10 million Class B operations a month, and free downloads. See [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- **Resend Free:** 3,000 emails a month, 100 a day, and 3 domains. See [Resend pricing](https://resend.com/pricing).
- **Domain name:** you pay your domain company for it.

## 13. Security

- Keep `AUTH_SECRET`, the R2 keys, and the Resend key secret. Never put them in GitHub, in email, or in chat.
- If a key leaks, make a new one, put it in Vercel, and redeploy. Then delete the old key. A new `AUTH_SECRET` signs out all users.
- Use one bucket and one storage key for this site only.
- Keep `ADMIN_EMAIL` on an inbox that your organization controls, not on the private email of one volunteer. It is the way back in after a lockout.
- Turn on 2-factor sign-in on GitHub, Vercel, Cloudflare, Resend, and Neon.

## 14. Troubleshooting

**The build fails with "Fairspace cannot deploy. Set these environment variables…"**
The message lists the missing names. Add them at **Settings** > **Environment Variables**, then redeploy (step 6c).

**The build fails and the list includes `DATABASE_URL`.**
The database is not connected. In Vercel, open your project, then **Storage**, and add Neon. Or paste a Postgres address as `DATABASE_URL`.

**No sign-in email arrives.**
- Check that the domain shows as verified in Resend.
- Check that `EMAIL_FROM` uses the verified domain.
- Check that `EMAIL_SERVER` starts with `smtps://` and has the right API key.
- Check the spam folder.
- An email that has no user account gets no email. This is on purpose: the site does not show which emails have accounts. The first admin must use `ADMIN_EMAIL`. Other people need an invite from an admin.

**Uploads fail in the media library.**
- The CORS rule must have the exact site address: `https://`, no `/` at the end, and no `*`.
- `S3_ENDPOINT` must be set, and it must not have the bucket name at the end.
- After you change a variable, redeploy.

**Emails or share links show the old address after a domain change.**
Set `AUTH_URL` to the new address, then redeploy (step 8).

**The site shows database errors near the end of the month.**
The Neon Free plan may be out of compute for this month. Wait for the next month, or move to a paid Neon plan.

## 15. Self-hosting without Vercel (for technical helpers)

Fairspace can run on your own server:

- Node 24 and pnpm 10: `pnpm install`, `pnpm build`, then `pnpm start`.
- Postgres 17, an S3-compatible bucket, and an SMTP server.
- `AUTH_URL` is required at build time and at run time.
- Run `pnpm db:migrate` before you start each new version.
- There is no Docker image. `compose.yaml` is for local development only (Postgres, Mailpit, SeaweedFS), not for production.
- Not supported: a static export, or a site without Postgres or without a bucket.

See the [README](../README.md) for the full list of variables.
