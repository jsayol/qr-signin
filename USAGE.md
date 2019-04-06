Your mod is installed and almost ready!

You need to set the correct permissions for the database path that will store the temporary QR code information. You should add a rule that looks like this:

```json
"${QR_RTDB_PATH}": {
  ".read": false,
  ".write": false,
  "$QR": {
    "ct": {
      ".read": true
    }
  }
}
```
