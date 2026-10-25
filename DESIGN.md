# Design decisions

## 1. How do login and the two roles work?

Customer signup stores a randomly salted scrypt password hash. Login verifies the hash and issues a random seven-day session in an HttpOnly, SameSite=Strict cookie; the database stores only a hash of the session token. The supplied studio account is seeded separately. Every business API loads the current user, then checks role and record ownership. Missing login returns 401, a wrong role returns 403, and another customer's record returns 404. Hiding a button is only an interface convenience, not the permission check.

## 2. Which database did you choose, and why?

SQLite, through Node 24's built-in driver. It is free, persists across restarts, supports transactions and unique indexes, and lets a reviewer run the whole project without creating a cloud account or managing a database password. The brief explicitly permits local databases. Prepared statements bind input values separately from SQL. One machine hosts this database; cloud sync is not implemented.

## 3. How do you stop two people from taking the same painting or date?

Purchases and booking creations run inside `BEGIN IMMEDIATE` transactions. SQLite serialises writers, so the availability check and reservation happen as one unit. A partial unique index independently allows only one placed order per painting and one requested/confirmed booking per date. An order cancellation changes both order and painting in the same transaction. Wall decline/cancellation leaves the date outside the active-date index. The server returns clear 409 conflict messages if another customer wins the resource.

## 4. What did you finish, leave out, and what would you do next?

All required application workflows are implemented: customer signup/login, roles, official painting catalogue, painting add/edit/buy/cancel, wall validation/pricing/unique dates/confirm/decline/cancel, pottery validation/edit/cancel/accept/decline, owned/all-record dashboards, statuses, and data loading/empty/error states. The interface adds a studio introduction, video-inspired floating navigation, responsive styling, search and availability filtering. The long seed title has full-detail display and wrapping.

The brief's excluded features remain excluded. There is no deployment or narrated submission demo yet. A silent live-browser walkthrough has been prepared separately. The source repository is https://github.com/sohan2335/art-studio . The walkthrough was recorded on the user's command; the user still needs to add their own voice. Next steps are user feedback, interview practice, reviewing the public source repository, and recording/submitting the demo. Before any public production deployment, replace the supplied demo account, use HTTPS, review image rights and add operational safeguards for the intended traffic.

## Explicit interpretations

- All date rules use calendar dates in IST. Date ranges include their endpoints.
- Wall size uses whole square feet; the brief does not specify fractional precision.
- A requested booking reserves its date before confirmation. Declined/cancelled dates can be requested again.
- A customer can cancel a placed painting order with no extra deadline because the brief states none.
- Confirmed wall bookings cannot transition to Declined; studio decisions apply to Requested bookings.
- Pottery changes apply only to Requested requests and revalidate the 14-day minimum.
- Catalogue reads require authentication. The public homepage shows a fixed promotional sample, not live inventory or another customer's data.
- No pottery price is invented because the supplied dataset gives no pottery pricing rule.
- Images are the assignment's sample files, with no claims that their contents match the catalogue titles.

## Test evidence

`node --test tests/studio.test.js` passes eight tests, including six scenario groups under the complete-lifecycle test. Assertions cover authentication, authorization, ownership, active-resource uniqueness, boundaries, status transitions, cancellation release and salted password storage. Browser checks are documented separately in `VERIFICATION.md`.

