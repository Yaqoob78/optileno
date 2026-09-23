# Optileno launch plan: the first 20–30 users in 7 days

*For the founder. September 2026. Read with [STRATEGY.md](STRATEGY.md) (why this product) and [GO-TO-MARKET.md](GO-TO-MARKET.md) (the 30-day view).*

**The goal for the week:** 20–30 fixed-price freelancers set up a **real** project (not the sample) and log at least one real client request. Visitors and signups don't count, because there are no signups. A "user" is someone whose project exists in their browser.

**Why 7 days is realistic:** the product is free and needs no account, so the only friction is attention. At this stage users come from **you talking to people**, not from SEO or ads. SEO starts this week but pays off in months.

---

## Before day 1 (about 2 hours)

| Task | Why | How |
|---|---|---|
| Push the latest build | Redirects, capture, analytics and the new landing go live | Commit and push `main`; check vercel.com shows the deploy as "Ready" |
| Turn on **Vercel Web Analytics** | Without numbers you're guessing | Vercel → project → Analytics → Enable. Cookie-free; the page strips `#…` and request text before sending |
| **Google Search Console** | Lets Google know the new site exists and drop the old pages | See the SEO section below: verify the domain, submit `sitemap.xml`, request indexing of `/` |
| **Bing Webmaster Tools** | Bing also feeds ChatGPT search and DuckDuckGo | bing.com/webmasters → *Import from Google Search Console* (2 clicks) |
| A real email address | `optilenoai@gmail.com` looks like a hobby | `hello@optileno.com` via Cloudflare Email Routing or ImprovMX (free forwarding to Gmail), or Google Workspace (~$7/mo) if you want to send from it too |
| **Shut down the old infrastructure** | Stop paying for, and exposing, the dead v1 backend | AWS Elastic Beanstalk environment + any RDS database, Render services, Supabase project, old Google OAuth client, Groq/API keys (rotate or revoke; they're in `optileno-old/`), Razorpay webhooks. Check the AWS billing page afterwards |
| Use Optileno yourself | Real screenshots beat mockups; you'll find the rough edges first | Set up your current client project and log every request this week |
| Record a 30-second screen capture | The single best asset for every channel | Paste a real-looking request → verdict → Charge → reply → client page. Export as MP4 and GIF |

---

## The 7 days

Targets are cumulative. Conversion numbers are estimates for a free, no-signup tool with a clear pain, not promises.

### Day 1 (Mon): your own network, 10 real users is the goal

1. **List 40 people** who freelance on fixed prices: designers, developers, video editors and writers you've worked with, studied with, or follow. WhatsApp contacts, Instagram, LinkedIn, old college groups.
2. **Send 40 personal messages** (not a broadcast). Script:

   > Hey [name], quick one. I built a small free tool for freelancers after getting burned by "just one more small change" on my own projects. You paste what a client asked, it tells you if it's in scope or extra, and helps you charge it (or gift it) without the awkward email. Would you try it on the project you're on right now and tell me honestly what's missing? optileno.com, no signup.

3. **Post the story on your own LinkedIn and X/Instagram:** your real scope-creep moment + the 30-second video + the link. First person, no hype.
4. Expected: ~15 try it, ~8–10 set up a real project.

### Day 2 (Tue): feedback calls + the first fixes

1. Book 10-minute calls (or voice notes) with everyone who tried it. Ask three questions:
   - "What did the last client request that annoyed you look like?" (paste it into Optileno together)
   - "Did the verdict make sense? Where was it wrong?"
   - "Would you actually send the reply? What would you change?"
2. Write down every misread request. Those are the rules to improve.
3. Fix the top 2–3 issues the same day, then tell those people: "you asked, it's fixed." That turns testers into fans.

### Day 3 (Wed): communities, value first

Post a **story, not an ad**. Title idea: *"I added up every 'quick tweak' from my last 5 projects. It came to $2,400 of free work."* Share the calculator and your numbers, and mention the tool only in a comment or when asked. Respect each community's self-promotion rules; read the rules first.

| Where | Notes |
|---|---|
| r/freelance, r/freelanceWriters | Strict about promotion: story + advice, tool only if asked |
| r/web_design, r/webdev | Use their "Showoff Saturday" thread for the tool itself |
| r/graphic_design, r/logodesign, r/editors, r/VideoEditing | Pain posts do well; keep the link in comments |
| Indie Hackers | "I built this after my own scope creep" post: they like honest maker stories |
| Designer News, Dribbble | A Dribbble shot of the verdict screen and the client page (design folks share these) |
| Facebook groups for freelancers and designers (large Indian and global groups) | Ask a question first ("How do you handle one-more-revision clients?"), share later |

Expected: 1,000–3,000 visits if one post lands; 2–4% set up a project.

### Day 4 (Thu): find people already complaining

1. Search X, Threads and LinkedIn for: `"scope creep"`, `"one more revision"`, `"client asked for" free`, `"quick tweak" client`, `"unlimited revisions"`.
2. Reply helpfully to 20 posts (a tip, a script). Link only when it's clearly welcome.
3. DM 20 freelancers who posted about it this month, starting from their post: "Saw your post about [x]. I built something for exactly that, free, would love your take."
4. Dribbble/Behance/Contra: 10 freelancers whose portfolios show fixed-price work (logos, websites, edits). Short personal email or DM.

### Day 5 (Fri): launch directories and first SEO content

1. Submit to (in one sitting; each takes 5–15 minutes): **BetaList, Uneed, Microlaunch, Peerlist Launchpad, SaaSHub, AlternativeTo** (as an alternative to Bonsai/HoneyBook for scope and change orders), **Fazier, TinyLaunch, Launching Next, Indie Hackers Products**. These bring a trickle of visitors and, more importantly, backlinks.
2. Publish the first SEO page (see the content list below): *"Scope creep email templates for freelancers (warm, brief, and last-round versions)"*, with a link into the app.
3. **Don't do Product Hunt yet.** Launch there in week 3–4 with 30+ real users who can comment honestly.

### Day 6 (Sat): Show HN + fix-it day

1. **Show HN** (`news.ycombinator.com/submit`, title "Show HN: Optileno – check client requests against scope, charge or gift extras"). HN likes the privacy angle: the client page lives in the link's `#`, and there's no account. Post around 8–9 am US Eastern. Stay online to answer comments.
2. Ship fixes from days 2–5. Update the FAQ with the real questions people asked.

### Day 7 (Sun): measure, thank, decide

1. Count: real projects set up (ask people; check Vercel Analytics for `/app` visits and `/s` client-page views, since every `/s` view is a client seeing Optileno).
2. Message every active user: thank them, ask for one sentence you can quote (**real name, with permission**; never invent testimonials).
3. Write a short "week 1" build-in-public post with honest numbers.
4. Decide week 2 using the kill criteria in STRATEGY.md.

**Daily non-negotiables:** 20 personal conversations, one piece of public content, and fix at least one thing a user told you.

---

## SEO: what to do, in order

### 1. Google Search Console setup (day 0)

1. Go to **search.google.com/search-console** → *Add property* → **Domain** → `optileno.com`.
2. Google gives you a **TXT record**. Add it at your domain registrar (wherever optileno.com's DNS is managed) → *Verify*. (If DNS is hard to reach, use a *URL-prefix* property for `https://www.optileno.com/` and verify with the HTML-tag method instead.)
3. **Sitemaps** → submit `https://www.optileno.com/sitemap.xml`.
4. **URL Inspection** → `https://www.optileno.com/` → *Request indexing*. Repeat for `/privacy` and `/terms`.
5. Old v1 pages (`/ai-planner`, `/optileno-vs-motion`, `/tools/...`, `/login` and the rest) now **301-redirect** to the right new pages, so Google will drop them over a few weeks. If any still show in results after 2 weeks, use **Removals** → *Temporary removal* for that URL.
6. Check **Pages** and **Core Web Vitals** once a week.

### 2. Technical fixes worth doing next

- **Prerender the landing page and content pages.** The site renders in the browser; Google copes, but other crawlers (Bing, link previews, AI search) mostly see the `<title>` and meta tags. Prerendering at build time gives every crawler the full text. *(I can add this.)*
- Keep the landing page fast: the art is WebP, the 3D stage is ~20 KB of code, and nothing loads that isn't needed.
- One `<h1>` per page, descriptive titles (done), `SoftwareApplication` structured data (done, honest: price $0, no fake ratings).

### 3. Content: rank for problems, not for "scope creep"

**Be honest about "rank #1":** the head term *"scope creep"* belongs to Wikipedia, PMI, Asana and Atlassian, and a new domain won't beat them this year. Long-tail searches with *intent to act* are winnable. Today they're ranked by mid-sized blogs (Wethos, Twine, Bonsai, Briefance, Delivvo, Kosmo), dev.to posts, Asana/Jotform template pages, and one dedicated competitor site (StopScopeCreep). Useful free tools plus honest guides can outrank those in 2–6 months.

**Your brand name "Optileno" should rank #1 within days** of indexing. Check it; if not, request indexing again.

First 10 pages, each ending with "do this automatically in Optileno":

| # | Page (slug) | Search intent |
|---|---|---|
| 1 | `/guides/scope-creep-email-templates` | "scope creep email template", "how to tell client extra work costs more" |
| 2 | `/tools/scope-creep-calculator` (standalone version of the landing calculator) | "scope creep cost calculator" |
| 3 | `/templates/revision-policy` (generator: rounds, definition, overage price) | "revision policy template freelance" |
| 4 | `/templates/change-order` (fill in, copy, or print) | "change order template freelance designer" |
| 5 | `/guides/how-many-revisions-to-offer` | "how many revisions should a designer offer" |
| 6 | `/guides/not-included-list` (per discipline: website, logo, video, writing) | "what to exclude in a freelance contract" |
| 7 | `/guides/charge-for-extra-revisions` | "how to charge for extra revisions" |
| 8 | `/guides/client-wants-more-than-agreed` | "client asking for more work than agreed" |
| 9 | `/compare/optileno-vs-bonsai` (honest: what each does better) | "Bonsai alternative for scope" |
| 10 | `/guides/fixed-price-vs-hourly-freelance` | "fixed price vs hourly freelance" |

*Note:* the old `/tools/*` URLs currently redirect to `/`. When you publish new pages under `/tools/`, remove that redirect rule from `frontend/vercel.json` first.

Publish 2 a week. Each should have real examples, a real template, and a working tool. Thin AI-written pages won't rank and hurt the domain.

### 4. Links (authority)

- Directory launches (day 5) → ~10–20 links.
- Product Hunt (week 3–4), Show HN.
- Guest posts / quotes: freelance newsletters and blogs, "how I handle scope creep" answers on Qwoted and Featured.com.
- Free tools earn links naturally (people link to calculators and templates).
- Every client page says "Made with Optileno" → brand searches over time.

---

## Competition, and how Optileno wins

| Type | Who | Their angle | Your answer |
|---|---|---|---|
| Direct, AI "shields" | ScopeShield, ScopeAuditor | Upload your contract; AI flags out-of-scope requests and writes a decline email | Relationship-first (charge **or gift**), no upload, instant, private, with a **client page** they don't have |
| Direct, revision counters | Revision Desk | Count revision rounds, share a link | Full scope: extras, gifts, money, replies, one-tap approval |
| Content-led | StopScopeCreep and blogs | Guides and templates | Same guides **plus** a working tool behind them |
| All-in-one CRMs | Bonsai, HoneyBook, Moxie, Plutio, Dubsado | Proposals, contracts, invoices; $12–79/mo | No switching, free, focused on the moment the request lands. Works alongside them |
| Generic AI | ChatGPT / Claude | Writes the email | Doesn't keep the ledger, count rounds, remember gifts, or give the client a page |

---

## Should we add Google AdSense?

**No.** Here's why:

1. **The maths doesn't work.** Display ads on a small site typically pay a few dollars per 1,000 page views. Even 5,000 visits a month is maybe $5–25. **One** Pro subscriber at $12/mo beats that.
2. **It would advertise your competitors.** AdSense would happily show Bonsai, HoneyBook and Fiverr ads to your visitors, right next to your "Start free" button.
3. **It breaks the trust and privacy promise** ("no tracking, no cookies"). AdSense needs cookies and, in the EU/UK, a consent banner.
4. **It makes the page slower and uglier**, which hurts conversion and Core Web Vitals (a ranking factor).
5. **AdSense often rejects app-style sites** as "low-value content" anyway.

**Instead:** the Pro subscription, and later, carefully chosen **affiliate links** inside guides (e.g. to an invoicing or contract tool you actually recommend, clearly disclosed).

---

## AWS or other infrastructure?

**Not now.** Optileno is a static site plus browser storage. Vercel serves it globally for free with no servers to run.

- **Shut down the old AWS resources** (see "Before day 1").
- **Vercel's free Hobby plan is for non-commercial use.** The moment you charge money, move to **Vercel Pro (~$20/mo)** or host on **Cloudflare Pages** (free, commercial use allowed).
- **When you need a backend** (email-forward capture, sync, Pro billing), use **Vercel Functions or Cloudflare Workers + a small database** (Supabase, Neon or Turso free tiers). Inbound email via **Postmark Inbound** or **Cloudflare Email Workers**. That's hours of setup, not the weeks AWS needs, and costs ~$0 until real traction.
- **Payments when Pro launches:** a *merchant of record* (**Paddle** or **Lemon Squeezy**) handles global sales tax/VAT for you, which matters when selling from India to the world. For Indian customers paying in rupees, **Razorpay**. (Stripe accounts for Indian businesses have been invite-only since 2024. Check the current status before relying on it.)

---

## Metrics to watch every day

| Metric | Where | Healthy in week 1 |
|---|---|---|
| Landing visits | Vercel Analytics | Spikes on posting days |
| Visits to `/app` ÷ landing visits | Vercel Analytics | 15%+ |
| **Client-page views (`/s`)** | Vercel Analytics | Any at all = real use (someone shared a scope page with a real client) |
| Real projects set up | Asking users | 20–30 by day 7 |
| Requests logged per active user | Asking users | 3+ in the first two weeks |
| Misreads collected | Your notes | Every one, since they drive the rule improvements |

## After day 7

- **Week 2:** the free tools (calculator page, revision-policy generator), 2 guides, 30 more personal conversations, fix misreads.
- **Week 3:** Product Hunt launch with real users ready to comment; ask for real testimonials.
- **Week 4:** check the kill criteria (STRATEGY.md). If people come back, start Pro (branding, PDFs, sync, reminders) and billing. If they like it but don't come back, build email-forward capture first.
