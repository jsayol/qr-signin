package com.jsayol.qrsignin;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.support.annotation.NonNull;
import android.support.design.widget.Snackbar;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import com.firebase.ui.auth.AuthUI;
import com.google.android.gms.tasks.Continuation;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.functions.FirebaseFunctions;
import com.google.firebase.functions.HttpsCallableResult;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity implements View.OnClickListener {
    private static final String TAG = "MainActivity";
    private static final int RC_SIGN_IN = 9001;
    private static final int RC_QR_TOKEN = 9002;
    private static final String AUTHENTICATE_QR_CODE_ENDPOINT = "authenticateQRCode";

    private FirebaseAuth mAuth;
    private FirebaseFunctions mFunctions;

    private TextView mStatusView;
    private TextView mDetailView;
    private Vibrator vibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mAuth = FirebaseAuth.getInstance();
        mFunctions = FirebaseFunctions.getInstance();

        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        mStatusView = findViewById(R.id.status);
        mDetailView = findViewById(R.id.detail);

        findViewById(R.id.signInButton).setOnClickListener(this);
        findViewById(R.id.signOutButton).setOnClickListener(this);
        findViewById(R.id.qrScannerButton).setOnClickListener(this);
    }

    @Override
    protected void onStart() {
        super.onStart();
        updateUI(mAuth.getCurrentUser());
    }

    private void showSnackbar(String message) {
        Snackbar.make(findViewById(android.R.id.content), message, Snackbar.LENGTH_SHORT).show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == RC_SIGN_IN) {
            if (resultCode == RESULT_OK) {
                // Sign in succeeded
                updateUI(mAuth.getCurrentUser());
            } else {
                // Sign in failed
                Toast.makeText(this, "Sign In Failed", Toast.LENGTH_SHORT).show();
                updateUI(null);
            }
        } else if (requestCode == RC_QR_TOKEN) {
            if (data != null) {
                String qrToken = data.getStringExtra("qrToken");

                // Vibrate for 250 milliseconds
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(250, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    // deprecated in API 26
                    vibrator.vibrate(250);
                }

                Task<String> authTask = authenticateQRCode(qrToken);
                authTask.addOnCompleteListener(new OnCompleteListener<String>() {
                    @Override
                    public void onComplete(@NonNull Task<String> task) {
                        if (task.isSuccessful()) {
                            // Task completed successfully
                            String result = task.getResult();
                            Log.i(TAG, "Web client authenticated correctly: " + result);
                            showSnackbar("Web client authenticated correctly!");
                        } else {
                            // Task failed with an exception
                            Exception exception = task.getException();
                            Log.i(TAG, "Failed to authenticate web client: " + exception);
                            showSnackbar("Failed to authenticate web client.");
                        }
                    }
                });
            }
        }
    }

    private void startSignIn() {
        // Build FirebaseUI sign in intent. For documentation on this operation and all
        Intent intent = AuthUI.getInstance()
                .createSignInIntentBuilder()
                .setIsSmartLockEnabled(!BuildConfig.DEBUG, true)
                .setAvailableProviders(Arrays.asList(
                        new AuthUI.IdpConfig.GoogleBuilder().build(),
                        new AuthUI.IdpConfig.EmailBuilder().build()
                ))
//                .setLogo(R.mipmap.ic_launcher)
                .build();

        startActivityForResult(intent, RC_SIGN_IN);
    }

    private void updateUI(FirebaseUser user) {
        if (user != null) {
            // Signed in
            mStatusView.setText(getString(R.string.firebaseui_status_fmt, user.getEmail()));
            mDetailView.setText(getString(R.string.id_fmt, user.getUid()));

            findViewById(R.id.signInButton).setVisibility(View.GONE);
            findViewById(R.id.signOutButton).setVisibility(View.VISIBLE);
            findViewById(R.id.qrScannerButton).setVisibility(View.VISIBLE);
        } else {
            // Signed out
            mStatusView.setText(R.string.signed_out);
            mDetailView.setText(null);

            findViewById(R.id.signInButton).setVisibility(View.VISIBLE);
            findViewById(R.id.signOutButton).setVisibility(View.GONE);
            findViewById(R.id.qrScannerButton).setVisibility(View.GONE);
        }
    }

    private void signOut() {
        AuthUI.getInstance().signOut(this);
        updateUI(null);
    }

    private void scanQRCode() {
        Intent qrScannerIntent = new Intent(getApplicationContext(), QRScannerActivity.class);
        qrScannerIntent.putExtra("requestCode", RC_QR_TOKEN);
        startActivityForResult(qrScannerIntent, RC_QR_TOKEN);
    }

    @Override
    public void onClick(View view) {
        switch (view.getId()) {
            case R.id.signInButton:
                startSignIn();
                break;
            case R.id.signOutButton:
                signOut();
                break;
            case R.id.qrScannerButton:
                scanQRCode();
                break;
        }
    }

    private Task<String> authenticateQRCode(String qrToken) {
        // Create the arguments to the callable function.
        Map<String, Object> data = new HashMap<>();
        data.put("token", qrToken);

        return mFunctions
                .getHttpsCallable(AUTHENTICATE_QR_CODE_ENDPOINT)
                .call(data)
                .continueWith(new Continuation<HttpsCallableResult, String>() {
                    @Override
                    public String then(@NonNull Task<HttpsCallableResult> task) throws Exception {
                        // This continuation runs on either success or failure, but if the task
                        // has failed then getResult() will throw an Exception which will be
                        // propagated down.
                        String result = (String) task.getResult().getData();
                        return result;
                    }
                });
    }

}
