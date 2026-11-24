---
name: hi3d-papercraft
description: 构建手工立体书纸艺（Pop-up Papercraft）风格的交互场景、网页、动画与多画幅视频：以 Three.js 折纸结构、移轴微距镜头和彩色软阴影为主体，支持调用 hi3d MCP（v3.0 master）直出点睛 3D GLB 资产并统一纸艺光影。当制作立体书、纸模微缩世界或混合点睛 3D 资产场景时使用；不用于真实裁剪折纸图纸或普通文档排版。
license: MIT
compatibility: Templates and kit run in modern browsers (three.js r187 via CDN). Scripts require Python 3 (numpy + Pillow for measure.py; Playwright for capture.py). hi3d MCP server enables automated 3D GLB generation.
metadata:
  author: SucRunBug
  version: "0.7.0"
---

# Hi3D Papercraft

Builds handcrafted pop-up diorama worlds seen from inside: fibrous printed cardstock pieces with thin cut edges fold up on hinges from a printed ground, cast world-tinted soft shadows under a tilt-shift macro lens, and blend **85-90 % procedural `Three.js` papercraft** with **1-5 focal 3D `.glb` accent assets** generated via the `hi3d` MCP (`v3.0` `master`) and harmonized into the exact same paper lighting.

All files in `assets/` (`lib/`, `templates/popup-3d/`, `templates/popup-2d/`, `examples/`, `gallery/`, `lights.json`) are plumbing and worked countryside examples—write your own subject's pieces and prints, keep the harness.

## 1. Material & hybrid laws

Details and full starting tables live in [look.md](references/look.md) and [hi3d-mcp.md](references/hi3d-mcp.md).

