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
  document.getElementById('qrsample-sign-out').disabled = true;
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
    var signOutButton = document.getElementById('qrsample-sign-out');

    if (user) {
      // User is signed in.

      disableSpinner();
      document.getElementById('qrsample-code-image').src = '';
      if (qrRefreshTimeout) {
        clearTimeout(qrRefreshTimeout);
      }
      signInStatus.textContent = 'Signed in as ' + user.email;
      signOutButton.disabled = false;
      signOutButton.textContent = 'Sign out';
      document.getElementById(
        'qrsample-account-details'
      ).textContent = JSON.stringify(user, null, '  ');
    } else {
      // User is signed out.
      signInStatus.textContent = 'Signed out';
      signOutButton.disabled = true;
      signOutButton.textContent = 'Waiting';
      document.getElementById('qrsample-account-details').textContent = 'null';

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
  enableSpinner();

  var url = GET_QR_ENDPOINT;

  if (previousToken) {
    url = url + '?prev=' + encodeURIComponent(previousToken);
  }

  fetch(url, { cache: 'no-cache' })
    .then(response => response.json())
    .then(json => {
      document.getElementById('qrsample-code-image').src = json.qr;
      previousToken = json.token;
      disableSpinner();
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
      customTokenRef.off();
      customTokenRef = null;
      firebase.auth().signInWithCustomToken(customToken).then(() => {
        previousToken = null;
        cancelQRToken(qrToken);
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
