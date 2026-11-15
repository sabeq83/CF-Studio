---
title: MANDATE_GLOSSARY_LITE
scope: Loaded wherever prompt templates in code still mention "Mandate NN" (lib/prompts.js, lib/scheduler-processors.js). Gives each referenced number a short meaning.
replaces: the need to load the full PROMPT_SYSTEM_v47.9.md just to explain mandate labels
source: rules referenced in code as of b67beec (15 Nov 2026)
status: DRAFT USULAN — belum dipakai oleh kode
---

# MANDATE GLOSSARY — LITE

When a prompt mentions a mandate number, it means the rule below. Write the actual words in the output, never the code label.

| Mandate | Meaning |
|---|---|
| 11 | Aspect-ratio prefix/suffix, e.g., `(VERTICAL 9:16) --ar 9:16 --no landscape`. |
| 29 | Character lock: describe the character with the same 3 anchors every clip (structure, one imperfection, wardrobe/material). |
| 33 | Scene lock: one location + light description, repeated word-for-word in every clip of the scene. |
| 44 | Transition lock: the clip's last camera state must match the next clip's first state. |
| 49 | Micro-pacing: split the clip into time segments, each with one visual action and the exact spoken words: `([00:00-00:02]): (Visual Action: ...), (Audio Segment: "...")`. |
| 50 | Product visual truth: describe exact shape, closure type, material, and label direction; forbid the category's generic default shape. |
| 51 | Modesty: for Indonesian/Muslim audiences, covered hair and neck, long sleeves to the wrist, loose opaque clothing, described with concrete garment words. |
| 67 | Faceless framing: the face is never shown. Framing follows the code instruction (e.g., elbow-down hands/arms only). Never write "headless". |
| 71 | Voice pacing: words per clip follow the campaign setting; TTS speed between 1.0 and 1.2. |
| 73 | Object mode: if the clip is object/metaphor only, no humans at all. |
| 74 | (Legacy) full JSON audio blocks. **Overridden by code** — do not expand long JSON audio objects. |
| 79 | (Legacy) long negative block lists. **Overridden by code** — use the short negative list. |
| 81 | Pixel lock: when a reference image exists, keep its geometry and label text exactly; no smoothing or reshaping. |
| 86 | Selection gate: user's explicit choice first, then emotion, then niche default — for voice persona and camera choice. |
| 87 | State of matter: solids never pour or splash; liquids may pour or drip; unknown → keep static. |
| 88 | Filename injection: write `High fidelity render of source file '<filename>'` in the subject when a product image exists. |
| 90 | (Legacy pipeline only) one complete prompt block per clip, no "repeat for clip 3" shortcuts. |
| 92–97 | Defined directly in code (audio segment mode, mascot voice, multi-character dialog, mascot universe). Follow the code text. |

Short negative list (replaces Mandate 79 blocks):
`text, subtitles, captions, watermark, typography, morphing logo, distorted label, extra fingers, extra limbs, floating objects, ghosting`
+ `cartoon, anime, 3d render, cgi, plastic skin` for realistic styles
+ `human face, eyes, mouth` for faceless/object clips.
