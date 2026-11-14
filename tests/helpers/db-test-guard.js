import { assertSafeTestDbEnv } from '../../lib/db-env-validator.js';

export function ensureSafeLocalTestDbEnv(options = {}) {
  return assertSafeTestDbEnv(options);
}

