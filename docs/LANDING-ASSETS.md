# Landing page art brief

*For whoever generates the landing page's illustrations and video loops (Midjourney, ChatGPT/GPT-image, Imagen, Flux, Runway, Kling, Veo…). September 2026.*

The landing page is a story told in seven scenes. Each scene is one illustration that the page turns into a **living painting**: a depth map makes near things move more than far things as the visitor scrolls and moves the mouse, and chapters change by flying through clouds. All text and product UI is real HTML laid over the art.

## Status (September 23)

**Delivered and live in the page:** the character sheet, all seven scenes, and loops for `hero` and `finale`. Originals are in `design/story-source/`; the processed files are in `frontend/public/story/`.

How they were processed:

- **Stills:** Lanczos upscale to 2048 px plus light sharpening (`<scene>.webp`), a 1280 px version for phones (`<scene>.sm.webp`), and a Depth Anything V2 depth map (`<scene>.depth.webp`).
- **Loops:** the generated videos drift in camera for their first ~2 s, so each loop uses seconds 2–8, crossfading the end back into the start (5 s, seamless, ~2 MB). The loop's first frame is the scene's still, so there's no pop when the video starts, and the depth map is made from that frame, so the parallax lines up.

  ```bash
  ffmpeg -ss 2 -t 6 -i hero-loop-raw.mp4 -filter_complex "[0:v]split[x][y];[x]trim=start=1,setpts=PTS-STARTPTS[main];[y]trim=end=1,setpts=PTS-STARTPTS[head];[main][head]xfade=transition=fade:duration=1:offset=4,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 22 -movflags +faststart hero.mp4
  ffmpeg -i hero.mp4 -frames:v 1 hero-first.png   # becomes hero.webp + its depth map
  ```

**Still worth improving, when you have time:**

1. **Resolution.** The stills came out at 1376 × 768. They're upscaled, but a native 2560 px render (or a proper AI upscale in Magnific/Topaz) will look noticeably sharper on large and retina screens. Drop the new files into `design/story-source/` with the same names and rerun the script.
2. **The Gemini sparkle.** Several stills carry Gemini's small visible watermark in the bottom-right corner. It's subtle, and the chapter indicator sits near it, but if your plan lets you export without it, re-export.

The original brief follows.

---

## The six rules (read these first)

1. **No text, letters, numbers, signs, logos, UI panels or screens with content.** Screens can glow; they must not show readable UI. The page adds the real interface itself.
2. **The same hero in every scene.** Make the character sheet (below) first, then use it as the reference image for every scene.
3. **Keep the left 40% of the frame calm**: sky, soft wall, out-of-focus background. The headline sits there. Put the main subject in the **right half** (roughly 55–80% across).
4. **Three depth layers in every scene:** something near (grass, a desk edge, a railing, leaves), the subject in the middle, and a far vista. That separation is what makes the 3D parallax feel real.
5. **16:9 at 2560 × 1440 or larger.** Generate at the tool's maximum size, then upscale 2× with a proper upscaler (Magnific, Topaz, or the tool's own upscaler). No borders, no vignette burned in.
6. **One continuous day.** The light moves through the story: dawn, then night, then morning, golden afternoon, sunset, bright late morning, and finally blue hour.

---

## Style block (paste into every prompt)

> stylized 3D animated feature-film still, warm cinematic lighting, soft volumetric light rays, painterly textures, gentle depth of field, whimsical but grounded, calm rich palette of warm cream, terracotta, ochre, sage green and dusk blue, highly detailed, 35mm lens, clean composition, no text, no letters, no numbers, no logos, no user interface, no signage, no watermark

**Negative prompt** (for tools that support one):

> text, letters, words, numbers, typography, signage, logo, watermark, user interface, UI panel, hologram screen with text, captions, subtitles, frame, border, extra limbs, distorted hands, duplicate character, blurry face

*Midjourney v7 suffix:* `--ar 16:9 --style raw --stylize 200 --q 2` and `--oref <character-sheet-url> --ow 100` for the hero's consistency (on v6: `--cref <url> --cw 80`). *ChatGPT / GPT-image:* attach the character sheet to every request and say "same character as the reference image". *Flux Kontext / Ideogram:* use their character-reference feature with the sheet.

