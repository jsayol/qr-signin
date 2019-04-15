/*
  This check will prevent deploying if for some reason we've build
  with an invalid flavor.
*/
if (
  process.env.FLAVOR !== 'rtdb' &&
  process.env.FLAVOR !== 'firestore' &&
  process.env.FLAVOR !== 'mod-rtdb' &&
  process.env.FLAVOR !== 'mod-firestore'
) {
  throw new Error(`Unknown build flavor "${process.env.FLAVOR}"`);
}

export { getQRCode } from './get-qr-code';
export { authenticateQRCode } from './authenticate-qr-code';
export { cancelQRToken } from './cancel-qr-token';
export { cleanupQRTokens } from './cleanup-qr-tokens';
export { initialize } from './initialize';
