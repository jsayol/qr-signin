'use strict';

var RTDB_PREFIX = 'qr_signin';

var GET_QR_ENDPOINT =
  'https://us-central1-mods-test.cloudfunctions.net/getQRCode';

var CANCEL_QR_ENDPOINT =
  'https://us-central1-mods-test.cloudfunctions.net/cancelQRToken';

var QR_REFRESH_INTERVAL = 9000;
var MAX_QR_REFRESH = 5;

var customTokenRef;
var qrRefreshTimeout;
var previousToken;

/**
 * Handle the sign out button press.
 */
function signOut() {
  if (firebase.auth().currentUser) {
    firebase.auth().signOut();
  }
}

/**
 * initApp handles setting up UI event listeners and registering Firebase auth listeners:
 *  - firebase.auth().onAuthStateChanged: This listener is called when the user is signed in or
 *    out, and that is where we update the UI.
 */
function initApp() {
  // Listening for auth state changes.
  firebase.auth().onAuthStateChanged(function(user) {
    var signInStatus = document.getElementById('qrsample-sign-in-status');

    if (user) {
      // User is signed in.

      disableSpinner();

      document.getElementById('qrsample-code-image').src = '';
      if (qrRefreshTimeout) {
        clearTimeout(qrRefreshTimeout);
      }

      signInStatus.textContent = 'Signed in as ' + user.email;
      document.getElementById(
        'qrsample-account-details'
      ).textContent = JSON.stringify(user, null, 2);

      document.body.classList.add('signed-in');
      document.body.classList.remove('signed-out');

      document.querySelector(
        'h2.mdl-card__title-text.signed-in'
      ).textContent = user.displayName
        ? 'Hi ' + user.displayName + '!'
        : 'Hello!';
    } else {
      // User is signed out.
      signInStatus.textContent = 'Signed out';
      document.getElementById('qrsample-account-details').textContent = 'null';

      document.body.classList.add('signed-out');
      document.body.classList.remove('signed-in');

      startFetchingQRCode();
    }
  });

  document
    .getElementById('qrsample-sign-out')
    .addEventListener('click', signOut, false);
}

function startFetchingQRCode(tries) {
  if (!tries) {
    tries = 0;
  }

  if (tries < MAX_QR_REFRESH) {
    if (qrRefreshTimeout) {
      clearTimeout(qrRefreshTimeout);
    }

    getQRCode();
    qrRefreshTimeout = setTimeout(
      () => startFetchingQRCode(tries + 1),
      QR_REFRESH_INTERVAL
    );
  } else {
    if (previousToken) {
      cancelQRToken(previousToken);
      previousToken = null;
    }
    document.getElementById('qrsample-code-image').src = '';
  }
}

function getQRCode() {
  var url = GET_QR_ENDPOINT;

  if (previousToken) {
    url = url + '?prev=' + encodeURIComponent(previousToken);
  }

  fetch(url, { cache: 'no-cache' })
    .then(response => response.json())
    .then(json => {
      document.getElementById('qrsample-code-image').src = json.qr;
      previousToken = json.token;
      waitForCustomToken(json.token);
    })
    .catch(err => {
      console.log('Something went wrong:', err);
    });
}

function cancelQRToken(qrToken) {
  if (qrToken) {
    fetch(CANCEL_QR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: qrToken }),
      cache: 'no-cache',
    }).catch(err => {
      console.log('Something went wrong:', err);
    });
  }
}

function waitForCustomToken(qrToken) {
  if (customTokenRef) {
    customTokenRef.off();
  }

  customTokenRef = firebase
    .database()
    .ref(RTDB_PREFIX)
    .child(qrToken)
    .child('ct');

  customTokenRef.on('value', snap => {
    const customToken = snap.val();
    if (customToken) {
      enableSpinner();
      customTokenRef.off();
      customTokenRef = null;
      firebase
        .auth()
        .signInWithCustomToken(customToken)
        .then(() => {
          previousToken = null;
          cancelQRToken(qrToken);
          disableSpinner();
        });
    }
  });
}

function enableSpinner() {
  document.getElementById('loading-container').classList.add('enabled');
}

function disableSpinner() {
  document.getElementById('loading-container').classList.remove('enabled');
}

window.addEventListener('load', initApp);
