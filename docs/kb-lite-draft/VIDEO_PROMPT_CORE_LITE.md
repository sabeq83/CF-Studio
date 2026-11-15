---
title: VIDEO_PROMPT_CORE_LITE
scope: Storyboard → video prompt writing (T2V / I2V / T2I start frame) for pillar/OPC legacy path, RE campaign, Deconstruct, Bridge Inject
replaces: PROMPT_SYSTEM_v47.9.md sections I, II, III.B, IV, V, VIII, 9.9, 9.16, 12.0 and Mandates 3–4, 6, 8, 11, 15–18, 21–25, 28, 38–39, 41–44, 46–50, 60, 62, 64, 69, 75, 81, 88
source size: 140 KB → this module ±7 KB
status: DRAFT USULAN — belum dipakai oleh kode
---

# VIDEO PROMPT CORE — LITE

> Code-level rules in the prompt (presence truth, metaphor policy, bridging, Visual Identity, words-per-clip,
> audio segment mode, multi-character dialog) ALWAYS override this file.

## 1. Principles
1. **Final pixel.** Look, light, grain, and mood are written into the prompt. Nothing is "fixed in post".
2. **Physical evidence, not adjectives.** Write "condensation drops on amber glass", not "fresh".
3. **One style per video.** Visual style, light, and color stay consistent across all clips.
4. **Realism by default.** Photorealistic, physics-based motion. Exception: when the campaign style is Metaphor
   (object analogies are allowed and expected) or the content world is cartoon/3D (follow the universe KB).

## 2. Prompt Layout (plain-text, ready to run)
Prefix by aspect ratio:
| Ratio | Prefix / suffix |
|---|---|
| 9:16 | `(VERTICAL 9:16) --ar 9:16 --no landscape` |
| 16:9 | `(CINEMATIC 16:9) --ar 16:9 --no portrait` |
| 1:1 | `(SQUARE 1:1) --ar 1:1` |
| 4:5 | `(PORTRAIT 4:5) --ar 4:5` |

**T2V (no start image)**
```
[LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: <product shape, closure, material, label direction>), (Subject Anchor: <character lock if any>).
[LAYER 1: SCENE & OPTICS] (Location: <scene lock, verbatim every clip>), (Lens: <camera + lens>), (Camera Move: <move>).
[LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: ...), (Audio Segment: "...") ... last segment + [TRANSITION LOCK].
[LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "<VO>" VOICE: <voice signature + emotion> SFX/MUSIC: <sfx>
NEGATIVE PROMPT: <short list, see §8>
```
**I2V (start frame exists)** — same, but Layer 1 becomes:
`[LAYER 1: INPUT & TRUTH LOCK] (Start Frame: <filename>), (Consistency: MAX), (Geometric Truth: ...)`
and no camera hardware is described (the image is the camera).

Layer 3 is omitted or reduced when the campaign SFX/audio settings say so.

## 3. Micro-Pacing (Mandate 49 / 21 / 69)
- Split each clip into time segments that add up to the clip duration. Never one block `[00:00-00:08]`.
- Segment length follows clip count: 1–2 clips → new action every ~1.5 s; 3–5 clips → every 2–3 s; 6+ clips → up to 4 s.
- Each segment: one visual action + the exact words spoken in that window.
- Word count per clip follows the campaign `words_per_clip` setting (code). Do not invent your own limit.

## 4. Motion Writing
- **Fluid syntax (M18):** link actions with "while", "as", "in one continuous motion". No chopped sentences ("She sits. She looks.").
- **Safe dynamics (M46):** always some motion; natural micro-kinetics (light sliding on glass, honey folding slowly).
  If object motion risks morphing, move the camera instead (slow push-in, parallax slide, orbit, rack focus).
- **Hand micro-kinetics (9.9):** grip tightens/relaxes, wrist rotates ~15° to catch light, subtle organic tremor.
- **Anatomy (M43):** animate only limbs visible in the start image. No extra hands, arms, or fingers.
- **I2V containment (M62/M75):** I2V describes movement of what is already in the image. Never spawn new objects.
- **Sequence (M8/M60):** T2I start frame first, then I2V animates it.

## 5. Continuity
- **Scene lock (M33):** one location/light description, pasted verbatim into every clip of the same scene.
- **Characters (M22/M29):** define every character once at the top (3 anchors: structure, one imperfection, material/wardrobe) and reuse the same words.
- **Transition lock (M44):** the last segment states the camera end state; the next clip starts from that state.
  Examples: zoom into texture → next clip opens on the same macro texture; blur to gold → next opens from gold.
- **Clip 1 pattern interrupt (M38):** the first 0–2 s has a clear visual change (fast push-in, extreme close-up, sudden state change).

## 6. Product Truth (Mandate 50 / 17 / 42 / 64 / 81 / 88)
When a product reference image exists:
- Start Layer 0 with: `(ANCHOR: <filename>), (GEOMETRY LOCK: <exact shape + closure type>), (MATERIAL LOCK: <finish>), (ORIENTATION: <label direction>)`.
- Use the filename in the subject: `High fidelity render of source file '<filename>'`. Do not alter geometry or label text.
- Never generic nouns ("bottle", "cap"). Say "tall amber glass jar with gold screw cap", etc. Use the known color.
- Add anti-default negatives for the category (e.g., tube → no jar, pot, pump bottle).
- Keep real scale: place next to a familiar object (glass, spoon, hand grip) when size matters.
- State of matter: solid products never pour or splash; liquids may drip/pour (see METAPHOR_PHYSICS_LIBRARY_LITE).

## 7. People, Modesty & Faceless (Mandate 51 / 67 / 73 / 41 / 48)
- Faceless framing and presence rules come from code (presence truth tuple, wardrobe rotation, metaphor policy). Follow them exactly.
- Audience Indonesia/Malaysia or Muslim: covered hair and neck, long sleeves to the wrist, loose opaque clothing; describe wardrobe with concrete garment words (high-neck tunic, wrist cuff), not "modest".
- Product-only or object-only clips: no humans at all. Never use the words "headless" or "decapitated".
- When only part of a person is shown, forbid faces in the negative list.

## 8. Negative Prompt (short, replaces Section III.B / Mandate 79)
Base (always): `text, subtitles, captions, watermark, typography, morphing logo, distorted label, extra fingers, extra limbs, floating objects, ghosting`.
Add when relevant:
- Realistic style: `cartoon, anime, 3d render, cgi, illustration, plastic skin`.
- Faceless / object-only: `human face, eyes, mouth, reflection of face`.
- Product truth: category anti-defaults (§6).
- Speaking clips: `sipping, drinking, cup covering mouth`.
Keep it under ~40 words. Do not paste long block lists.

## 9. Product "Money Shot" Ideas (from 12.0, short)
Viscous pour with folding layers · single slow drip from the rim · condensation bead rolling down glass ·
steam wisps rising · light glint on the edge · backlit silhouette turning to reveal the label · caustic light pattern through glass.

## 10. Output Hygiene
- No square-bracket codes in the final prompt text (no `[MATRIX 9.10]`, `[MANDATE 53]`). Write the actual words.
- No double quotes inside spoken lines; use single quotes.
- Follow the JSON schema given by the calling prompt. This file does not define output JSON.
