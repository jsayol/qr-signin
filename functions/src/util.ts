import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/** Database path to store QR code tokens */
export const QR_RTDB_PATH =
  (process.env.QR_RTDB_PATH as string) || '/qr_signin';

/** QR code expiration time (in ms) */
export const QR_EXPIRATION_TIME =
  Number(process.env.QR_EXPIRATION_TIME) || 10000;

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

export interface QRCodeInfo {
  ts: number; // Timestamp
  ip: string; // Client IP address,
  used?: boolean; // Flag to mark the token as used
  ct?: string; // Generated custom token
}

export const functionsPrefix: typeof functions | typeof functions.handler =
  process.env.BUILD === 'dev' ? functions : functions.handler;

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
        credential: admin.credential.cert('config/serviceAccountKey.json'),
        databaseURL: 'https://mods-test.firebaseio.com'
      });
    } else {
      admin.initializeApp();
    }
  } catch {
    // Already initiualized
  }
}
