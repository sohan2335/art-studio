# Verification

Final automated audit on 25 October 2026; earlier full browser walkthrough on 22 October 2026 with the bundled Node.js 24.19.0 runtime.

## Automated checks

All nine Node test results pass. The suite includes date arithmetic, a complete HTTP lifecycle with six scenario groups and request/persistence regressions. It runs against isolated in-memory and temporary-file SQLite databases and checks server behavior rather than mocking permission decisions.

Covered: anonymous access, customer signup, duplicate emails, studio role escalation rejection, login, wrong-role actions, cross-origin mutation rejection, owned-record 404, competing painting purchases, cancellation release, painting add/edit restrictions, wall size/date boundaries, one active booking per date, confirmation/decline/cancellation, inclusive three-day cancellation cutoff, pottery choices/quantity/date/edit/decision restrictions, private dashboard filtering, salted password storage and logout.

`node --check server.js` and `node --check public/app.js` pass.

## Browser walkthrough

- Visitor homepage displays the studio introduction, reference-inspired glass navigation, signup/login entry points and artwork imagery.
- Customer signup completed and displayed the full 12-painting catalogue.
- Search for Peacock returned the matching painting. Details displayed the supplied description and price.
- Placed a painting order and saw it in My activity, then cancelled it. Studio later saw its Cancelled status; the painting returned to Available.
- Created a 100 sq ft wall request at the inclusive minimum date. It displayed INR 15,000 using the INR 150 seed rate.
- Created a pottery request with Indigo Blue glaze and four pieces, then edited it to six pieces while Requested.
- Logged in with the supplied studio account. The dashboard showed the test customer's records. Confirmed the wall request and accepted the pottery request; both statuses updated.
- At a 390 Ã— 844 viewport override, the navigation and gallery reflowed to the mobile layout. Document width did not exceed viewport width. Restored the original viewport afterward.
- Final browser error log was empty after the restored visitor page loaded.

The browser test used explicitly artificial customer and address data. Generated QA records are removed from the local database before handoff. The source ZIP contains no runtime database. A separate silent walkthrough was subsequently recorded on the user’s command; narration is still pending.

## Limits

The HTTP tests cover more invalid-input and ownership cases than the manual browser walkthrough. Not every browser, keyboard/screen-reader combination or device has been tested. This is a local server preview, not a deployment or a cloud-database connection. The image files are the assignment's samples, not independently verified art provenance.


## Separate Profile page update

Browser verified `/profile.html` displaying the signed-in customer name, email, owned painting orders, wall bookings and pottery requests. Back to the studio returns to the homepage. The top-bar Profile link returns to the separate page. A DOM check confirmed the homepage contains no dashboard element. Existing records were viewed without modification. Role and ownership checks remain in the same server API.

## Separate service pages

An isolated in-memory preview verified customer signup on the wall-art page, a successful wall request, a pottery request from the pottery page and a painting order from the collection page. Each successful action opened Profile, which displayed all three resulting records and the Customer account label. A homepage DOM check found no booking form, pottery form or painting-purchase controls. Real local records were not modified by these checks. Browser error logs were empty. The regular preview also opened the dedicated wall-art page through the homepage navigation.

## Final audit — 25 October 2026

Fixed and checked:
- Dedicated wall/pottery pages now provide their own working Try again button after catalogue failure.
- Expired sessions clear private profile content and restore login controls instead of leaving the interface signed in.
- Passwords preserve leading/trailing spaces exactly.
- JSON requests decode Unicode correctly when a multibyte character crosses network chunks; the body size limit returns 413.
- Session cookies work with or without whitespace after separators.
- Malformed percent-encoded page paths return 400 instead of an internal server error; incorrect JSON content types return 415.

Fresh automated checks also cover data/session/order persistence after database reopening, no duplicate catalogue seeding, server-controlled purchase prices, all five page routes, all 12 seed image files, and additional wrong-role/ownership cases. Both JavaScript syntax checks and Git whitespace checks pass.

Fresh browser checks used an isolated in-memory preview: customer signup; simulated catalogue outage and successful retry; 100 sq ft wall booking at INR 15,000; redirect to separate Profile; forced session expiration with private activity removed and login restored; studio login and confirmation of that booking. The browser error log was empty. Real local customer records were untouched.
