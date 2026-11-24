# hi3d MCP 3D Asset Generation & Lighting Harmonization

Read this file when the scene includes external 3D `.glb` accent assets or generates 3D models via the `hi3d` MCP server.

## 1. Role of 3D assets (85/15 rule)

3D `.glb` models are **focal accents** inside a papercraft world, never a replacement for the paper world itself:

- **Keep in paper (`Three.js` kit, ~85-90 % of the scene):** the printed ground, water, paths, layered hill sails, slotted-cross trees, bushes, ordinary cottages/walls (`boxFold`), open bridges/stairs (`platform`), and `paper-life.js` weather/critters.
- **Promote to 3D `.glb` (`hi3d`, 1-5 hero/focal assets per scene):** signature relics (an ocarina, elemental stones, a sword in its pedestal), a central fountain statue, a treasure chest, a boss/guardian centerpiece, or an optional miniature figurine hero.
- **Scale reference (`1 unit = 1 cm`, hero `3.6`):** small held/floating relic `1.4-2.4`; chest/pedestal/altar `2.2-3.5`; character figurine `3.4-4.0`; central statue/monument `5.0-8.5`.

## 2. Direct `hi3d` MCP pipeline (highest quality, zero confirmation pause)

`hi3d` has no direct text-to-3D endpoint (`text_to_3d: false`). Execute the full **multi-view image -> `v3.0 master` 3D** pipeline automatically without pausing for manual two-step confirmation:

1. **Reuse check (free):** inspect `<project>/assets/models/manifest.json` first, then call `list_tasks` on `hi3d`. If a matching completed 3D task already exists, call `get_task_outputs` and download it directly.
2. **Balance check (free):** call `get_balance`. Proceed directly when points cover the run; stop and report only if balance is insufficient.
3. **Multi-view turnaround generation:** call `create_image_generation` with:
   ```json
   {
     "operation": "text_to_image",
     "model_name": "Nano-Banana-Pro",
     "multi_view": true,
     "aspect_ratio": "1:1",
     "prompt": "<subject>, single isolated miniature 3D prop, chunky toy-scale proportions, matte painted craft surface, muted palette matching <hexes>, even soft studio diffuse lighting, NO cast shadow, NO ground plane, clean solid neutral background, full object visible"
   }
   ```
   Poll `get_task` until status succeeds. Collect up to 4 returned view indices (`0..3`) in view order.
4. **Quote & immediate `v3.0 master` 3D submission:**
   - Call `quote_generation` once for the view set:
     ```json
     {
       "source_images": [
         { "task_id": "<image_task_id>", "image_index": 0 },
         { "task_id": "<image_task_id>", "image_index": 1 },
         { "task_id": "<image_task_id>", "image_index": 2 },
         { "task_id": "<image_task_id>", "image_index": 3 }
       ],
       "version": "v3.0",
       "model_type": "master",
       "generation_type": "model_with_texture",
       "pbr": true
     }
     ```
   - Verify balance >= quoted cost, then immediately call `create_generation` with `{ "quote_id": "<quote_id>", "confirmed": true }`. Never auto-retry a failed paid submission in a loop.
5. **Download & validate locally:** poll `get_task` until completed, call `get_task_outputs` to obtain the `.glb` URL and `model_page_url`, then persist it with the skill script (validates binary `glTF` header and updates `manifest.json`):
   ```bash
   python3 scripts/fetch_hi3d_asset.py \
     --url "<glb_download_url>" \
     --name "<slug>" \
     --project "<project_dir>" \
     --task-id "<3d_task_id>" \
     --image-task-id "<image_task_id>" \
     --page-url "<model_page_url>" \
     --height 2.4 \
     --mode relic-satin
   ```

> If the user supplies a local reference image instead of text, call `upload_input` to get a `file_token` and pass `file_tokens` to `quote_generation` -> `create_generation` (`version: "v3.0"`, `model_type: "master"`).

## 3. Resolving lighting & shadow conflicts (`paper-3d-assets.js`)

Raw PBR `.glb` assets clash with `papercraft` in five ways: grey/black shadows vs warm `PAPER_LIGHT.leak`, sharp Lambert/GGX terminators vs `wrap = 0.3`, black metals (because `scene.environment` is intentionally null so cards stay dead-matte), plastic specular glare clipping > 1 %, and ungrounded pivot origins.

`assets/lib/paper-3d-assets.js` (wired into `harness.js`) fixes all five automatically:

| Mode | When to use | How it harmonizes light |
|---|---|---|
| `'craft-matte'` *(default)* | Figurines, chests, stone statues, carved wood, architectural pieces | Converts materials to `paperMaterial` (`LAMBERT_PAPER`), lifts baked darks in the albedo texture, blends 8 % scene `stock` cream, and shares exact `PAPER_LIGHT.wrap`, `PAPER_LIGHT.leak` and PCSS soft shadows across all `MOODS` (`day`/`golden`/`dusk`/`night`). Zero specular sheen. |
| `'relic-satin'` | Sacred relics, gems, ocarinas, blades, golden crests | Injects `RE_Direct_PaperRelic` into `MeshStandardMaterial`: diffuse light uses exact `PAPER_LIGHT.wrap` + `PAPER_LIGHT.leak` shadow tint; specular is attenuated (`0.45 * gPaperShadow`, zero in shadow), roughness clamped to `[0.38, 0.75]`, paired with a soft procedural `PMREM` `envMap` bound **only** to that material (`scene.environment` remains null). |

## 4. Mounting in `scene.js`

Use `H.popupAsset` so 3D models obey crease-hinge choreography and deterministic capture:

```js
// Rises on a paper crease hinge with optional paper plinth, deterministic spin/bob, and WalkField collision
H.popupAsset('./assets/models/ocarina-of-time.glb', {
  x: 0, z: -8,
  height: 2.0,          // world units (hero = 3.6); auto-centered on XZ, bottom aligned to y = hover
  hover: 0.9,           // 0 = grounded for contact shadow + AO; >0 = floating relic
  plinth: { radius: 1.6, color: '#dfd5be' }, // optional flat cut-paper disc base on the hinge
  mode: 'relic-satin',  // 'craft-matte' | 'relic-satin'
  spin: 0.45,           // rad/s on the fixed harness clock (resets to 0 on restart())
  bob: 0.12,            // gentle vertical float amplitude on the fixed clock
  solid: 1.4,           // WalkField obstacle radius in world units
});
```

- **Static / deck placement:** `H.placeAsset(url, { x, y, z, parent: platformGroup.userData.deck, height, mode, solid })`.
- **Async capture handshake:** `harness.js` keeps `window.__papercraft.ready = false` until every `popupAsset` / `placeAsset` finishes loading and harmonizing, then calls `restart()` at `t = 0` and sets `ready = true`. `scripts/capture.py` waits on `ready`, prints `__papercraft.assets()` (loaded count, meshes, total triangles), and exits non-zero if any `.glb` failed to load.
- **Triangle budget:** keep total scene 3D asset triangles under ~500k (typical 1-5 assets sit at 30k-250k) so headless and browser rendering stay at 60 fps.
