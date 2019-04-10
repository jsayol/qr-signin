import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import {
  QR_RTDB_PATH,
  QR_FIRESTORE_COLLECTION,
  USE_RTDB,
  USE_FIRESTORE
} from './util';

const handler =
  process.env.BUILD === 'dev' || process.env.NOT_MODS
    ? functions
    : functions.handler;

/**
 * Clean up any expired QR code tokens.
 */
const cleanupQRTokens = handler.https.onRequest((req, res) => {
  // Automatically allow cross-origin requests.
  return cors({ origin: true })(req, res, async () => {
    if (USE_RTDB) {
      // RTDB
      const expired = await admin
        .database()
        .ref(QR_RTDB_PATH)
        .orderByChild('exp')
        .endAt(Date.now())
        .once('value');

      const toRemove: { [k: string]: null } = {};
      expired.forEach(snap => {
        toRemove[snap.ref.path] = null;
      });

      if (Object.keys(toRemove).length > 0) {
        await admin
          .database()
          .ref()
          .update(toRemove);
      }
    } else if (USE_FIRESTORE) {
      // Firestore
      const expired = await admin
        .firestore()
        .collection(QR_FIRESTORE_COLLECTION)
        .where('exp', '<=', Date.now())
        .get();

      if (expired.size > 0) {
        // Once we get the results, begin a batch
        const batch = admin.firestore().batch();

        expired.forEach(doc => {
          // For each doc, add a delete operation to the batch
          batch.delete(doc.ref);
        });

        // Commit the batch
        await batch.commit();
      }
    } else {
      console.error(`Unknown build flavor "${process.env.FLAVOR}"`);
      throw new functions.https.HttpsError('internal', 'Internal error.');
    }
  });
});

exports = module.exports = cleanupQRTokens;
