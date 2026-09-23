# Story assets

Prepares the landing page's illustrations for the "living painting" stage.

```bash
cd tools/story-assets
npm install
node prepare.mjs path/to/your/generated-images
```

Name your source images after the scenes: `hero`, `problem`, `solution`, `action`, `choice`, `client`, `finale` (any of .png/.jpg/.webp).
The script writes `<scene>.webp` and `<scene>.depth.webp` into `frontend/public/story/`, replacing the placeholders.

See `docs/LANDING-ASSETS.md` for the prompts and specs.
