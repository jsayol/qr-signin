'use strict';

var RTDB_PREFIX = 'qr_signin';

// var ENDPOINT = 'https://us-central1-mods-test.cloudfunctions.net/getQRCode';
var ENDPOINT =
  'https://us-central1-mods-test.cloudfunctions.net/mod-qr-signin-2783-getQRCode';

var QR_REFRESH_INTERVAL = 9000;
var MAX_QR_REFRESH = 5;

var customTokenRef;
var qrRefreshTimeout;

/**
 * Handle the sign in button press.
 */
function toggleSignIn() {
  if (firebase.auth().currentUser) {
    firebase.auth().signOut();
  } else {
    var token = document.getElementById('tokentext').value;
    if (token.length < 10) {
      alert('Please enter a token in the text area');
      return;
    }
    // Sign in with custom token generated following previous instructions.
    firebase
      .auth()
      .signInWithCustomToken(token)
      .catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        if (errorCode === 'auth/invalid-custom-token') {
          alert('The token you provided is not valid.');
        } else {
          console.error(error);
        }
      });
  }
  document.getElementById('qrsample-sign-in').disabled = true;
}

/**
 * initApp handles setting up UI event listeners and registering Firebase auth listeners:
 *  - firebase.auth().onAuthStateChanged: This listener is called when the user is signed in or
 *    out, and that is where we update the UI.
 */
function initApp() {
  // Listening for auth state changes.
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      // User is signed in.

      disableSpinner();
      document.getElementById('qrsample-code-image').src = '';
      if (qrRefreshTimeout) {
        clearTimeout(qrRefreshTimeout);
      }

      document.getElementById('qrsample-sign-in-status').textContent =
        'Signed in as ' + user.email;
      document.getElementById('qrsample-sign-in').textContent = 'Sign out';
      document.getElementById(
        'qrsample-account-details'
      ).textContent = JSON.stringify(user, null, '  ');
    } else {
      // User is signed out.
      document.getElementById('qrsample-sign-in-status').textContent =
        'Signed out';
      document.getElementById('qrsample-sign-in').textContent = 'Sign In';
      document.getElementById('qrsample-account-details').textContent = 'null';

      startFetchingQRCode();
    }
    document.getElementById('qrsample-sign-in').disabled = false;
  });

  document
    .getElementById('qrsample-sign-in')
    .addEventListener('click', toggleSignIn, false);
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
    document.getElementById('qrsample-code-image').src = '';
  }
}

function getQRCode() {
  enableSpinner();

  fetch(ENDPOINT, { cache: 'no-cache' })
    .then(response => response.json())
    .then(json => {
      document.getElementById('qrsample-code-image').src = json.qr;
      disableSpinner();
      waitForCustomToken(json.token);
    })
    .catch(err => {
      console.log('Something went wrong:', err);
    });
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
      firebase.auth().signInWithCustomToken(customToken);
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
