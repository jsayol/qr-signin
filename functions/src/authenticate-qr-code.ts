import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  RTDB_QR_PATH,
  QRCodeInfo,
  QR_CODE_EXPIRATION_TIME,
  functionsPrefix,
  initAdmin
} from './util';

initAdmin();

/**
 * Uses a QR code that has been read from an already-authenticated session
 * in order to authenticate a web session as corresponding to the same user.
 * Once correctly authenticated, it generates a custom token (JWT) that the
 * web session can use to sign in.
 */
exports.authenticateQRCode = functionsPrefix.https.onCall(
  async (data, context) => {
    // Mock auth context during development
    if (process.env.BUILD === 'dev') {
      context.auth = { uid: '123456780' } as any;
    }

    // Check that the user is authenticated.
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Missing or invalid authentication.'
      );
    }

    // QR code token passed from the client.
    const qrCodeToken = data.qr;

    // Check the QR code token attribute.
    if (typeof qrCodeToken !== 'string' || qrCodeToken.length !== 128) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing or malformed QR code token.'
      );
    }

    // Check that the QR code token exists in the database and is valid.
    if (!(await isQRCodeTokenValid(qrCodeToken))) {
      console.log(`Called with invalid or expired token: ${qrCodeToken}`);
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid or expired QR code token.'
      );
    }

    try {
      // Generate a custom token for the authenticated user id.
      const customToken = await generateCustomToken(context.auth.uid);
      // Add the custom token to the QR code token in the database.
      await addCustomTokenToQRCodeToken(qrCodeToken, customToken);
    } catch (err) {
      // Since there's been some problem while generating or storing a
      // custom token, let's remove the used QR code token before exiting.
      await removeQRCodeToken(qrCodeToken);
      throw err;
    }

    // Done! We don't need to comunicate anything to the client at this point
    // (other than the 200 response that it will receive) so there's no need to
    // send any response here.
  }
);

/**
 * Returns a promise that resolves to a boolean indicating whether the QR code
 * token is still valid.
 */
async function isQRCodeTokenValid(qrCodeToken: string): Promise<boolean> {
  let qrSnap: admin.database.DataSnapshot;
  try {
    qrSnap = await admin
      .database()
      .ref(RTDB_QR_PATH)
      .child(qrCodeToken)
      .once('value');
  } catch (err) {
    // Something went wrong while reading from the database.
    console.error('Failed to read QR code token from the database!', err);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }

  const qrCodeInfo: QRCodeInfo = qrSnap.val();

  if (!qrSnap.exists()) {
    // The token doesn't exist in the database.
    return false;
  }

  // Check that the stored data is non-null.
  if (!qrCodeInfo) {
    return false;
  }

  // Check that the stored data contains a valid timestamp.
  // tslint:disable-next-line: strict-type-predicates
  if (!('ts' in qrCodeInfo) || typeof qrCodeInfo.ts !== 'number') {
    return false;
  }

  // Check that the token hasn't been used already
  if (
    'used' in qrCodeInfo &&
    (typeof qrCodeInfo.used !== 'boolean' || qrCodeInfo.used === true)
  ) {
    return false;
  }

  // Check that the token hasn't expired.
  if (qrCodeInfo.ts + QR_CODE_EXPIRATION_TIME <= Date.now()) {
    // Since the QR code token has already expired, it can safely be removed
    // from the database.
    await removeQRCodeToken(qrCodeToken);
    return false;
  }

  // The token is valid.
  return true;
}

async function removeQRCodeToken(qrCodeToken: string): Promise<void> {
  try {
    await admin
      .database()
      .ref(RTDB_QR_PATH)
      .child(qrCodeToken)
      .remove();
  } catch (err) {
    // Something went wrong while removing the database.
    console.error('Failed to remove QR code token from the database!', err);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }
}

async function generateCustomToken(uid: string): Promise<string> {
  let customToken: string;

  try {
    customToken = await admin.auth().createCustomToken(uid);
  } catch (err) {
    // Something went wrong while generating the custom token.
    console.error('Failed to generate custom token!', err);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }

  return customToken;
}

/**
 * Adds a generated custom token to a QR code token information.
 * Additionally, marks the QR code token as used.
 */
async function addCustomTokenToQRCodeToken(
  qrCodeToken: string,
  customToken: string
): Promise<void> {
  try {
    await admin
      .database()
      .ref(RTDB_QR_PATH)
      .child(qrCodeToken)
      .update({
        used: true,
        ct: customToken
      });
  } catch (err) {
    // Something went wrong while writing to the database.
    console.error('Failed to write custom token to the database!', err);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }
}
