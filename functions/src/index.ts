const functionName = process.env.FUNCTION_NAME;

if (!functionName || functionName === 'getSignInQRCode') {
  exports.getSignInQRCode = require('./get-signin-qr-code').getSignInQRCode;
}

if (!functionName || functionName === 'authenticateQRCode') {
  exports.authenticateQRCode = require('./authenticate-qr-code').authenticateQRCode;
}
