//@ts-check
'use strict';

var ENDPOINT =
  'https://us-central1-mods-test.cloudfunctions.net/mod-qr-signin-9f13-getSignInQRCode';

var customTokenRef;

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
      var displayName = user.displayName;
      var email = user.email;
      var emailVerified = user.emailVerified;
      var photoURL = user.photoURL;
      var isAnonymous = user.isAnonymous;
      var uid = user.uid;
      var providerData = user.providerData;
      document.getElementById('qrsample-sign-in-status').textContent =
        'Signed in';
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

      getQRCode();
    }
    document.getElementById('qrsample-sign-in').disabled = false;
  });

  document
    .getElementById('qrsample-sign-in')
    .addEventListener('click', toggleSignIn, false);
}

function getQRCode() {
  fetch(ENDPOINT, { cache: 'no-cache' })
    .then(response => response.json())
    .then(json => {
      document.getElementById('qrsample-code-image').src = json.qr;
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

  customTokenRef = firebase.database().ref('qr_signin_tokens/' + qrToken + '/ct');

  customTokenRef.on('value', snap => {
    const customToken = snap.val();
    if (customToken) {
      customTokenRef.off();
      customTokenRef = null;
      firebase.auth().signInWithCustomToken(customToken);
    }
  });
}

window.addEventListener('load', initApp);

// window.onload = function() {
//   initApp();
// };
