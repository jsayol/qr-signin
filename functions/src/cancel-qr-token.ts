import * as functions from 'firebase-functions';
import cors from 'cors';
import {
  initAdmin,
  isQRCodeTokenValid,
  removeQRCodeToken,
  assertMethod
} from './util';

initAdmin();

const handler =
  process.env.BUILD === 'dev' || process.env.NOT_MODS
    ? functions
    : functions.handler;

export const cancelQRToken = handler.https.onRequest((req, res) => {
  return cors({ origin: true })(req, res, async () => {
    assertMethod(req.method, 'POST');

    const qrCodeToken = req.body.token;

    // Check that the QR code token exists in the database and is valid.
    // In this case we don't care if it already expired.
    if (!(await isQRCodeTokenValid(qrCodeToken, true, true))) {
      console.log(`Called with invalid token: ${qrCodeToken}`);
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid QR code token.'
      );
    }

    // Remove the token
    await removeQRCodeToken(qrCodeToken);

    res.end();
  });
});
