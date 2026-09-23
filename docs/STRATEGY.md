# Optileno: strategy

*September 23, 2026. Replaces every earlier strategy doc (archived in `optileno-old/`).*

## The decision

Optileno is now **scope protection for freelancers who work on a fixed price.** You set up what a project includes in about a minute. Then you paste each client request as it arrives. Optileno says whether it's in scope, a revision round, or extra, and shows why. You then **charge it** (the client approves in one tap) or **gift it** (the client sees it as a gift, with its value). The tagline is the product: *Charge it. Gift it. Never lose it.*

## Why this and not the earlier ideas

| Idea | Verdict | Why |
|---|---|---|
| v1: AI daily planner (goals, habits, analytics, chat) | Killed | Crowded by well-funded tools (Motion, Sunsama, Reclaim) and replaced by general assistants. No specific buyer, no specific pain. |
| v2: "Can I say yes?" capacity planner for freelancers | Retired | Real problem, but a *nice-to-have*: being overbooked is a good problem to have. The benefit is time and stress, not money, so it's hard to charge for. It's also a planner, the category that already failed. |
| **v3: scope protection (this)** | **Build** | The pain is about money, it's emotional, and it happens on almost every project. The value is easy to prove: one caught request pays for a year. The client page brings Optileno in front of new people. |

## Who it's for (first)

Freelancers who **quote a fixed price** (not hourly), 2–8 years in, charging roughly $40–150/h, with 3–8 clients a year or more:

- web designers and developers (the core group)
- brand and logo designers
- video editors and motion designers
- writers who sell content packs

Hourly freelancers bill their extra hours automatically. On a fixed price, every "quick tweak" comes out of the freelancer's margin. That's the sharpest cut of the market, and the product uses it in its positioning.

Later expansion, in order: small studios (2–5 people, shared workspace), then agencies (client-services teams), then adjacent fixed-scope trades (photographers, architects, consultants).

## The pain: evidence and how strong it is

- **Scope creep is common.** About half of all projects experience it (PMI, *Pulse of the Profession*, 2018). This is organisational data, not freelancer data, but it's the most credible number available.
- **Freelancers name it as a money leak.** Indie-maker writeups estimate $7,800–$15,600 a year lost per freelancer. *Treat this as unverified: it comes from vendor-style blogs, not a survey we can check.*
- **Bigger pains exist.** Finding clients (62% call it their biggest issue) and inconsistent income (43%) rank higher in freelancer surveys (freelancermap, 2026). 85% get paid late at least sometimes (Remote, 2025). Those markets are crowded with lead-gen and invoicing tools. Scope creep is the biggest pain *without* a clear winner.
- **The emotional core is real and specific.** Freelancers don't lose this money because they can't do maths. They lose it because asking for money mid-project feels petty, and silence feels safer. That's why a better contract doesn't fix it, and why the "gift it" option matters.

## Competition

| Player | What they do | Gap we use |
|---|---|---|
| ScopeShield (~$20/mo) | AI scans your contract; email gateway returns a verdict and a decline email | Adversarial ("firewall", "shield"). Their own write-up says the UI-only version saw little use. |
| ScopeAuditor (launched June 2026) | AI verdict, "ghostwriter" reply, PDF change order | Same AI-contract approach; no client-side experience |
| Revision Desk | Revision counter with a client share link | Only revisions, not extras, gifts or money |
| Bonsai, HoneyBook, Moxie, Plutio ($12–79/mo) | All-in-one CRMs with proposals and contracts | Scope is a document to them, not a live conversation. They're heavy and expensive to switch into. |
| Notion/Gumroad change-order kits (free–$30) | Templates | Manual; nobody keeps them up |

None of the dedicated tools shows public evidence of traction. The category is **validated as a problem and wide open as a product**: a handful of recent indie MVPs, all built on the same "AI reads your contract" idea.

## How we win

1. **Relationship-first, not adversarial.** Every competitor is a shield against the client. Optileno gives a third option between "charge" and "absorb silently": *gift it, visibly.* Gifts show on the client's page with their struck-through value. That's reciprocity by design, and it makes charging for the *next* extra easier.
2. **The client page is the product's second half.** One link, no login: what's included, revision rounds used ("1 of 2"), extras with an Approve button, gifts. Clients change their behaviour when they can see the edges. Every page carries "Made with Optileno", so every freelancer shows the product to their clients.
3. **Instant, explainable, private.** No AI and no contract upload. Scopes come from careful templates in about a minute. Verdicts come from plain rules, always with a reason. Data stays on the device, and the shared page travels *inside the link*, so it never touches a server. Compared with "upload your contract to our AI", this is a real trust advantage.
4. **The money is visible.** "Recovered this year", "Waiting on clients", "Gifted on purpose". The first number is both the retention hook and the testimonial.

