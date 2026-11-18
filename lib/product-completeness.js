/**
 * Penilai kelengkapan data & aset foto produk bersama untuk API scrape dan worker.
 * Aturan S3: produk dengan clean_photo_url atau cleaned_photo_url dianggap cukup
 * tanpa mewajibkan generated_photo_url.
 */

export function assessProductCompleteness(product, { fileExists } = {}) {
  const checkFile = (relPath) => {
    if (!relPath || typeof relPath !== 'string' || !relPath.trim()) return false;
    return typeof fileExists === 'function' ? Boolean(fileExists(relPath)) : true;
  };

  const hasRaw = checkFile(product?.raw_photo_url);
  const hasClean = checkFile(product?.cleaned_photo_url) || checkFile(product?.clean_photo_url);
  const hasStudio = checkFile(product?.generated_photo_url);

  const needsRaw = !hasRaw;
  const needsClean = !hasClean;
  const needsStudio = !hasStudio && !hasClean;
  const needsMetadata =
    !product?.unique_selling_point ||
    !product?.packaging_type ||
    !product?.t2i_prompt ||
    !product?.i2v_action_prompt;

  return {
    needsRaw,
    needsClean,
    needsStudio,
    needsMetadata,
    anyMissing: needsRaw || needsClean || needsStudio || needsMetadata
  };
}
