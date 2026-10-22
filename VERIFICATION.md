# Verification

Checked on 22 October 2026 with the bundled Node.js 24.19.0 runtime.

## Automated checks

All eight Node test results pass. The suite includes date arithmetic and a complete HTTP lifecycle with six scenario groups. It runs against an in-memory SQLite database and checks server behavior rather than mocking permission decisions.

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
- At a 390 × 844 viewport override, the navigation and gallery reflowed to the mobile layout. Document width did not exceed viewport width. Restored the original viewport afterward.
- Final browser error log was empty after the restored visitor page loaded.

The browser test used explicitly artificial customer and address data. Generated QA records are removed from the local database before handoff. The source ZIP contains no runtime database. No video was recorded.

## Limits

The HTTP tests cover more invalid-input and ownership cases than the manual browser walkthrough. Not every browser, keyboard/screen-reader combination or device has been tested. This is a local server preview, not a deployment or a cloud-database connection. The image files are the assignment's samples, not independently verified art provenance.
