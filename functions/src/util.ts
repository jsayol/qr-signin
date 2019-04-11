import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { join as joinPath } from 'path';

/** Database path to store QR code tokens */
export const QR_RTDB_PATH = process.env.QR_RTDB_PATH || 'qr_signin';

/** Firestore collection to store QR code tokens */
export const QR_FIRESTORE_COLLECTION =
  process.env.QR_FIRESTORE_COLLECTION || 'qr_signin';

/** QR code expiration time (in ms) */
export const QR_EXPIRATION_TIME =
  1000 * (Number(process.env.QR_EXPIRATION_TIME) || 10);

/** QR code error correction level - L (7%), M (15%), Q (25%), H (30%) */
export const QR_CODE_ERROR_LEVEL = process.env.QR_CODE_ERROR_LEVEL || 'L';

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

// Note: the ternary operator is necessary for rollup to do its thing
export const USE_RTDB =
  process.env.FLAVOR === 'rtdb' || process.env.FLAVOR === 'mod-rtdb'
    ? true
    : false;

// Note: the ternary operator is necessary for rollup to do its thing
export const USE_FIRESTORE =
  process.env.FLAVOR === 'firestore' || process.env.FLAVOR === 'mod-firestore'
    ? true
    : false;

export interface QRCodeInfo {
  exp: number; // Expiration timestamp
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
        credential: admin.credential.cert(
          joinPath(__dirname, '..', '..', 'config', 'serviceAccountKey.json')
        ),
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
  let qrCodeInfo: QRCodeInfo;

  if (USE_RTDB) {
    // RTDB
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

    if (!qrSnap.exists()) {
      // The token doesn't exist in the database.
      return false;
    }

    qrCodeInfo = qrSnap.val();
  } else if (USE_FIRESTORE) {
    // Firestore
    let qrSnap;
    try {
      qrSnap = await admin
        .firestore()
        .collection(QR_FIRESTORE_COLLECTION)
        .doc(qrCodeToken)
        .get();
    } catch (err) {
      // Something went wrong while reading from Firebase.
      console.error('Failed to read QR code token from Firebase!', err);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }

    if (!qrSnap.exists) {
      // The token doesn't exist in Firestore.
      return false;
    }

    qrCodeInfo = qrSnap.data() as QRCodeInfo;
  } else {
    console.error(`Unknown build flavor "${process.env.FLAVOR}"`);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }

  // Check that the stored data is non-null.
  if (!qrCodeInfo) {
    return false;
  }

  // Check that the token hasn't expired, unless requested to skip this check.
  if (
    !acceptExpired &&
    !(
      'exp' in qrCodeInfo &&
      typeof qrCodeInfo.exp === 'number' &&
      qrCodeInfo.exp >= Date.now()
    )
  ) {
    // Since the QR code token has already expired, it can safely be removed
    // from the database.
    await removeQRCodeToken(qrCodeToken);
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

  // The token is valid.
  return true;
}

export async function saveQRCodeToken(
  qrCodeToken: string,
  req: functions.Request
): Promise<void> {
  if (USE_RTDB) {
    // RTDB
    try {
      // Save the generated random string for future reference.
      const values: { [k: string]: any } = {
        [qrCodeToken]: {
          exp: Date.now() + QR_EXPIRATION_TIME,
          ip: req.ip
        }
      };

      // Also remove the previous one requested by the same client, if any.
      if (typeof req.query.prev === 'string' && req.query.prev.length > 100) {
        values[req.query.prev] = null;
      }

      await admin
        .database()
        .ref(QR_RTDB_PATH)
        .update(values);
    } catch (err) {
      // Something went wrong while writing to the database.
      console.error('Failed to write QR code token to the database!', err);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }
  } else if (USE_FIRESTORE) {
    // Firestore
    try {
      const col = admin.firestore().collection(QR_FIRESTORE_COLLECTION);
      const promises: Promise<any>[] = [];

      // Save the generated random string for future reference.
      promises.push(
        col.doc(qrCodeToken).set({
          exp: Date.now() + QR_EXPIRATION_TIME,
          ip: req.ip
        })
      );

      // Also remove the previous one requested by the same client, if any.
      if (typeof req.query.prev === 'string' && req.query.prev.length > 100) {
        promises.push(col.doc(req.query.prev).delete());
      }

      await Promise.all(promises);
    } catch (err) {
      // Something went wrong while writing to Firestore.
      console.error('Failed to write QR code token to Firestore!', err);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }
  } else {
    console.error(`Unknown build flavor "${process.env.FLAVOR}"`);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }
}

export async function removeQRCodeToken(qrCodeToken: string): Promise<void> {
  if (USE_RTDB) {
    // RTDB
    try {
      await admin
        .database()
        .ref(QR_RTDB_PATH)
        .child(qrCodeToken)
        .remove();
    } catch (err) {
      // Something went wrong while removing the token.
      console.error('Failed to remove QR code token from the database!', err);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }
  } else if (USE_FIRESTORE) {
    // Firestore
    try {
      await admin
        .firestore()
        .collection(QR_FIRESTORE_COLLECTION)
        .doc(qrCodeToken)
        .delete();
    } catch (err) {
      // Something went wrong while removing the token.
      console.error('Failed to remove QR code token from Firestore!', err);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }
  } else {
    console.error(`Unknown build flavor "${process.env.FLAVOR}"`);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }
}

/**
 * Adds a generated custom token to a QR code token information.
 * Additionally, marks the QR code token as used and extends the
 * expiration time.
 */
export async function addCustomTokenToQRCodeToken(
  qrCodeToken: string,
  customToken: string
): Promise<void> {
  if (USE_RTDB) {
    // RTDB
    try {
      await admin
        .database()
        .ref(QR_RTDB_PATH)
        .child(qrCodeToken)
        .update({
          ct: customToken,
          used: true,
          exp: Date.now() + QR_EXPIRATION_TIME
        });
    } catch (err) {
      // Something went wrong while writing to the database.
      console.error('Failed to write custom token to the database!', err);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }
  } else if (USE_FIRESTORE) {
    // Firestore
    try {
      await admin
        .firestore()
        .collection(QR_FIRESTORE_COLLECTION)
        .doc(qrCodeToken)
        .update({
          ct: customToken,
          used: true,
          exp: Date.now() + QR_EXPIRATION_TIME
        });
    } catch (err) {
      // Something went wrong while writing to Firestore.
      console.error('Failed to write custom token to Firestore!', err);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }
  } else {
    console.error(`Unknown build flavor "${process.env.FLAVOR}"`);
    throw new functions.https.HttpsError('internal', 'Internal error.');
  }
}