1. **Flat sheets with real thickness for the world (~85-90 %).** Card thickness `1.5-3 %` of hero height (`0.08` units for a `3.6` hero; `0` reads as a sticker, thick as foam board). Build from extendable structure types ([structures.md](references/structures.md)): single card, layered cards, slotted crosses (`full` +, `half` T, `quarter` L, `angle > 90` V-fold), folded boxes/prisms (`boxFold`), open built ground (`platform`), and printed page. Upright round things walked around (trees, palms, posts, tents) are 90-deg slotted crosses; low dressing (grass, bushes, rocks) are single/layered cards facing the camera.
2. **Dead matte world, zero global `scene.environment`.** Diffuse wrap light (`wrap ~0.3`), `< ~1 %` clipped pixels (only tiny lit window panes may clip). Never set a global `scene.environment` or raw GGX sheen—grazing gloss reads as plastic.
3. **One warm low key, world-coloured PCSS shadows.** Key `45-65 deg` off camera axis, `45-55 deg` up (`20-35 deg` at golden/dusk) and slightly toward the viewer; frontal fill `~1/4-1/3` of key. Shadows sharpen at contact and widen with gap (`penumbra ~0.2-0.3 x gap`). Shadow hue (`PAPER_LIGHT.leak`) takes the world's colour: warm amber by day, lilac-blue on snow, deep teal under water, navy at night—never grey/black, never a colour fog over the frame. Verify with `?diag=key` ([look.md](references/look.md) §8b).
4. **Every print is a layered paper collage.** Inside chunky convex silhouettes: `3-5` inks in `3+` value steps + `1` ornament on quiet fibre (never felt/weave). Lay structure first, then bold contrasting motifs (leaves `~1/7` crown width, `15-25` countable per tree; no line `< ~2-3 %` of piece). Each layer drops a short warm shadow and a thin pale lit-side lip (`P.layer`, `P.parts`, `drawnPiece`, `P.marks`, `P.rim`: [procedural-art.md](references/procedural-art.md)).
5. **The cut edge.** Thin dark-brown silhouette line (`~1.5-2.5 px`) + pale highlight inside lit edges only. Never an all-round white sticker halo, never glowing/torn, and **no cut edge along folds or hinge bases**. No card seen edge-on as a knife sliver (`autoYaw` turns single cards `+-14 deg`, crosses `~24 deg` off view).
6. **Tilt-shift macro lens looking down.** `24-32 deg` vertical FOV, `40-55 deg` pitch down; printed ground extends past all four frame edges (no sky, horizon, backdrop, table or book edge unless literally a UI page). One sharp band (`~36-45 %` of frame, `focusHeight ~0.55-0.75`), blur reaching `12-18 px` @1080p from both depth and screen height, with big blurred cards overlapping the bottom edge. Short-side lens scaling handles `9:16`, square, `4K` ([formats.md](references/formats.md)).
7. **Subject-derived paper palette.** Derive `4-7` hexes from the brief/mood ([palettes.md](references/palettes.md) §3)—never copy example or gallery hexes. Ground sits `~0.16-0.22` brighter and `~0.16-0.25` less saturated than pieces (inverted only when the brief names black sand/slate/night water). Give every piece `1-2` contrasting accents, muted paper greens (`greenDesat`), cream whites, dark inks; author grounds/water a step bluer/greyer to offset the warm ACES grade (`measure.py --palette`).
8. **Dense, chunky, readable.** `100-250` pieces of `~20` kinds (`~270-320` standing cards via `__papercraft.cards()`) in tight clusters of `4-8` different pieces, `<= ~3` identical twins in view (`> 3` widths apart), `barePct <= ~55` in the sharp band. Keep natural ground flat; build height with `3-5` nested curved hill sails stepped `~10-15 %` in value ([mechanisms.md](references/mechanisms.md) §8). Hero is `3.6` units (`~3.2` in 2D), `6-10 %` of `16:9` height: a multi-card 3D paper puppet (`~10-20` cards, no self-clipping: `__papercraft.clips()`) or a harmonized figurine that yaws smoothly to walk direction.
9. **Walkable structures are open 3D constructions.** Decks on posts, ramps, thin treads on stepped stringers (rise `<= ~1/8` hero), entered buildings as `boxFold` with cut doorways; wire `WalkField` so feet stand on surfaces and walls/rails/water block ([mechanisms.md](references/mechanisms.md) §14).
10. **Crease-hinge motion only.** Rise fast with `8-15 %` overshoot and `2-3` quiver cycles, settled by `~1 s`; fall with `< 3 %` slap; stagger parts `0.05-0.1 s` in flat-stack order (3D folds back: nearest rises first; 2D folds forward: farthest first). Never scale-pop, stretch or fade in ([motion.md](references/motion.md)).
11. **Sparse paper sound.** Soft band-limited noise flaps (`>= ~0.5 s` apart) and footsteps quieter than music ([sound.md](references/sound.md)).
12. **Living world.** `3-5` subtle environmental behaviours from `lib/paper-life.js` (leaves/snow/petals/rain/dust, birds/butterflies/fireflies, chimney smoke, cloud shadows, grazing/scattering critters).
13. **Harmonized 3D `.glb` focal accents (10-15 % garnish, mandatory when 3D assets apply).** Keep 3D meshes as the cherry on top (`1-5` key items: relics, statues, chests, landmarks, or hero figurine), never a full-mesh replacement. Always mount via `H.popupAsset` or `H.placeAsset` (`lib/paper-3d-assets.js`): `'craft-matte'` (default dead-matte paper-clay) or `'relic-satin'` (controlled micro-sheen with local-only `PMREM` `envMap`), both sharing `PAPER_LIGHT.wrap`, `PAPER_LIGHT.leak` coloured shadows, centimetre bounding-box grounding, and hinge choreography ([hi3d-mcp.md](references/hi3d-mcp.md)).

## 2. References, `hi3d` MCP direct pipeline & optional 2D image gen

- **User references** ([gallery.md](references/gallery.md) §1, [process.md](references/process.md) §2):
  - *Already papercraft* (video frames, paper diorama photos): adopt its craft, framing, transitions and density (`measure.py --target`, `ab_sheet.py`), discarding photo accidents (table edge, glare).
  - *Concept / IP art* (games like *Ocarina of Time*, films, sketches, moodboards): translate environments into paper structures + layered prints, and select `1-5` iconic centerpiece objects for 3D `.glb` accents. Never copy third-party raw images into shipped assets.
