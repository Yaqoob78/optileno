# Optileno — 3-Week Validation Sprint

**Start:** as soon as you're ready · **Timebox:** 3 weeks at ~10–15 hours/week (change it if that's wrong)
**Rule:** no product code during the sprint. The sprint decides *what* gets built, using thresholds written down before any data comes in.

---

## 1. Where we are (summary of Phase 1 research)

**Killed.** Each item below failed at least one kill rule:
- **The old Optileno AI planner.** Crowded $5–30/mo category: Todoist $5–8, Reclaim $10–18, Motion $19–29, Sunsama $17–22.
- **A decision system for solo SaaS founders.** Founders can already ask Claude or ChatGPT over live data via [Stripe's official MCP server](https://lagrowthmachine.com/stripe-mcp/) and [PostHog AI](https://posthog.com/docs/posthog-ai). The audience is also the most price-sensitive in the study ([IH: "a beautiful trap"](https://www.indiehackers.com/post/the-indie-hacker-community-is-a-beautiful-trap-859d9e6940)).
- **Reddit lead-finding.** 15+ tools, and [GummySearch shut down](https://redship.io/blog/gummysearch-shut-down-alternatives) after failing to get a Reddit API deal.
- **Revenue-weighted feedback** (Canny already does it), **AI-search visibility** ([$300M+ raised](https://ayzeo.com/comparisons/geo-platforms-compared)), **ADHD planners**, **idea validation** (21+ tools), **multi-agent coding tools**, **enterprise "workslop"** (wrong buyer).

**Two survivors, neither proven:**

| | Fractional executives (3+ client retainers) | Premium creative freelancers → funded startups |
|---|---|---|
| Best evidence | [Fractional Jobs 2026, n=1,733](https://www.fractionaljobs.io/the-fractional-work-report): avg **$223/hr**, 64% have 2+ clients, **30% serve more clients because of AI** | Client acquisition is the top freelance-designer challenge ([Fast Company, ~1,300 designers](https://www.fastcompany.com/91571502/freelance-design-pricing-transparency-project-report)). Signal-based outreach gets [15–25% replies vs 1–5% generic](https://www.autobound.ai/blog/cold-email-guide-2026) (vendor benchmark) |
| Biggest weakness | Pain quotes are vendor marketing ([Carly](https://www.usecarly.com/blog/ai-agents-for-fractional-executives/), [Juggle](https://www.joinjuggle.com/resources/fractional-executive-tech-stack/)). **You have no access** to this audience | Tooling is commoditized: Apollo/Clay for signals, [AuditPitch](https://auditpitch.com/) audits + outreach at **$0/$10/$50**. [77% of freelancers](https://onehour.digital/blog/client-acquisition-statistics-for-freelancers) get most work from repeat clients |
| The one unowned piece | A strictly client-separated record of commitments, decisions, updates and prep | **Selection:** which startups, right now, will pay for premium creative work, and why |

**Your answers changed the plan.**
- Zero users and no network make **reaching strangers** the gating skill for every option.
- So the sprint tests reachability directly.
- It also makes you customer zero on the one option you personally live.

---

## 2. The three tracks

| Track | Question it answers | Time/week |
|---|---|---|
| **A. You as customer zero** | Does *selecting* the right startups at the right moment, plus a specific, value-first message, get replies, calls and paid work? | 6–8 h |
| **B. Fractional reach probe** | Can you reach fractional executives at all? If yes, is their pain real in their own words? | 2–3 h |
| **C. Freelancer interviews** | Is prospecting actually other freelancers' gap, and would they pay to fix it? | 2–3 h |

Log everything in `validation-tracker.csv` (same folder). Save verbatim quotes. Quotes are the evidence that replaces the vendor marketing above.

---

## 3. Track A: you as customer zero (freelance web / motion)

### Who you target
Software or AI startups that:
1. announced **funding, a launch, a rebrand or a new product in the last 30 days**, and
2. have money (announced round, YC, or visible paying customers), and
3. have a **landing page or launch video clearly below their stage**, and
4. have a reachable decision-maker (founder, CEO or marketing lead with public contact).

### Where to look (about 20 minutes a day)
- Y Combinator Launches: `ycombinator.com/launches`
- Product Hunt: daily launches
- Hacker News: "Show HN" and "Launch HN"
- TechCrunch: funding coverage
- X search: `"we raised" OR "seed round" OR "launching today"`, last 7 days
- BetaList

### Qualify before you write (all five must be "yes")
1. Fresh trigger (≤30 days)?
2. Evidence of budget?
3. A **specific** gap you can point to? For example:
   - the headline doesn't say who it's for
   - no product visuals above the fold
   - no demo or launch video
   - broken on mobile
   - inconsistent visual system
4. A named person you can reach through public channels?
5. Would you be proud to have them in your portfolio?

### The message (value first; don't ask for a call in the first message)

> **Subject:** {Company}'s hero, one fix
>
> Hi {Name}, congrats on {trigger}.
>
> I spent some time on {site}. One thing stood out: {specific observation, e.g. "the hero says 'AI workflow platform', but your demo shows it's built for recruiters, so a recruiter landing here can't tell in 5 seconds that it's for them"}.
>
> Here's a quick mockup of how that section could read: {image or 60-second Loom}.
>
> Happy to send two more fixes if it's useful.
>
> {Your name}, {one-line credential} · {portfolio link}

**Rules:**
- **Volume:** 10 qualified startups per week, 30 in total.
- **Follow-ups:** one follow-up after 4 days, then stop.
- **Honesty:** mockups are clearly labelled as concepts, never presented as their live site. Use only publicly listed contact details.
- **Log the minutes spent selecting each prospect.** That selection work is what a product would automate. If it takes >20 minutes per good prospect, you've found the painful step.

### Thresholds (written now, before the data)

| Result after 30 messages | Meaning |
|---|---|
| **≥15% replies (≥5) and ≥2 calls** | Selection plus specificity works. Continue; a paid project is a strong bonus signal. |
| 6–14% replies | Mixed. Change *one* variable in week 3 (targeting or message, not both) and re-measure. |
| **≤5% replies (≤1)** | The method fails, at least for you right now. Portfolio strength may be the confound. Note it honestly. |

---

## 4. Track B: fractional executive reach probe

### Find them
- LinkedIn search: `"Fractional CMO"`, `"Fractional COO"`, `"Fractional CFO"`, `"Fractional CRO"`.
- Prefer people whose profile or posts mention **several current clients**.

### Connection message (research only, no pitch)

> Hi {Name}, I'm researching how fractional execs keep several clients straight each week (updates, commitments, prep). Not selling anything. Would you walk me through your last week in 15 minutes? I'll share the anonymized findings.

LinkedIn limits personalized notes on free accounts. If you hit the limit, send plain requests and message after they accept.

### Interview (15–20 minutes; ask about real events, not opinions)
1. How many clients right now, and for how long with each?
2. Walk me through last week. For each client, what did you do that *wasn't* the strategy work itself?
3. When did you last drop, or nearly drop, a commitment to a client? What happened?
4. How do you prepare for a client meeting today? How long does it take?
5. What do you pay for (notes, CRM, assistants)? What did you try and abandon?
6. If one part of juggling clients disappeared, which would it be?

Do not describe a product idea. Write down exact words.

### Thresholds
- **Reach:** 50 requests. **≥8 conversations** means reachable, so continue to 20 interviews. **<3** means park fractionals.
- **Pain** (only if reachable): ≥8 of 20 name coordination, updates or commitment tracking as a top-3 weekly time sink **without being prompted**.

---

## 5. Track C: freelancer interviews (10)

### Find them
- Dribbble, Contra, X design community, Layers, design Discords.
- Reddit communities (r/freelance, r/web_design). You can read these; the research tools couldn't.
- Target: freelancers selling **$1.5k+ projects to software companies**.

### Interview
1. Where did your **last 5 clients** come from? Count them: referral / repeat / inbound / platform / outbound.
2. The last time your pipeline was empty, what did you do? How long until it filled?
3. Have you tried outbound? What happened? Roughly what reply rate?
4. What do you pay for to get work (Upwork Connects, tools, communities)? Roughly how much a month?
5. If someone handed you 3 startups a week that likely need your work *now*, with the reason, what would you do with it? Would you pay? How much?

### Thresholds
- **Product lives:** ≥5 of 10 say prospecting/outbound is their main gap **and** ≥3 would pay ≥$29/mo.
- **Product dies, even if Track A works for you:** ≥6 of 10 get most work from referrals/repeat and don't want outbound.

---

## 6. Decision at the end of week 3

| Track A | Track B | Track C | Next move |
|---|---|---|---|
| Works | any | Product lives | **Build the selection engine for premium creative freelancers.** Phase 2 counterargument first. |
| Works | any | Product dies | Keep it as *your* income method; do not build a SaaS for it. |
| any | Reachable + pain confirmed | any | **Fractional executives become the lead.** Run the concierge test. |
| Fails | Not reachable | any | Stop and rethink. The honest conclusion may be to build reach first (portfolio, audience, one niche community) before any SaaS. |

Whatever happens, bring back the filled tracker and interview notes. Phase 2 ("Why Optileno should NOT build this") gets written against **your data**, not desk research.

---

## 7. Housekeeping on the live site (optional, ~10 minutes)

The current optileno.com makes claims that aren't true. With zero users the harm is small, but Google penalizes review markup that isn't backed by real reviews.
- **Rating:** the structured data claims a `4.9 / 195` rating.
- **Calendar:** "Google Calendar Sync" is advertised, but only one-way "Add to Google Calendar" links and `.ics` export exist.
- **Pricing:** Terms, Refund and comparison pages quote three different prices.
