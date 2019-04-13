// This check will prevent deploying if for some reason we've build
// with an invalid flavor.
if (
  !['rtdb', 'firestore', 'mod-rtdb', 'mod-firestore'].includes(
    process.env.FLAVOR!
  )
) {
  throw new Error(`Unknown build flavor "${process.env.FLAVOR}"`);
}

exports.getQRCode = require('./get-qr-code');
exports.authenticateQRCode = require('./authenticate-qr-code');
exports.cancelQRToken = require('./cancel-qr-token');
exports.cleanupQRTokens = require('./cleanup-qr-tokens');
exports.initialize = require('./initialize');