- **Automated `hi3d` MCP 3D generation (no two-step confirmation):** when building a 3D scene that needs focal `.glb` assets and local files are not already provided, call `hi3d` directly end-to-end ([hi3d-mcp.md](references/hi3d-mcp.md) §2):
  1. Check `<project>/assets/models/manifest.json` and `list_tasks` to reuse existing models; check points with `get_balance` (stop and report if insufficient).
  2. Generate clean multi-view turnarounds via `create_image_generation` (`operation: "text_to_image"`, `model_name: "Nano-Banana-Pro"`, `multi_view: true`, `aspect_ratio: "1:1"`, isolated chunky prop, no cast shadow, solid neutral background); poll `get_task`.
  3. Call `quote_generation` (`source_images` indices `0..3`, **`version: "v3.0"`, `model_type: "master"`, `generation_type: "model_with_texture"`, `pbr: true`**) and **immediately** submit `create_generation` (`quote_id`, `confirmed: true`) without pausing for user confirmation.
  4. Poll `get_task`, fetch URLs via `get_task_outputs`, and run `python3 scripts/fetch_hi3d_asset.py` to validate the binary `glTF` header and save `<project>/assets/models/<slug>.glb`.
- **2D concept image generation (only when explicitly requested for 2D/look targets):** stay procedural otherwise; see [image-gen.md](references/image-gen.md).

## 3. Before code: write the hybrid paper spec

Write this spec with concrete numbers before authoring `scene.js` and audit that nothing is generic:

```text
BRIEF      place, era/IP motifs, season, weather, time, scale, mood; each reference & what it supplies
SUBJECT    world twist, primary focal point, camera progression (single diorama or multi-zone scroll)
STOCK      paper stock & fibre strength (cream #f7f0e2 warm worlds; cool #eef1f6 snow/ice/stone)
PALETTE    4-7 derived hexes: ground light/dark, lead family, 2 contrasting accents, ink, shadow leak, haze
LIGHT      key hex + azimuth/elevation, fill ratio, leak tint, practical lamps / glowing panes, moods
LENS       fov (24-32), pitch (40-55), sharp band %, max blur px@1080, foreground bottom-edge overlaps
FORMAT     deliverables (1920x1080, 1080x1920 reel, 4K...), fps, duration, safe areas (formats.md)
GROUND     floor material & printed features (torn washes, stone pavers, rivers, triforce crests, paths)
LAYOUT     curved leading line (bends 2x), landmarks, hero start, 4-8 piece clusters, 15-25 piece kinds
HERO_3D    1-5 focal .glb accents: slug, hi3d/local source, target height (cm), mode (craft-matte|relic-satin), hinge/plinth
MOTION     hinge rise/fall stagger, custom mechanisms, camera route/zones, subtle sway
LIFE       3-5 paper-life behaviours matching the biome and time of day
TYPES      paper structure type per piece kind (cross, stack, boxFold, platform, dome...)
SOUND      none | flaps + steps (+ music)
BANNED     fake-paper & raw-PBR tells (look.md §12) + brief-specific exclusions
QA         deterministic shots/clips to capture and verify
```

## 4. Build paths & progressive reference index

Read only the files needed for the current task:

- **3D papercraft + `.glb` accent scene / game / video (primary):** copy `assets/lib/` + `assets/templates/popup-3d/harness.js` + `index.html`, author `scene.js`; read [hi3d-mcp.md](references/hi3d-mcp.md), [three-js.md](references/three-js.md) §1, §3, §8, §11, [structures.md](references/structures.md) §0-4, [procedural-art.md](references/procedural-art.md) §3, [look.md](references/look.md) §8b, §11-12, [palettes.md](references/palettes.md) §3, and for walking [mechanisms.md](references/mechanisms.md) §12, §14.
- **Pure 2D Canvas/SVG/CSS scene or UI:** `assets/templates/popup-2d/`; read [web-2d.md](references/web-2d.md) and [paper-ui.md](references/paper-ui.md).
- **Video & vertical formats (`9:16`, `4K`):** [motion.md](references/motion.md) §11 and [formats.md](references/formats.md).
- **External game engines:** [engines.md](references/engines.md) and `scripts/paper_textures.py`.

| Topic | Reference | Kit / Script |
|---|---|---|
| `hi3d` `v3.0 master` pipeline & `.glb` shader harmonization | [hi3d-mcp.md](references/hi3d-mcp.md) | `H.popupAsset`, `H.placeAsset`, `scripts/fetch_hi3d_asset.py` |
| Layered collage prints & procedural motifs | [procedural-art.md](references/procedural-art.md) | `printCard`, `P.layer`, `P.parts`, `drawnPiece`, `P.marks`, `P.rim` |
| Choosing & extending paper structures | [structures.md](references/structures.md), [mechanisms.md](references/mechanisms.md) | `crossCard`, `layeredCard`, `fanCard`, `boxFold`, `platform`, `H.stack`, `H.dome` |
| Springs, flat-stack choreography, camera & life | [motion.md](references/motion.md), [worlds.md](references/worlds.md) | `FlapSpring`, `windSway`, `WalkField`, `lib/paper-life.js` |
| Quality bar, 5 shipped worlds, critiques & metrics | [gallery.md](references/gallery.md), [process.md](references/process.md) | `scripts/capture.py`, `scripts/measure.py`, `scripts/ab_sheet.py` |
| Palettes, lighting presets & procedural foley | [palettes.md](references/palettes.md), [sound.md](references/sound.md) | `assets/lights.json`, `lib/paper-sound.js` |

