# AI Asset Generation Guide

This project requires AI-generated fruit assets with a consistent overall style.

Do not use downloaded icon packs, stock images, copied Suika artwork, or mixed-style placeholder graphics for the final fruit pieces.

## Required Fruit Set

Generate exactly these 11 fruit pieces:

1. Cherry
2. Strawberry
3. Grape cluster
4. Orange
5. Apple
6. Pear
7. Peach
8. Pineapple
9. Cantaloupe
10. Coconut
11. Watermelon

The Chinese display names and gameplay order are defined in `SPEC.md`.

## Required Style

All fruit must look like one cohesive asset pack:

- Cute polished 3D clay-rendered or toy-like mobile game icons.
- Rounded, soft, readable silhouettes.
- Bright but controlled colors.
- Same lighting direction and intensity.
- Same camera angle, preferably front-facing or slightly top-down.
- No faces, characters, text, labels, numbers, watermarks, or decorative backgrounds.
- Transparent PNG final output for each fruit.

## Preferred Workflow

1. Use the `imagegen` skill.
2. Generate one cohesive sprite sheet containing all 11 fruit.
3. Use a flat chroma-key background so the sheet can be converted into transparent assets.
4. Inspect the sprite sheet for count, style consistency, clarity, and missing fruit.
5. Cut the sheet into 11 separate transparent PNG files under `assets/fruits/`.
6. If the sheet is inconsistent, regenerate rather than mixing in unrelated assets.

## Prompt

Use this prompt as the baseline. Adjust only when fixing a specific issue.

```text
Use case: stylized-concept
Asset type: game sprite sheet for a static browser puzzle game
Primary request: Generate one cohesive sprite sheet containing exactly 11 separate fruit game pieces for a Suika-style merging game: cherry, strawberry, grape cluster, orange, apple, pear, peach, pineapple, cantaloupe, coconut, watermelon.
Style/medium: consistent cute polished 3D clay-rendered fruit icons, rounded forms, soft studio lighting, friendly casual mobile game style.
Composition/framing: a clean 4-column by 3-row grid, one fruit centered in each cell, generous padding around every fruit, no overlapping, no labels, no numbers, no text.
Background: perfectly flat solid #00ffff chroma-key background across the entire image, no shadows, gradients, texture, floor plane, reflections, or lighting variation on the background.
Constraints: exactly 11 fruits, all in the same visual style, front-facing or slightly top-down, crisp readable silhouettes, no characters, no faces, no watermark, no text. Do not use #00ffff anywhere inside the fruits.
```

## Acceptance Checklist

- Exactly 11 fruit are present.
- Every fruit is recognizable at small gameplay size.
- All fruit share the same visual style, lighting, material, and camera angle.
- Transparent PNG output has clean edges and no chroma-key fringe.
- No fruit is cropped, overlapped, labeled, or watermarked.
- Final files are saved inside `assets/fruits/`.

## PWA Icons

The PWA app icons must also stay within the same asset policy:

- Use accepted project AI artwork as the source, or generate a new icon with the same visual style.
- Do not use downloaded icon packs, stock images, or copied Suika artwork.
- Save final icons under `assets/icons/`.
- Required outputs are `icon-192.png`, `icon-512.png`, `maskable-512.png`, and `apple-touch-icon.png`.
- The maskable icon needs enough safe padding so the fruit is not cropped by launcher shapes.

## Known Generated Preview

A generated preview sprite sheet exists outside the project in Codex's generated image area from an earlier exploration pass. Treat it as preview material only until it has been inspected, copied into the workspace, cleaned, and accepted.
