# Story assets

Prepares the landing page's illustrations for the "living painting" stage.

```bash
cd tools/story-assets
npm install
node prepare.mjs ../../design/story-source
```

Name your source images after the scenes: `hero`, `problem`, `solution`, `action`, `choice`, `client`, `finale` (any of .png/.jpg/.webp).
The script writes `<scene>.webp`, `<scene>.sm.webp` and `<scene>.depth.webp` into `frontend/public/story/`.
Video loops (`hero.mp4`, `finale.mp4`) are made with ffmpeg; the commands are in `docs/LANDING-ASSETS.md`. For a scene with a loop, use the loop's first frame as its still.

See `docs/LANDING-ASSETS.md` for the prompts and specs.
