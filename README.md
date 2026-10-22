# Atelier Art Studio

A complete local full-stack implementation of the GDGC art studio recruitment brief. Customers can buy one-of-a-kind paintings, book wall painting and request pottery. The studio manages the painting collection and reviews requests.

## Run on a clean machine

1. Install **Node.js 24 or newer** from the official Node.js website. Node 24 includes the SQLite driver used here.
2. Open a terminal inside this folder.
3. Run `npm start` (or `node server.js`). No dependency install, API keys or database account is required.
4. Open **http://127.0.0.1:8788**. Keep the terminal running. Press Ctrl+C to stop.

On this computer, `./run-app.ps1` also finds the bundled Node runtime if Node is absent from PATH. If PowerShell blocks scripts, run `node server.js` directly rather than changing your system policy.

The app creates `data/studio.sqlite` on first launch and imports the official catalogue exactly once. The assignment seed password is removed from public source; the studio account uses a generated or environment-provided password. Records survive restarts. The database is deliberately ignored by Git and excluded from the source ZIP, so a reviewer gets a fresh copy.

## Accounts

- Customer: use **Sign up** on the homepage. Minimum password length is 8 characters. Signup cannot create a studio account.
- Studio account: **studio@artstudio.in**. On a fresh database, the server generates a random password and prints it in the local terminal once. Save that password locally. The source contains no shared studio password.
- Both roles use the same Log in form. The server chooses the role from the stored account.

No `.env` file is needed. `.env.example` lists every optional application environment variable. To customise, create `.env` with just the settings you need. Set `STUDIO_EMAIL` and `STUDIO_PASSWORD` before the first database creation if you want to choose the initial studio credentials. They do not change an existing account. Use HTTPS and `COOKIE_SECURE=true` for any future non-local deployment. The project is local only; deployment is outside the brief.

## Features

- Public studio introduction, signup entry point and floating glass navigation inspired by the reference video.
- All 12 supplied paintings and images, full descriptions including the intentionally long title, availability badges, search and availability filter.
- Customers place and cancel orders. Database transactions and an active-order unique index prevent double purchasing. Cancelling releases the painting.
- Studio adds paintings and edits only available paintings, choosing an existing supplied image. Image uploads are outside the assignment.
- Wall dates from 7 through 90 days ahead, inclusive. Whole-number sizes from 10 through 500 sq ft. Address required. Price uses the official rate of INR 150 per sq ft, calculated and saved by the server.
- One active wall request/confirmation per date. Requested dates are reserved immediately. Decline or cancellation releases the date.
- Studio confirms or declines wall requests. Customers cancel requested/confirmed bookings at least 3 calendar days before the service date, inclusive.
- Pottery items and glazes come from the official seed. Whole-number quantity 1–12, needed-by date at least 14 days away. Customers edit or cancel only while Requested. Studio accepts or declines.
- The separate Profile page (`/profile.html`) shows account details and activity. Customer activity contains only owned records. Studio activity shows every customer's records. All required statuses appear.
- API returns 401 for missing/expired login, 403 for wrong role, 404 for another customer's record and 409 for conflicts or invalid status transitions.
- Loading, empty, retryable error states and clear conflict messages. Responsive layouts, keyboard-operable dialogs, labelled forms and reduced-motion support.
- Password hashing with random salts and scrypt. Random server sessions, hashed session tokens, HttpOnly SameSite cookies, prepared SQL, escaped UI text, same-origin mutation checks, basic authentication throttling and security headers.

## Use it

Create a customer account, open a painting and place an order. View it in **My activity**, then cancel to release it. Fill the wall booking and pottery forms. Log out and log in as the studio to review requests and edit/add paintings. Log back in as the customer to see updated statuses. To test privacy, use a second browser profile and a second customer account.

All dates use **Asia/Kolkata (IST)** and calendar-day rules. The app stores dates as `YYYY-MM-DD` and converts those dates to UTC only for day arithmetic. The rule is not a rolling count of 24-hour periods from the current clock time. Whole square feet is a documented UI choice; fractional sizes are not accepted.

## Check it

Run `npm test` or `node --test tests/*.test.js`.

The tests start a temporary in-memory database, bind a local test server and discard everything afterward. They cover role escalation, missing login, record ownership, simultaneous purchase/date attempts, cancellation release, studio painting edits, booking date/size boundaries, cancellation cutoff, pottery validation/edit/accept/decline/cancel and password hashing. The tests need loopback access.

## Files to understand

- `server.js`: HTTP server, SQLite schema, validation, password/session handling, permissions and routes.
- `public/index.html`: homepage structure and section anchors.
- `public/profile.html`: separate account profile and activity page.
- `public/styles.css`: colours, glass navigation, layouts and responsive rules.
- `public/app.js`: screen state, API requests, form events and rendering.
- `data/seed.json` and `public/images/`: assignment-provided catalogue and sample images.
- `tests/studio.test.js`: executable examples of business rules.
- `DESIGN.md`: answers to the assignment design questions.
- `SUBMISSION.md`: remaining submission steps. No demo recording has been made.

## Scope and limitations

No real payments, uploads, password reset, email verification, social login, studio signup, emails/SMS, reviews, coupons, tracking, Docker or CI/CD. These are excluded by the brief. No cloud services or paid plans are required. SQLite is a real durable database stored on the machine running the server. This is not a cloud-synced, publicly hosted service.

The Node server uses straightforward synchronous SQLite and password hashing for a small assignment. At larger traffic levels, move expensive password hashing off the main thread, add shared rate-limit storage, monitoring and a server database if needed. The basic in-memory throttle resets when the server restarts. Sessions expire after seven days. There is no background notification service or live push: use Refresh to see another account's changes. Form dates refresh on collection reload; a page left open across midnight can use Refresh to get the new limits, while server validation remains authoritative.

Seed records initially marked sold have no fabricated customer orders. The supplied images are retained as sample assets; their filenames, catalogue labels and art descriptions may not accurately correspond to the depicted works. No image provenance or ownership is inferred. Atelier is a demonstration identity, not a claim about a real business.

## Submission

The assignment asks for a public GitHub repository, README, `.env.example`, DESIGN.md and a narrated demo of at most 5 minutes, submitted through its Google form by **23 October 2026, 11:59 PM IST**. Source repository: https://github.com/sohan2335/art-studio . Uploading a demo and submitting the form have not been performed. The video will be recorded only on your command.




Profile update: open **Profile** in the top bar to view orders, wall bookings and pottery requests on a separate webpage. The homepage has no activity section. Old `/#dashboard` links redirect to `/profile.html`. New painting orders and requests open the Profile page after success.
