The workflow from you website to use this mod is as follows:

1. Make a request to the URL to generate a new QR code (it's a regular HTTPS function). This will respond with a token and a dataurl-encoded image for the QR code.
2. Show the QR code to the user.
3. Lsten for changes in Firestore at the `<chosen-collection>/`*`<token>`*`/ct` path.
   3.1. If there's no update at that path before the token expires, remove the listener and repeat from point 1. Keep doing this as many times as you want before cancelling (something like 5 times sounds reasonable).
4. Once you get a value at that path, use it to sign in with `firebase.auth().signInWithCustomToken()`.

The workflow from you app to use this mod is as follows:

1. Use the camera to capture the QR code being shown on the website.
2. Decode it and use its value to call the authentication endpoint (it's an HTTPS Callable function).
3. Wait for the response to find out if the authentication was successful or if there's been any errors.