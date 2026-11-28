/**
 * Determines whether the OPC campaign scheduler should pause before TTS stage.
 * Approved items must never be held by a stale 'tts' pause marker.
 */
export function shouldPauseBeforeTts(pauseAt, reviewState) {
  return pauseAt === 'tts' && reviewState !== 'approved';
}
