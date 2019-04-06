/** Database path to store QR code tokens */
export const RTDB_QR_PATH = '/qr_signin_tokens';
// export const RTDB_QR_PATH = process.env.RTDB_QR_PATH as string;

/** QR code expiration time (in ms) */
export const QR_CODE_EXPIRATION_TIME = 10000;
// export const QR_CODE_EXPIRATION_TIME = Number(process.env.QR_CODE_EXPIRATION_TIME);

/** QR code error correction level - L (7%), M (15%), Q (25%), H (30%) */
export const QR_CODE_ERROR_LEVEL = 'L';
// export const QR_CODE_ERROR_LEVEL = process.env.QR_CODE_ERROR_LEVEL as string;

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
