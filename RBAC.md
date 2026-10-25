# How role-based access works

## Which email should I use?

- Customer: sign up with an email of your choice, then log in with that exact account. All self-service signups get the `customer` role. An email containing “admin” or “studio” does not change this.
- Studio/admin: the default seeded email is `studio@artstudio.in`, with the `studio` role. On an existing local installation, use its existing password. A fresh installation generates a password and prints it in the terminal once, unless `STUDIO_PASSWORD` is configured before the database is created. Source control contains no shared studio password.
- `STUDIO_EMAIL` can change the initial email for a fresh installation. It does not alter an existing account or turn an existing customer into an administrator.

Both roles use the same login form. There is no public studio signup or role selector.

## What the server checks

1. Login verifies the stored password hash and creates a session linked to a user ID.
2. Each business request uses its session cookie to find the user and their stored role.
3. `role(user, wantedRole)` checks whether that account may perform the requested action.
4. `owned(table, id, user)` also checks that a customer's user ID matches the record's owner.
5. Only after those checks does the server validate the business rules and change the database.

A missing or expired login gets 401. An authenticated account with the wrong role gets 403. A customer asking for another customer's record gets 404. A conflict such as a painting already sold gets 409.

The frontend hides unavailable actions, but backend checks remain authoritative even if someone changes their browser's page or manually sends a request. The browser cannot supply a trusted role or owner ID.

## What each account can do

Customers browse the painting catalogue, buy available paintings, book wall dates, request pottery and see only their own activity. They can cancel their own placed orders, cancel active wall bookings within the cutoff, and edit/cancel pottery while Requested.

The studio browses paintings, adds paintings, edits only available paintings, sees all customer activity, confirms/declines Requested wall bookings and accepts/declines Requested pottery requests. The studio cannot buy, create customer bookings/requests or cancel customer records.

## Try it yourself

1. Sign up as a customer. The Profile page shows **Customer account**. Place an order or request from its separate service page.
2. Log out. Log in as `studio@artstudio.in` with the local studio password. Profile shows **Studio / admin account**, all customer records and review buttons.
3. Open Paintings as the studio to see Add a painting and Edit for available paintings. Customer accounts do not have these controls.
4. For a privacy demonstration, create a second customer in another browser profile. Their Profile page will not show the first customer's activity.

Run `npm test` to verify server-side role checks, signup role-escalation rejection and owned-record privacy. The tests use a temporary in-memory database.