> Avoid naming studios or films ("Pixar-style" etc.). Many tools refuse it, and the generic description above gets the same look.

---

## Character bible

**Kai**, a freelance designer in his mid-20s. Tousled chestnut-brown hair, warm light-tan skin, friendly and focused expression. Olive-green canvas jacket over a cream hoodie, dark indigo jeans, worn brown leather boots, a tan canvas backpack with a few small embroidered patches (no text on them).

**Pixel**, Kai's companion: a small red-and-cream Shiba Inu with a dark-green collar.

**Maya**, the client (scene 06 only): café owner in her early 30s, dark hair in a low bun, sage-green cardigan, warm smile.

### Character sheet prompt (make this first)

> character turnaround sheet of Kai, a freelance designer in his mid-20s, tousled chestnut-brown hair, warm light-tan skin, friendly focused expression, olive-green canvas jacket over a cream hoodie, dark indigo jeans, worn brown leather boots, tan canvas backpack with small embroidered patches without any text; beside him a small red-and-cream Shiba Inu with a dark-green collar; front view, three-quarter view, side view and back view, plain warm-grey studio background, even soft lighting, + style block

Pick the version you love and use it as the reference for everything below. If a scene drifts (different face or jacket), regenerate. Consistency matters more than any single beautiful frame.

---

## The seven scenes

For each scene: save as `<name>.png` (or .jpg/.webp) with exactly these names.

### 1 · `hero`: Dawn over a floating world
*Page: "Clear scope. Happier clients. A freer you." (headline left, handwritten note top-right)*

> wide cinematic shot at sunrise: Kai sits on a grassy cliff edge in the right half of the frame, seen from behind at three-quarters, a closed laptop resting beside him, Pixel sitting next to him looking up at him; beyond them a breathtaking valley of floating islands with thin waterfalls, drifting clouds below, and a distant soft-focus city glowing in the morning haze; wildflowers and rocks in the near foreground at the bottom right; the left 40% of the frame is open luminous sky with soft pink-gold clouds, calm and uncluttered; golden-hour rim light on hair and fur, + style block

Focus point: right half, around (0.68, 0.5).

### 2 · `problem`: The late-night creep
*Page: "It always starts with a small tweak." Dark scene; chat bubbles and a stack of "book spines" float on the right.*

> cozy home studio at night, Kai sits at a wooden desk in the center of the frame, seen from behind, shoulders slightly slumped, lit by a warm desk lamp and the cool glow of a large monitor showing only a soft abstract blur, several empty coffee mugs and scattered sketch papers on the desk, Pixel asleep curled on a cushion near his chair; to the right a large rain-streaked window with blurry city lights at night (keep this upper-right area softly out of focus and uncluttered); shelves with plants and books in soft shadow on the left; moody, quiet, a little tired but warm, + style block

Focus point: center-right, around (0.6, 0.55).

### 3 · `solution`: The climb to clarity
*Page: "Turn ambiguity into clarity." Four step cards climb diagonally from lower-center to upper-right.*

> bright clear morning, Kai walks up wide ancient stone steps carved into the side of a floating island, the stairway rising diagonally from the lower middle of the frame toward a sunlit grassy plateau at the upper right, Pixel trotting a step ahead, sea of soft clouds far below, distant floating islands with small trees, fresh light and long soft shadows, sense of progress and calm; the left 40% is open sky and distant clouds, + style block

Focus point: center, around (0.55, 0.5).

### 4 · `action`: The studio at golden hour
*Page: "From client request to clear next step." The live demo (two cards) sits center-right.*

> a calm, tidy home studio at golden hour, Kai sits at a wooden desk at the far right of the frame, working on a laptop whose screen shows only a soft glow, a mug of tea and a small plant beside him, Pixel asleep on a round cushion by his feet; behind the desk a huge floor-to-ceiling window overlooking a warm sunlit city of elegant towers and floating gardens, softly out of focus so the middle of the frame is bright and uncluttered; bookshelves in the near-left foreground, slightly blurred, + style block

Focus point: right third, around (0.72, 0.55).

### 5 · `choice`: Two doors
*Page: "Same work. Different outcome. You're in control." Charge and Gift cards overlay the doors.*

