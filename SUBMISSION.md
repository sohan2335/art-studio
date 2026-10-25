# Submission preparation

Prepared: source code, official seed data/images, README, DESIGN.md, `.env.example`, `.gitignore`, automated tests.

Remaining steps:

1. Review and understand the project using the separate learning guide.
2. Review the public source repository at https://github.com/sohan2335/art-studio before submission. Do not add `.env`, runtime SQLite databases, personal passwords or logs.
3. Add your own narration to the prepared silent walkthrough and export a demo of **at most five minutes** showing signup/login, painting purchase, wall booking, pottery request and studio decisions. Explain the code behind one feature.
4. Upload the recording to Drive and make its link viewable, as the assignment requires.
5. Submit the repository link, demo link and other required fields using the assignment's Google form. The stated deadline was **23 October 2026, 11:59 PM IST**; it has passed as of this final check. Check whether late submission is accepted.

A silent walkthrough has been recorded. Add your own voice and review the final export before submission. The source repository is https://github.com/sohan2335/art-studio . No submission has been sent.

Suggested feature to explain: preventing two painting purchases with a database transaction and a unique active-order index. Practise explaining it in your own words before recording.


## Required application features — final audit

- [x] Customer signup/login; separate seeded studio account; server-enforced roles and ownership.
- [x] Official 12 paintings/images, pottery items/glazes and wall rate.
- [x] Unique painting purchase, cancellation/release, studio add/edit only while available.
- [x] Wall date 7–90 days; size 10–500; address; server price; unique active date; confirm/decline; customer cancellation through the three-day cutoff.
- [x] Pottery quantity 1–12; seed choices; at least 14 days; edit/cancel while requested; accept/decline.
- [x] Required statuses, private customer activity and all-record studio activity.
- [x] Loading, empty, retry/error and conflict states.
- [x] Public introduction/signup; separate collection, booking, pottery and profile pages.
- [x] Durable SQLite; README, DESIGN.md, .env.example, source and automated checks.
- [ ] User-narrated demo (at most five minutes): silent 4:20 walkthrough prepared; voice still required.
- [ ] Viewable Drive video link and completed submission form.

See VERIFICATION.md for test evidence and limitations. No deployment or real payment is required by the brief.
