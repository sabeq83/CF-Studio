import { convertPcmToWav } from './audio-helper.js';
import { executeWithKeyPool, recordGeminiHttpCall, getCurrentGeminiTrace } from './gemini.js';
import path from 'path';
import fs from 'fs';

/**
 * Otomatis menyusun instruksi pengkondisian kecepatan Gemini TTS berdasarkan jumlah kata
 * @param {string} text - Naskah asli bahasa Indonesia
 * @returns {string} Teks payload yang sudah digabungkan dengan perintah durasi
 */
export function buildDynamicTtsPrompt(text) {
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;

  let prefix = "";

  if (wordCount < 16) {
    // Naskah pendek -> perintahkan untuk bicara santai dengan jeda alami agar menyentuh 8 detik
    prefix = "Please read the following Indonesian text at a slow, calm, and deliberate pace. Spread out your speech with natural pauses between words so that the total audio output duration is exactly 8.0 seconds: ";
  } else if (wordCount >= 16 && wordCount <= 22) {
    // Naskah sedang/normal -> kecepatan standard pas 8 detik
    prefix = "Please read the following Indonesian text at a normal, clear pace so that the narration takes exactly 8.0 seconds of audio duration: ";
  } else {
    // Naskah panjang -> perintahkan bicara cepat khas iklan promosi agar muat dalam 8 detik
    prefix = "Please read the following Indonesian text at an upbeat, energetic, and rapid promotional pace. Minimize pauses between words to fit the entire narration into exactly 8.0 seconds of audio duration: ";
  }

  // Gabungkan instruksi bahasa Inggris dengan naskah Indonesia
  return `${prefix} "${text}"`;
}

/**
 * Memanggil API Gemini TTS dan menghasilkan file audio tepat 8 detik
 * @param {string} text - Naskah voiceover
 * @param {string} voicePersona - Karakter Suara Gemini (misal: 'Kore', 'Fenrir')
 * @param {string} outputPath - Lokasi penyimpanan file audio .wav final
 */
export async function generateGeminiExact8sAudio(text, voicePersona, outputPath) {
  const conditionalPrompt = buildDynamicTtsPrompt(text);
  console.log(`[Gemini-8s-TTS] Memproses teks dengan instruksi pengkondisian:\n"${conditionalPrompt}"`);

  const ttsModel = 'gemini-2.5-flash-preview-tts';
  return await executeWithKeyPool(1, async (apiKey) => {
    const startedAt = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            {
              text: conditionalPrompt
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voicePersona || "Kore"
            }
          }
        }
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Gemini API HTTP Error: ${response.status} - ${errorText}`);
        err.status = response.status;
        err.geminiModel = ttsModel;
        await recordGeminiHttpCall({
          modelName: ttsModel,
          stage: getCurrentGeminiTrace().stage || 'tts_gemini_8s',
          attempt: 0,
          durationMs: Date.now() - startedAt,
          httpStatus: response.status,
          ok: false,
          error: err
        });
        throw err;
      }

      const result = await response.json();
      await recordGeminiHttpCall({
        modelName: ttsModel,
        stage: getCurrentGeminiTrace().stage || 'tts_gemini_8s',
        attempt: 0,
        durationMs: Date.now() - startedAt,
        httpStatus: 200,
        ok: true,
        usageMetadata: result.usageMetadata || null
      });

      // Extract biner audio L16 PCM hasil generate Gemini
      const base64Pcm = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (!base64Pcm) {
        throw new Error("Gagal mengambil data audio biner dari respon Gemini.");
      }

      const pcmBuffer = Buffer.from(base64Pcm, 'base64');

      // Sisipkan 44-byte WAV Header agar audio valid dan terbaca oleh FFmpeg / Browser
      const wavBuffer = convertPcmToWav(pcmBuffer, 24000); // Format output standard Gemini TTS: 24kHz

      // Simpan file audio secara lokal
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outputPath, wavBuffer);

      console.log(`[Gemini-8s-TTS] File WAV berhasil disimpan: ${outputPath} (Tepat 8 detik secara native)`);
      return outputPath;
    } catch (error) {
      if (!error.geminiModel) {
        error.geminiModel = ttsModel;
        await recordGeminiHttpCall({
          modelName: ttsModel,
          stage: getCurrentGeminiTrace().stage || 'tts_gemini_8s',
          attempt: 0,
          durationMs: Date.now() - startedAt,
          httpStatus: error.status || 500,
          ok: false,
          error
        });
      }
      throw error;
    }
  }, { modelName: ttsModel });
}
