import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as qrcode from 'qrcode';
import cors from 'cors';
import { randomBytes } from 'crypto';
import {
  QR_RTDB_PATH,
  QR_CODE_BG_COLOR,
  QR_CODE_FG_COLOR,
  QR_CODE_ERROR_LEVEL,
  QR_CODE_SCALE,
  QR_CODE_MARGIN,
  functionsPrefix,
  initAdmin
} from './util';

initAdmin();

const getSignInQRCode = functionsPrefix.https.onRequest((req, res) => {
  return new Promise((resolve, reject) => {
    // Automatically allow cross-origin requests.
    try {
      cors({ origin: true })(req, res, async () => {
        // Only allow GET requests.
        if (req.method !== 'GET') {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Invalid method, only GET requests are allowed.'
          );
        }

        let randomBuffer: Buffer;
        try {
          randomBuffer = randomBytes(96); // A 96-byte input generates a 128-byte base64 string.
        } catch (err) {
          // Something went wrong while generating random bytes.
          console.error('Failed to generate random bytes!', err);
          throw new functions.https.HttpsError('internal', 'Internal error.');
        }

        // We convert the buffer of random bytes into a base64 string.
        // Since we're going to use this string as a key in the database and
        // Firebase doesn't allow the '/' character in keys, we replace them
        // with '-'.
        const qrCodeToken = randomBuffer.toString('base64').replace(/\//g, '-');

        let qrCodeData: string;
        try {
          // Save the generated random string to the database for future reference.
          const value: { [k: string]: any } = {
            [`${QR_RTDB_PATH}/${qrCodeToken}`]: {
              ts: admin.database.ServerValue.TIMESTAMP,
              ip: req.ip
            }
          };

          // Also remove the previous one requested by the same client, if any.
          if (
            typeof req.query.prev === 'string' &&
            req.query.prev.length === 128
          ) {
            value[`${QR_RTDB_PATH}/${req.query.prev}`] = null;
          }

          await admin
            .database()
            .ref()
            .update(value);
        } catch (err) {
          // Something went wrong while writing to the database.
          console.error('Failed to write QR code token to the database!', err);
          throw new functions.https.HttpsError('internal', 'Internal error.');
        }

        try {
          // Generate QR for the generated random token.
          qrCodeData = await qrcode.toDataURL(qrCodeToken, {
            margin: QR_CODE_MARGIN,
            scale: QR_CODE_SCALE,
            errorCorrectionLevel: QR_CODE_ERROR_LEVEL,
            color: {
              dark: QR_CODE_FG_COLOR,
              light: QR_CODE_BG_COLOR
            }
          } as qrcode.QRCodeOptions);
        } catch (err) {
          // Something went wrong while generating the QR code.
          console.error('Failed to generate QR code!', err);
          throw new functions.https.HttpsError('internal', 'Internal error.');
        }

        if (req.query.format === 'image') {
          // Send the response as an image rather than JSON
          const [, data] = qrCodeData.match(
            /^data:[^;]+;base64,(.*)$/
          ) as string[];
          const qrBuffer = Buffer.from(data, 'base64');

          res.status(200);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', qrBuffer.length);
          res.send(qrBuffer);
        } else {
          // Send the response as JSON, including the QR code token and
          // the image data URL
          res.status(200);
          res.send({
            qr: qrCodeData,
            token: qrCodeToken
          });
        }

        // Done!
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
});

exports = module.exports = getSignInQRCode;
