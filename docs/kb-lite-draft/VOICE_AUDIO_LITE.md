---
title: VOICE_AUDIO_LITE
scope: Voice-over, dialog, TTS persona, SFX/music — storyboard, RE campaign, Deconstruct, Multiplier, Narration agent
replaces: PROMPT_SYSTEM_v47.9.md Mandates 5, 9–10, 12, 13–14, 26, 32, 34–36, 40, 45, 61, 65–66, 71, 76, 78, 84, 86 (voice router), Section X, XII, XII.B
          + REALIST_VIRAL_NARRATIVE_v47.9.md Section IX (duplicate voice matrix)
source size: ±25 KB (two files) → this module ±5 KB
status: DRAFT USULAN — belum dipakai oleh kode
---

# VOICE & AUDIO — LITE

> Code settings win: `words_per_clip`, voice cast lock (Mandate 94), audio segment mode (Mandate 92),
> mascot voice (Mandate 93), SFX on/off, TTS provider. This file only guides choices the code leaves open.

## 1. Spoken-Word Rules
- Audio is **spoken word / narration**, never singing or jingle (M61). Add to audio negatives: `singing, music vocals, jingle, rap`.
- Write the language explicitly (e.g., "Indonesian, Jakarta neutral accent") to avoid English bias (M5/M9/M12).
- Describe voices with descriptors (gender, age, tone, pace, emotion), never tool or vendor names (M14/M26).
- **Global voice signature (M40/M45):** define one signature line per video and repeat it verbatim in every clip, then add the clip emotion.
  Example: `VOICE: Indonesian female, 30s, warm calm narrator. Emotion: concerned.`
- **Voice must match the visual (rule B):** child on screen → child voice; adult → adult; animals do not lip-sync (except cartoon). Off-screen narrator → lip sync OFF.
- **Lip-sync safety (M25):** a speaking character never drinks or covers the mouth.

## 2. Dialog (when characters speak)
- Prefer one speaking character per clip; in close-ups remove the non-speaker from the description (M34/M35).
  Exception: multi-character dialog mode from code (Mandate 94) — follow its rules.
- Link voice with body language (M36): `Dialogue(Name (Vocal: hushed, Physical: gripping the cup, Facial: eyes lowered): "line")`.
- Add audio negatives for dialog: `robotic voice, wrong gender, narrator voice`.

## 3. Persona Router (Gemini TTS voices, M86)
Priority: 1) user's explicit choice (gender, tone) → 2) emotion of the script → 3) niche default below.
| Voice | Gender | Character | Typical use |
|---|---|---|---|
| Aoede | F | cheerful, mainstream | lifestyle, daily review |
| Leda | F | soft, motherly | parenting, family, gentle education |
| Despina | F | energetic, fast | promo, flash sale |
| Callirrhoe | F | professional, clear | news style, science/health explanation |
| Autonoe | F | warm storyteller | documentary, soft sell |
| Erinome | F | calm, ASMR-like | spa, skincare, meditation |
| Laomedeia | F | firm, dominant | warnings, strong motivation |
| Achernar | F | elegant, luxury | premium, fashion, hotel |
| Charon | M | deep, heavy | trailer, mystery, masculine products |
| Puck | M | young, Gen Z | gadget, gaming |
| Fenrir | M | mature, authoritative | men's health, finance, family head |
| Orus | M | relaxed, friendly | podcast, travel, café |
| Algenib | M | high energy, sales | marketplace hype |
| Iapetus | M | serious, educational | tutorial, history, finance |
Health/herbal soft-sell defaults: Autonoe, Leda, Callirrhoe (F) · Fenrir, Iapetus (M).

## 4. Emotion & Tone
- Emotion (pick one): Neutral, Friendly, Energetic, Calm, Storytelling, Professional, Concerned, Whisper.
- Tone (pick one): Formal, Semi-formal, Casual, Playful.
- Energy arc by clip count (M84, softened):
  - 3–4 clips: strong hook → steady → clear close.
  - 5–7 clips: hook (intrigue) → problem (concern) → solution (peak) → how it works (steady) → result (calm) → soft CTA.
  - 8+ clips: add a re-hook around clip 6.
- CTA is polite and calm for soft-sell / health content. No shouting, no "toxic" or paranoid delivery.

## 5. Pacing & Speed (M71, code wins)
- Words per clip come from the campaign setting. If none: ~2.5–3 words per second as a guide.
- TTS speed 1.0–1.2 max; faster speed leaves dead air at the end of the clip.
- Pitch: slightly higher for cheerful, slightly lower for serious, 0 for neutral.

## 6. SFX & Music
- **Voice first (M76/M78):** no SFX in the first second; SFX at most ~15% volume while voice is active.
- **Organic foley (M65):** real material sounds — dull tap on glass, viscous glug, fabric rustle, room tone.
  Avoid: whoosh, zap, cartoon boing, stock transition sounds.
- Music: describe texture, not "sad music" — e.g., felt piano (intimate), solitary cello (grief), acoustic pluck (honest), soft swell (realization).