## Counterarguments, taken seriously

| Objection | Answer | Remaining risk |
|---|---|---|
| "ChatGPT can write the email." | True, and the drafts are the least of it. ChatGPT doesn't keep the ledger, count rounds, give the client a page, or remember what was gifted. | Medium. We must win on speed and on the client page. |
| "People won't open another app when a request lands." (ScopeShield's own lesson) | Capture is one paste, the `/` shortcut, a one-click "Check with Optileno" bookmark that grabs selected text from Gmail/Slack/any page, and an Android share target. | **Still high: this is the #1 product risk.** Next: forward-by-email capture (needs a small backend). |
| "Freelancers don't pay for tools." | They pay for tools that pay them back: Bonsai and HoneyBook charge $20–80/mo. Price is anchored to recovered money. | Medium. Test before building Pro. |
| "Local-first means no sync, no reminders, no real signatures." | Deliberate for v1: zero servers, zero cost, and a strong privacy story. Pro adds sync and reminders. | Low for testing, higher for scale. |
| "It's a crowded indie niche." | Several MVPs, none with traction, all using the same AI-contract idea. The client-facing, gift-aware angle is unclaimed. | Medium. Move fast; distribution decides it. |
| "Rules will misread requests." | It always says why, labels its confidence ("Fairly sure", "Best guess", "Not sure. Your call"), and the freelancer confirms with one tap. 27 realistic requests are covered in tests. | Low to medium. Grow the rule set from real user misreads. |

## Business model

- **Now:** free during early access. No card, no account.
- **Pro (planned, $12/mo or ~$96/yr, to be validated):** your logo and colors on client pages, signed PDF change orders, sync across devices, reminders for unapproved extras, email-forward capture.
- **Cost to serve today:** static hosting only. Margins at scale are close to 100% until sync ships.
- **Pricing logic:** one caught request (typically $150–400) covers a year of Pro. Say so on the pricing page, and show each user their own "recovered" number.

> **Decided (Sept 23):** Pro stays at **$12/mo, labeled "planned"**, and gets validated in the 30-day test. The old ₹1,499 / $6.99 prices belonged to v1 and no longer apply.

## What to measure

| Stage | Signal |
|---|---|
| Activation | First real project created (not the sample) |
| Aha | First request logged and resolved (charged or gifted) within 7 days |
| Habit | 3+ requests logged in the first 14 days |
| Value | $ recovered per active user (this becomes the testimonial) |
| Growth | Client pages shared per user; visits arriving via `?ref=scope-page` |

**Measurement:** cookie-free Vercel Web Analytics is wired in (page views only; everything after `#` and any request text is stripped before sending, and the Privacy page says so). It needs one click to enable in the Vercel dashboard. Views of `/s` (client pages) are the best early signal of real use. Everything deeper (requests logged, money recovered) comes from talking to users until accounts exist.

## The 30-day test (kill criteria)

Run it with 30 real fixed-price freelancers (communities, DMs, friends of friends):

- **Proceed to Pro** if ≥40% log 3+ real requests within 14 days, ≥10 client pages get shared, and ≥5 people say, unprompted or when asked, that they'd pay $12/mo.
- **Rework capture** if people like the idea but don't come back (the ScopeShield trap): ship email-forward capture first.
- **Revisit the thesis** if fewer than 10 of 30 set up a real project after seeing the demo.

## Built in v3

Landing page with a scroll story, live demo and leak calculator · onboarding · scope templates (website, landing page, logo & identity, video edit, feature build, writing, custom) · verdict engine with reasons and confidence · revision-round tracking (feedback that arrives in pieces counts once) · extras priced from your rate, with the delivery-date impact · charge / gift / approve / decline · warm or brief reply drafts · client scope page with one-tap approval by email and a link back that marks it approved · money ledger · dark mode · backup and restore · privacy and terms pages. 26 unit tests.

## Next, in order

1. Capture by email forwarding (needs a small backend); a Gmail/Slack extension if the bookmark proves popular.
2. Prerender the landing and content pages for crawlers.
3. Pro: sync (accounts), branding, signed PDFs, reminders, and billing (Stripe or Lemon Squeezy).
4. Studio workspaces (2–5 seats).