> at sunset on a stone terrace high above a glowing valley, two tall ornate arched doorways stand side by side in the center-right of the frame, the left doorway filled with warm amber-gold light, the right doorway filled with soft emerald light, both doorways plain with no symbols and no writing; Kai stands small in front of them between the two, seen from behind, backpack on, Pixel sitting beside him; stone lanterns glowing along the terrace edge in the near foreground, dramatic warm sky, magical but grounded; the left 40% is a softer, darker part of the terrace and sky, + style block

Focus point: center-right, around (0.6, 0.5).

### 6 · `client`: The client on the balcony
*Page: "Transparency for happier clients." A browser window (the client page) floats center-right.*

> bright late morning, Maya, a café owner in her early 30s with dark hair in a low bun and a sage-green cardigan, sits in a wooden chair on a flower-filled balcony at the far right of the frame, holding a tablet whose screen shows only a soft glow, smiling contentedly as she looks out; beyond the balcony railing a lush green valley with a winding river and a small village, big fluffy clouds in a blue sky; the middle of the frame is open sky and valley, uncluttered; potted geraniums and ferns in the near foreground on the right, + style block

Focus point: right, around (0.8, 0.6).

### 7 · `finale`: Blue hour, together
*Page: "Same you. A brighter tomorrow. Protect your scope today." Headline left over a darker scrim.*

> blue hour just after sunset, Kai sits relaxed on a rocky mountain ledge in the right half of the frame, leaning back on his hands, Pixel curled against his side, both looking out over a vast valley where a city of warm lights glows beneath floating islands with tiny lanterns, first stars appearing in a deep blue and violet sky; wildflowers and grass in the near foreground bottom right; peaceful, proud, free; the left 45% is calm twilight sky, + style block

Focus point: right half, around (0.68, 0.55).

---

## Optional: living loops (video)

The stage can play a short seamless loop instead of a still for any scene. It looks best for `hero` and `finale`. Use **image-to-video** with the finished still as the first frame (Runway Gen-4, Kling, Veo, Luma).

**Camera must stay locked.** The depth map is made from the still, so only small things may move.

> Hero loop: locked-off camera, no camera movement. Gentle breeze moves Kai's hair and jacket slightly, Pixel's ear twitches once and the tail sways, grass and wildflowers sway softly, clouds drift slowly left to right, waterfalls flow, distant city lights twinkle faintly. Seamless loop, 8 seconds, calm and cinematic, no new objects appear, no text.

> Finale loop: locked-off camera, no camera movement. City lights twinkle, small lanterns drift slowly upward from the valley, a few stars shimmer, grass sways in a light breeze, Kai breathes calmly, Pixel's tail moves once. Seamless loop, 8 seconds, no text.

Export 1920 × 1080 (or 2560 × 1440) H.264 MP4 at about 4–6 Mbps, no audio, and name it `hero.mp4` / `finale.mp4`. To switch a scene to video, add `video: '/story/hero.mp4'` to that scene in `frontend/src/landing/journey/scenes.ts`. Visitors who prefer reduced motion still get the still image.

---

## Turning the images into the page

```bash
cd tools/story-assets
npm install
node prepare.mjs path/to/your/images
```

This resizes each image to ≤2560 px WebP and creates its depth map (Depth Anything V2, runs locally). Both land in `frontend/public/story/`, replacing the placeholders. Then run the site (`cd frontend && npm run dev`) and scroll through.

Per scene you can fine-tune three things in `frontend/src/landing/journey/scenes.ts`:

| Setting | What it does |
|---|---|
| `focus` | the point that must stay visible when the image is cropped (phones, wide screens) |
| `tone` | `light` = paper scrim + dark text, `dark` = dark scrim + light text |
| `grade` | exposure, warmth, saturation applied live, e.g. to push `problem` toward night |

## Delivery checklist

- [ ] Character sheet approved first
- [ ] 7 scenes, same Kai and Pixel in every one
- [ ] No readable text or UI anywhere (zoom in to check signs, screens, patches)
- [ ] Left ~40% calm in every scene
- [ ] Near, middle and far layers present
- [ ] 16:9, ≥2560 px wide after upscaling
- [ ] (Optional) `hero.mp4` and `finale.mp4` loops, camera locked
- [ ] Run `prepare.mjs`, then check each chapter on desktop and phone
