import path from 'path';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

let cachedBundleLocation = null;

/**
 * Get or create cached webpack bundle for Remotion templates.
 */
export async function getRemotionBundle(forceRebuild = false) {
  if (!forceRebuild && cachedBundleLocation && fs.existsSync(cachedBundleLocation)) {
    return cachedBundleLocation;
  }

  const entryPoint = path.join(process.cwd(), 'remotion', 'index.js');
  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Remotion entrypoint not found at: ${entryPoint}`);
  }

  console.log('[RemotionEngine] Bundling Remotion templates...');
  cachedBundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config
  });

  console.log(`[RemotionEngine] Bundle created at: ${cachedBundleLocation}`);
  return cachedBundleLocation;
}

/**
 * Get available Chromium executable path (prefers Playwright Chromium if available).
 */
export async function resolveChromiumExecutable() {
  try {
    const { chromium } = await import('playwright');
    const execPath = chromium.executablePath();
    if (execPath && fs.existsSync(execPath)) {
      return execPath;
    }
  } catch (err) {
    // Playwright chromium resolution fallback
  }
  return null;
}

/**
 * Render Explainer Video to MP4.
 */
export async function renderExplainerVideo({
  compositionId = 'GarliBeeExplainer',
  inputProps = {},
  outputPath,
  onProgress = null
}) {
  const finalOutputPath = outputPath || path.join(
    process.cwd(),
    'public',
    'rendered',
    `explainer_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`
  );

  const outputDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const bundleLocation = await getRemotionBundle();

  console.log(`[RemotionEngine] Selecting composition "${compositionId}"...`);
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps
  });

  const chromiumExecutable = await resolveChromiumExecutable();
  console.log(`[RemotionEngine] Using Chromium: ${chromiumExecutable || 'Default Remotion Browser'}`);

  console.log(`[RemotionEngine] Rendering ${composition.durationInFrames} frames (${composition.durationInFrames / composition.fps}s) at ${composition.fps}fps...`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: finalOutputPath,
    inputProps,
    chromiumOptions: chromiumExecutable ? {
      executablePath: chromiumExecutable
    } : {},
    onProgress: (prog) => {
      const percent = Math.round(prog.progress * 100);
      if (typeof onProgress === 'function') {
        onProgress(percent, prog);
      }
    }
  });

  console.log(`[RemotionEngine] Render completed successfully: ${finalOutputPath}`);
  return {
    success: true,
    outputPath: finalOutputPath,
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
    durationSeconds: composition.durationInFrames / composition.fps
  };
}

