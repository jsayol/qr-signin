// This check will prevent deploying if for some reason we've build
// with an invalid flavor.
if (
  !['rtdb', 'firestore', 'mod-rtdb', 'mod-firestore'].includes(
    process.env.FLAVOR!
  )
) {
  throw new Error(`Unknown build flavor "${process.env.FLAVOR}"`);
}

// const functionName = process.env.FUNCTION_NAME;

// if (!functionName || functionName === 'getQRCode') {
exports.getQRCode = require('./get-qr-code');
// }

// if (!functionName || functionName === 'authenticateQRCode') {
exports.authenticateQRCode = require('./authenticate-qr-code');
// }

// if (!functionName || functionName === 'cancelQRToken') {
exports.cancelQRToken = require('./cancel-qr-token');
// }

// if (!functionName || functionName === 'qrTokensCleanup') {
exports.cleanupQRTokens = require('./cleanup-qr-tokens');
// }