## 5. Execution workflow

1. **Spec & asset plan:** inspect all user references, write the hybrid spec (§3), keep ~85-90 % in `Three.js` paper constructions and pick `1-5` focal 3D `.glb` accents.
2. **Generate & persist `.glb` accents:** run the `hi3d` MCP pipeline (§2) and save validated `.glb` files via `scripts/fetch_hi3d_asset.py` into `<project>/assets/models/`.
3. **Prove look on `?test` first:** place one test card + one harmonized `.glb` accent on the printed ground under final light and lens (`H.flags.TEST`). Verify matte surface, matching `PAPER_LIGHT.leak` shadow colour between card and `.glb`, crisp cut edge on card, grounded contact shadow, and sharp band.
4. **Build walkable ground, then landmarks & focal `.glb`s, then dense clusters:** wire `WalkField` decks/stairs/blockers first, place landmarks + `H.popupAsset` centerpieces along the twice-bent leading line, then pack the sharp band with `4-8` piece clusters (`4-6` seeded variants per kind).
5. **Choreograph & add life/sound:** verify flat-stack rise/fall order, deterministic `H.onStep` motion (`spin`/`bob`/mixers), `paper-life.js` ambient behaviours, and sparse `PaperSound`.
6. **Deterministic capture & measurement:** seed all randomness (`P2.rng`). Run `python3 scripts/capture.py <project> overview midrise key walk=...` (waits for `window.__papercraft.ready` after all `.glb`s settle) and `python3 scripts/measure.py frames/overview.png` ([process.md](references/process.md) §6). Fix top issues (up to 3 rounds), then report verified frames and metrics honestly.

## 6. Render & integration checklist

- [ ] Ground fills past all 4 edges at `40-55 deg` pitch; every target aspect (`16:9`, `9:16` `?safe=all`, `4K`) framed cleanly.
- [ ] Packed sharp band (`barePct <= ~55`, `focusHeight ~0.55-0.75`), `4-8` mixed-kind clusters, `<= ~3` identical props in view, twice-bent leading line, blurred foreground cards at bottom edge.
- [ ] Upright round pieces are slotted crosses (`~24 deg` off view); low pieces face camera (`+-14 deg`); `4-6` seeded variants per kind.
- [ ] Every card print is a `3+` value layered collage with lit-side lip, short warm drop shadow, contrasting accent, dark cut line + lit-side highlight, and zero edge on folds.
- [ ] Focal `.glb` assets (`1-5`) are mounted via `H.popupAsset` / `H.placeAsset`: `__papercraft.assets()` reports `0` errors, reasonable triangle count (`< 500k`), grounded contact shadows (or intentional `hover` over a plinth), zero black metals/plastic clipping (`< ~1 %` clipped pixels), and shadows matching the exact world `leak` tint across `day`/`dusk`/`night`.
- [ ] Hero reads from all sides, walks smoothly on open 3D decks/stairs, blocked by rails/walls/water, with `0` card intersections (`__papercraft.clips()`).
- [ ] Motion is crease rotation with one springy overshoot (`~1 s` settle) + `3-5` calm `paper-life` behaviours; zero console/page errors.

## 7. Gotchas

- **Clock & async `.glb` readiness:** clamp live `dt` to `[0, 0.05]` s; never read captures before `window.__papercraft.ready` is `true` (`harness.js` flips `ready` only after all `popupAsset`/`placeAsset` promises resolve and `restart()` resets `t = 0`).
- **Build & print budget:** reuse prints with `H.printed(pts, paint)` across repeated trees/props and lower `res` (`0.6-0.75`) outside close-ups ([three-js.md](references/three-js.md) §9).
- **Calmness wins:** when metrics push toward noisy textures, excessive bobbing, or too many 3D meshes, subtract—keep the craft crisp, matte, and quiet.
