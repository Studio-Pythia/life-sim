# Dreamland Visual Style Guide

## Core Aesthetic: Game Boy DMG-01 Pixel Art

All visual assets MUST follow these strict guidelines to ensure visual consistency.

---

## Color Palette (MANDATORY)

All sprites, backgrounds, and UI elements must use ONLY these 4 colors:

| Name     | Hex       | RGB           | Usage                    |
|----------|-----------|---------------|--------------------------|
| Darkest  | `#0f380f` | (15, 56, 15)  | Outlines, shadows, text  |
| Dark     | `#306230` | (48, 98, 48)  | Mid-shadows, details     |
| Light    | `#8bac0f` | (139, 172, 15)| Highlights, fills        |
| Lightest | `#9bbc0f` | (155, 188, 15)| Brightest areas, glows   |

**NO OTHER COLORS ARE PERMITTED** - not even for "accent" purposes.

---

## Pixel Art Specifications

### Resolution & Scale
- **Base resolution**: 160x144 pixels (original Game Boy)
- **Pixel size**: Visible, chunky square pixels
- **No anti-aliasing**: Hard pixel edges only
- **No gradients**: Use dithering patterns instead

### Dithering Patterns
Use checkerboard or line patterns for shading transitions:
```
Light to Dark transition:
████████  (100% light)
█░█░█░█░  (75% light / 25% dark - checkerboard)
░█░█░█░█  (50% - even checkerboard)
░░█░░█░░  (25% light / 75% dark)
░░░░░░░░  (100% dark)
```

### Outline Rules
- All objects have 1-pixel darkest (#0f380f) outline
- No broken outlines
- Interior details use dark (#306230)

---

## Character Sprites

### Style Requirements
- **Size**: 32x32 or 48x48 pixels
- **Perspective**: Front-facing, slightly chibi proportions
- **Head:body ratio**: Approximately 1:2 (larger heads)
- **Eyes**: Simple 2-3 pixel dots or small squares
- **Expressions**: Minimal, conveyed through body language

### Life Stage Sprites Needed
1. **Baby** (age 0-3): Bundled/simple form, diaper, reaching arms
2. **Child** (age 4-12): Small stature, simple clothing
3. **Teen** (age 13-17): Taller, casual clothing
4. **Young Adult** (age 18-35): Full height, varied clothing
5. **Middle Age** (age 36-60): Slight changes in posture
6. **Elder** (age 61+): Stooped posture, cane optional

### DO NOT
- Use smooth gradients
- Add glow effects to sprites
- Mix art styles (no anime eyes, no realistic shading)
- Use colors outside the 4-color palette

---

## Background Scenes

### Composition Rules
- **Depth**: 3 layers (foreground, midground, background)
- **Detail level**: High in center, simpler at edges
- **Lighting**: Consistent light source (usually top-left window)
- **Atmosphere**: Dithering for light rays, dust motes

### Required Scenes (12 total)
1. Nursery - Crib, mobile, rocking chair, moonlit window
2. Kitchen - Counter, stove, table, family warmth
3. Classroom - Desks, chalkboard, educational posters
4. Bedroom - Teen room, posters, desk, personal items
5. Dorm - Bunk bed, cramped, college life
6. Office - Cubicle, computer, professional
7. Nice Home - Mansion living room, luxury
8. Rundown - Shabby apartment, poverty indicators
9. Prison - Cell, bars, institutional
10. Hospital - Medical bed, equipment
11. Bar - Counter, bottles, social atmosphere
12. Park - Nature, benches, peaceful outdoor

---

## UI Elements

### Panels & Boxes
- 2-pixel border using darkest color
- Inner fill using lightest color
- Optional: 1-pixel inner shadow using dark color

### Buttons
- Raised appearance (light top-left, dark bottom-right)
- Pressed state: Inverted shading
- Hover: Slight glow using lightest color

### Text
- Font: "Press Start 2P" (pixel font)
- Sizes: 8px (small), 12px (body), 16px (headers), 24px (titles)
- Color: Darkest (#0f380f) on light backgrounds
- Color: Lightest (#9bbc0f) on dark backgrounds

---

## Animation Guidelines

### Frame Rates
- Idle animations: 2-4 frames, 500ms per frame
- Actions: 4-8 frames, 100-200ms per frame
- Transitions: Pixel dissolve or slide

### Movement
- No tweening/easing
- Step-based movement (pixel by pixel)
- Screen shake: 2-4 pixel displacement

---

## Image Generation Prompts

When generating new assets, use this template:

```
Game Boy DMG-01 style pixel art of [SUBJECT], 
STRICT 4-COLOR GREEN MONOCHROME PALETTE ONLY: 
#0f380f (darkest), #306230 (dark), #8bac0f (light), #9bbc0f (lightest). 
NO other colors allowed. 
[SPECIFIC DETAILS]. 
160x144 pixel aesthetic with visible chunky pixels, 
dithering patterns for shading, 
clean pixel-perfect edges, 
1-pixel darkest outlines on all objects.
```

---

## Quality Checklist

Before committing any visual asset, verify:

- [ ] Uses ONLY the 4 Game Boy green colors
- [ ] Has visible pixel grid (no anti-aliasing)
- [ ] Uses dithering instead of gradients
- [ ] Has proper 1-pixel outlines
- [ ] Matches the style of existing assets
- [ ] Works at both 1x and scaled sizes
- [ ] Readable/recognizable at small sizes

---

## Examples of WRONG vs RIGHT

### WRONG
- Smooth gradients between colors
- Anti-aliased edges
- Colors outside the palette (even subtle)
- Realistic proportions on characters
- Modern UI effects (drop shadows, blur)

### RIGHT
- Dithered shading transitions
- Hard pixel edges
- Strict 4-color adherence
- Chibi/stylized proportions
- Pixel-perfect borders and panels
