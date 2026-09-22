# Optileno — Cinematic landing page: brainstorm & creative direction

## 1. The brief

- **Audience:** freelancers juggling client work.
- **Promise:** *Know if you can say yes.*
- **Feel:** calm, premium, cinematic, 3D, smooth. It should make a visitor say "wow" **and** understand the product without reading a paragraph.
- **The bar:** the previous 3D forest landing was beautiful but *decorative*. The tree didn't explain anything. This one must be beautiful **and** true: every frame should show what Optileno actually does.

## 2. Concepts considered

| Concept | Idea | Verdict |
|---|---|---|
| **A. The Tree** (previous) | One trunk (you), branches (clients), fruit (deliverables). Overload bends the branch. | Gorgeous but abstract. Visitors admire it and still don't know what the app does. Kept only as atmosphere. |
| **B. The Glass Week** ✅ | Fourteen glass pillars, one per day, stand in a still mirror lake at dawn. Each pillar is as tall as your real focused hours. Projects are solid, coloured blocks stacked inside. A client's request arrives as a glowing amber block. Say yes and it won't fit: blocks spill past their deadlines and turn red. Then Optileno re-flows the week and a beam of light lands on the day you *can* promise. | **Chosen.** Cinematic and literal at once. The scene is driven by the **real scheduling engine**, so the visuals *are* the product's math. |
| C. Vessels & tide | Days are glass vessels; work is liquid; a new request overflows. | Beautiful, but liquid makes hours and days hard to read, and a convincing fluid simulation is heavy on phones. |
| D. Constellation | Commitments as stars and threads. | Pretty, zero explanatory power. |

## 3. Why "The Glass Week" wins

1. **It shows instead of tells.** Capacity is height. Work is volume. Late is red. Nobody needs a legend.
2. **It is honest.** Every block position comes from `buildPlan()` and `evaluateOffer()`, the same code the app runs. If the product's answer changes, the film changes.
3. **It has a story arc.** Calm week → a request arrives → tension (overflow) → resolution (a date you can promise) → peace.
4. **It becomes interactive.** In one chapter the visitor drags the hours and picks a deadline, and the 3D week re-stacks live. That's a demo nobody else in the category has.
5. **It keeps what worked before:** nature, water, mist, a day passing from dawn to dusk, smooth cinematic scroll.

## 4. Storyboard (10 chapters, scroll-driven)

| # | Chapter | Camera | Light | What happens in 3D | Copy on screen |
|---|---|---|---|---|---|
| 0 | **Hero** | Low, wide, from the shore | Dawn, backlit, mist | The glass week stands in the lake, blocks glowing softly, reflections below | *Know if you can say yes.* + CTA |
| 1 | **Your week** | Rises, faces the pillars | Soft morning | Day labels fade in under each pillar; weekends are short plinths | "Fourteen days. Five focused hours a weekday…" |
| 2 | **Your projects** | Glides along week one | Morning | Project labels appear on their blocks | "Every project takes up real space…" |
| 3 | **The ask** | Tilts up toward Friday | Bright noon | A tall amber block hovers above Friday, slowly turning; Friday's deadline ring glows | A client's message: "Can you do the pricing page by Friday? About 12 hours." |
| 4 | **The truth** | Low, dramatic, close to the overflow | Cooler, tense | The amber block drops in. Work spills into next week; late blocks turn red and pulse | "Your gut says yes. The math says no." |
| 5 | **The answer** | Pulls back and rises | Golden hour | Everything re-flows; a column of light lands on next Friday | "Promise next Friday instead. Nothing else moves." + reply card |
| 6 | **Try it** | Frontal, holds still | Clear day | Visitor drags hours and picks a deadline; the week re-stacks live | Interactive panel with the real verdict |
| 7 | **What you get** | High and wide over the lake | Afternoon | Calm, whole landscape | Three feature cards |
| 8 | **Private by design** | Down near the water, reflections | Early dusk | Blocks glow a little brighter | "No account. No server…" |
| 9 | **Final** | Wide from the shore | Sunset | The week glows against the sunset | *The next client will ask. Know your answer.* |

## 5. Visual language

- **Palette:** dawn mist (#e9e4d6), deep lake green (#10241e), stone plinths (#d8d2c4). Client colours: sage, sky, clay. **Amber is always the new request; red always means late.** No other colour carries meaning.
- **Materials:** frosted glass with clear-coat highlights for capacity; soft ceramic blocks with a satin sheen; pale stone plinths; a mirror-still lake with slow ripples.
- **Type:** Newsreader serif for statements, Inter for interface. The same system as the app.
- **Light:** a single sun that moves through the day as you scroll (dawn → noon → golden → dusk), plus soft sky fill and gentle fog for depth.

## 6. Motion principles

- **The camera is scrubbed by scroll; blocks are animated in time.** The camera always follows your finger, and blocks settle with a soft spring when you arrive at a chapter.
- **Nothing snaps.** Positions spring into place; colours cross-fade; the light blends between chapters.
- **Idle life:** faint drifting dust, slow ripples, a barely perceptible camera breath. Never distracting.
- **Reduced motion:** native scrolling, no camera drift, instant chapter transitions.

## 7. Technical plan

- **three.js**, one fixed full-screen canvas, lazy-loaded so text paints first. **Lenis** smooth scroll feeds one shared animation loop.
- **Real engine:** `story.ts` builds the chapter layouts (base week, as-asked, safe) from `buildPlan` and `evaluateOffer`.
- **Scene:** sky shader, mirror-lake reflection (desktop), fog, far ridges and tree line, drifting mist, rounded blocks with clear-coat, glass capacity volumes, soft sun shadows, dust.
- **Labels:** HTML (crisp at any size), positioned every frame from 3D coordinates.
- **Performance:**
  - Quality tiers: phones skip the reflection pass and use lighter shadows.
  - Resolution adapts when frames get slow.
  - Rendering pauses in background tabs.
- **Accessibility:** all copy is real HTML; the 3D layer is decorative (`aria-hidden`). The interactive chapter works with keyboard and screen readers, and prints the verdict as text.
- **Fallback:** if WebGL is unavailable, a painted gradient backdrop and the full story in text.
