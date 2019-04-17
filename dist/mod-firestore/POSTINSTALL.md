Your mod is installed and almost ready!

You need to set the correct permissions for the database path that will store the temporary QR code information.
You can do this simply by opening this URL: ${function:initialize.url}

Alternatively, you can do it manually by adding this to your rules:

```js
service cloud.firestore {
  match /databases/{database}/documents {
    match /${QR_FIRESTORE_COLLECTION} {
      allow read, write: if false;
        match /{QRtoken}/ct {
          allow read: if true;
        }
    }
  }
}
```

Workflow from you website:

1. Make a request to the URL to generate a new QR code (it's a regular HTTPS function). This will respond with a token and a dataurl-encoded image for the QR code.
2. Show the QR code to the user.
3. Lsten for changes in Firestore at the `${QR_FIRESTORE_COLLECTION}/`*`<token>`*`/ct` path.
   3.1. If there's no update at that path before ${QR_EXPIRATION_TIME} seconds pass, remove the listener and repeat from point 1. Keep doing this as many times as you want before cancelling (something like 5 times sounds reasonable).
4. Once you get a value at that path, use it to sign in with `firebase.auth().signInWithCustomToken()`.

Workflow from you app:

1. Use the camera to capture the QR code being shown on the website.
2. Decode it and use its value to call the authentication endpoint (it's an HTTPS Callable function).
3. Wait for the response to find out if the authentication was successful or if there's been any errors.

URL endpoints:

- Generate QR code: ${FUNCTION_URL_GETQRCODE}
- Authenticate QR code: ${FUNCTION_URL_AUTHENTICATEQRCODE}
- Cancel generated token: ${FUNCTION_URL_CANCELQRTOKEN}
- Clean up expired tokens: ${FUNCTION_URL_CLEANUPQRTOKENS}
