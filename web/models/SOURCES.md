# Asset sources

All furniture models (`web/models/*.glb`) and floor/wall textures (`web/textures/*.jpg`) come from
[Poly Haven](https://polyhaven.com) and are [CC0](https://polyhaven.com/license) (public domain, no attribution required).
Downloaded 2026-10-27 and 2026-10-28 (the seven added in the second batch) at 1k resolution.

| File | Poly Haven asset | Used for |
|---|---|---|
| Chandelier_01.glb | [Chandelier 01](https://polyhaven.com/a/Chandelier_01) | foyer chandelier |
| ClassicConsole_01.glb | [Classic Console 01](https://polyhaven.com/a/ClassicConsole_01) | console by the door, study desk |
| mantel_clock_01.glb | [Mantel Clock 01](https://polyhaven.com/a/mantel_clock_01) | clock on the console |
| ornate_mirror_01.glb | [Ornate Mirror 01](https://polyhaven.com/a/ornate_mirror_01) | foyer mirror |
| fancy_picture_frame_01.glb | [Fancy Picture Frame 01](https://polyhaven.com/a/fancy_picture_frame_01) | portrait frames |
| dining_table.glb | [Dining Table](https://polyhaven.com/a/dining_table) | banquet table (two end to end; cloth recoloured in code) |
| dining_chair_02.glb | [Dining Chair 02](https://polyhaven.com/a/dining_chair_02) | dining chairs |
| GothicCabinet_01.glb | [Gothic Cabinet 01](https://polyhaven.com/a/GothicCabinet_01) | dining room cabinet |
| antique_ceramic_vase_01.glb | [Antique Ceramic Vase 01](https://polyhaven.com/a/antique_ceramic_vase_01) | vase on the mantel |
| Shelf_01.glb | [Shelf 01](https://polyhaven.com/a/Shelf_01) | study bookcases (tinted darker in code) |
| book_encyclopedia_set_01.glb | [Book Encyclopedia Set 01](https://polyhaven.com/a/book_encyclopedia_set_01) | books on the shelves |
| ArmChair_01.glb | [Arm Chair 01](https://polyhaven.com/a/ArmChair_01) | study armchair |
| WoodenTable_02.glb | [Wooden Table 02](https://polyhaven.com/a/WoodenTable_02) | little table by the armchair |
| ClassicNightstand_01.glb | [Classic Nightstand 01](https://polyhaven.com/a/ClassicNightstand_01) | gramophone stand |
| brass_candleholders.glb | [Brass Candleholders](https://polyhaven.com/a/brass_candleholders) | candleholders on the dining room mantel |
| brass_goblets.glb | [Brass Goblets](https://polyhaven.com/a/brass_goblets) | goblets set out on the banquet table |
| lantern_chandelier_01.glb | [Lantern Chandelier 01](https://polyhaven.com/a/lantern_chandelier_01) | lantern over the dining table |
| marble_bust_01.glb | [Marble Bust 01](https://polyhaven.com/a/marble_bust_01) | bust on the dining room cabinet |
| gothic_statue.glb | [Gothic Statue](https://polyhaven.com/a/gothic_statue) | statue in the study corner, lit from below |
| Rockingchair_01.glb | [Rockingchair 01](https://polyhaven.com/a/Rockingchair_01) | rocking chair in the study (rocks on its own) |
| hanging_picture_frame_02.glb | [Hanging Picture Frame 02](https://polyhaven.com/a/hanging_picture_frame_02) | seascape frame in the study |
| standing_picture_frame_02.glb | [Standing Picture Frame 02](https://polyhaven.com/a/standing_picture_frame_02) | the photograph's frame on the mantel (turned landscape, print mapped onto its artwork panel) |
| hanging_picture_frame_03.glb | [Hanging Picture Frame 03](https://polyhaven.com/a/hanging_picture_frame_03) | oval frames for the two foyer portraits |
| herringbone_parquet_*.jpg | [Herringbone Parquet](https://polyhaven.com/a/herringbone_parquet) | floors |
| decrepit_wallpaper_*.jpg | [Decrepit Wallpaper](https://polyhaven.com/a/decrepit_wallpaper) | walls |
| dark_paneled_wood_*.jpg | [Dark Paneled Wood](https://polyhaven.com/a/dark_paneled_wood) | wainscot |

Compression (`@gltf-transform/cli@4.5.1`):

```bash
npx @gltf-transform/cli@4.5.1 optimize <asset>_1k.gltf web/models/<asset>.glb --compress meshopt --texture-compress webp --texture-size 1024
```

Small props (clock, vase, books, frames, goblets, bust) use `--texture-size 512`; `dining_table` also uses `--join false --flatten false`
so its cloth stays a separate mesh. Textures were resized with macOS `sips` (diffuse 1024 px, normal and roughness 512 px, JPEG quality 72).

Shrunk again on 2026-10-28 for download size and GPU memory (8.7 MB -> 4.2 MB for all models): textures resized to
256 px for small props (goblets, clock, vase, books, frames) and 512 px for everything else, re-encoded as WebP at
quality 80, geometry re-compressed with meshopt; a file was replaced only if the result was smaller.

```bash
npx @gltf-transform/cli@4.5.1 resize <model>.glb r.glb --width 512 --height 512
npx @gltf-transform/cli@4.5.1 webp r.glb w.glb --quality 80
npx @gltf-transform/cli@4.5.1 meshopt w.glb <model>.glb
```
