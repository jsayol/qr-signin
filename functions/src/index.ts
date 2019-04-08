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
//   exports.qrTokensCleanup = require('./qr-tokens-cleanup');
// }
