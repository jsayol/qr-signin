import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/** Database path to store QR code tokens */
export const QR_RTDB_PATH = (process.env.QR_RTDB_PATH as string) || 'qr_signin';

/** QR code expiration time (in ms) */
export const QR_EXPIRATION_TIME =
  1000 * (Number(process.env.QR_EXPIRATION_TIME) || 10);

/** QR code error correction level - L (7%), M (15%), Q (25%), H (30%) */
export const QR_CODE_ERROR_LEVEL =
  (process.env.QR_CODE_ERROR_LEVEL as string) || 'L';

/** QR code foreground color (dots) - Hex RGB (can include alpha channel) */
export const QR_CODE_FG_COLOR = '#000000ff';

/** QR code background color - Hex RGB (can include alpha channel) */
export const QR_CODE_BG_COLOR = '#ffffffff';

/** QR code scale */
export const QR_CODE_SCALE = 6; // Pixels per dot

/** QR code margin */
export const QR_CODE_MARGIN = 4; // Number of dots per side

/** QR code prefix */
export const QR_CODE_PREFIX = 'qrAuth$';

export interface QRCodeInfo {
  ts: number; // Timestamp
  ip: string; // Client IP address,
  used?: boolean; // Flag to mark the token as used
  ct?: string; // Generated custom token
}

/**
 * Initialize the Admin SDK for the appropriate environment
 */
export function initAdmin() {
  try {
    if (process.env.USE_EMULATOR) {
      const app = admin.initializeApp({
        databaseURL: `http://localhost:9000?ns=debug`,
        projectId: 'debug'
      });
      (app as any).INTERNAL.getToken = () =>
        Promise.resolve({ accessToken: 'owner' });
    } else if (process.env.BUILD === 'dev') {
      admin.initializeApp({
        credential: admin.credential.cert('../config/serviceAccountKey.json'),
        databaseURL: 'https://mods-test.firebaseio.com'
      });
    } else {
      admin.initializeApp();
    }
  } catch {
    // Already initialized
  }
}

/**
 * Returns a promise that resolves to a boolean indicating whether the QR code
 * token is still valid.
 */
export async function isQRCodeTokenValid(
  qrCodeToken: string,
  acceptUsed = false,
  acceptExpired = false
): Promise<boolean> {
  let qrSnap: admin.database.DataSnapshot;
  try {
    qrSnap = await admin
      .database()
      .ref(QR_RTDB_PATH)
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

  // Check that the token hasn't been used already, unless requested to skip this check
  if (
    !acceptUsed &&
    'used' in qrCodeInfo &&
    (typeof qrCodeInfo.used !== 'boolean' || qrCodeInfo.used === true)
  ) {
    return false;
  }

  // Check that the token hasn't expired, unless requested to skip this check.
  if (!acceptExpired) {
    if (qrCodeInfo.ts + QR_EXPIRATION_TIME <= Date.now()) {
      // Since the QR code token has already expired, it can safely be removed
      // from the database.
      await removeQRCodeToken(qrCodeToken);
      return false;
    }
  }

  // The token is valid.
  return true;
}

export async function removeQRCodeToken(qrCodeToken: string): Promise<void> {
  try {
    await admin
      .database()
      .ref(QR_RTDB_PATH)
      .child(qrCodeToken)
      .remove();
  } catch (err) {
    // Something went wrong while removing the database.
    console.error('Failed to remove QR code token from the database!', err);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }
}
