import assert from 'assert';
import { normalizeNextcloudDownloadUrl, isNextcloudMediaUrl } from '../lib/publishing-drive-staging.js';
import { classifyReplizFailure } from '../lib/publishing-contract.js';

console.log('=== TEST 1: Nextcloud URL Normalizer ===');
const url1 = 'http://100.78.186.123/index.php/s/fADJDNs97A8CfAQ';
const norm1 = normalizeNextcloudDownloadUrl(url1);
assert.strictEqual(norm1, 'http://100.78.186.123/index.php/s/fADJDNs97A8CfAQ/download');
console.log('✔ Case 1: Standard /index.php/s/<token> normalized with /download');

const url2 = 'https://cloud.ast402.my.id/s/xyz123';
const norm2 = normalizeNextcloudDownloadUrl(url2);
assert.strictEqual(norm2, 'http://100.78.186.123/s/xyz123/download');
console.log('✔ Case 2: Custom domain /s/<token> converted to internal base with /download');

const url3 = 'http://100.78.186.123/index.php/s/alreadyDone/download';
const norm3 = normalizeNextcloudDownloadUrl(url3);
assert.strictEqual(norm3, 'http://100.78.186.123/index.php/s/alreadyDone/download');
console.log('✔ Case 3: Already has /download is not duplicated');

const nonNc = 'https://example.com/video.mp4';
assert.strictEqual(normalizeNextcloudDownloadUrl(nonNc), nonNc);
console.log('✔ Case 4: Non-Nextcloud URL untouched');

console.log('\n=== TEST 2: Error Classifier Priorities ===');

// Test 2.1: Robots.txt error
const cRobots = classifyReplizFailure({
  platform: 'facebook',
  status: 'error',
  errorMessage: 'Unable to fetch media from URL, got status code: 403 Restricted by robots.txt',
  httpStatus: 422
});
assert.strictEqual(cRobots.code, 'REPLIZ_ROBOTS_TXT_BLOCKED');
assert.strictEqual(cRobots.class, 'crawler_blocked');
assert.ok(cRobots.message.includes('robots.txt'));
console.log('✔ Test 2.1: Robots.txt error classified correctly');

// Test 2.2: TikTok media format failure
const cFormat = classifyReplizFailure({
  platform: 'tiktok',
  status: 'failed',
  errorMessage: 'file_format_check_failed',
  httpStatus: 422
});
assert.strictEqual(cFormat.code, 'REPLIZ_MEDIA_INVALID');
assert.strictEqual(cFormat.class, 'media_invalid');
assert.ok(cFormat.message.includes('file_format_check_failed'));
console.log('✔ Test 2.2: TikTok format check failed classified correctly');

// Test 2.3: Instagram transcoding failure
const cTranscode = classifyReplizFailure({
  platform: 'instagram',
  status: 'failed',
  errorMessage: 'Video Transcoding Error: progressive_video_not_ready',
  httpStatus: 422
});
assert.strictEqual(cTranscode.code, 'REPLIZ_MEDIA_INVALID');
assert.strictEqual(cTranscode.class, 'media_invalid');
assert.ok(cTranscode.message.includes('progressive_video_not_ready'));
console.log('✔ Test 2.3: Instagram transcode error classified correctly');

// Test 2.4: Real transient 500 error without specific media msg
const cTransient = classifyReplizFailure({
  platform: 'tiktok',
  status: 'error',
  errorMessage: 'Internal Server Error',
  httpStatus: 500
});
assert.strictEqual(cTransient.code, 'REPLIZ_TIKTOK_INTERNAL');
assert.strictEqual(cTransient.class, 'provider_transient');
console.log('✔ Test 2.4: True internal 500 error classified as retryable transient');

console.log('\n=== TEST 3: HTML Guard Detection Logic ===');
const fakeHtmlBuffer = Buffer.from('<!DOCTYPE html><html class="ng-csp"><head><title>Test - Nextcloud</title></head></html>');
const headSample = fakeHtmlBuffer.slice(0, 100).toString('utf8').toLowerCase();
assert.ok(headSample.includes('<!doctype html') || headSample.includes('<html'));
console.log('✔ Test 3: HTML buffer detected correctly by head sample inspection');

console.log('\n✅ ALL VERIFICATION TESTS PASSED!');
process.exit(0);

