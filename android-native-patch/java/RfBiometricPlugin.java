package com.rf_uangku.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.atomic.AtomicBoolean;

/** Fingerprint/biometrik asli Android (BiometricPrompt) untuk membuka kunci aplikasi. */
@CapacitorPlugin(name = "RfBiometric")
public class RfBiometricPlugin extends Plugin {
    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        boolean ok = false;
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            BiometricManager manager = context.getSystemService(BiometricManager.class);
            ok = manager != null && manager.canAuthenticate() == BiometricManager.BIOMETRIC_SUCCESS;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            ok = context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_FINGERPRINT);
        }
        result.put("available", ok);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(final PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            call.reject("Fingerprint memerlukan Android 9 atau lebih baru.");
            return;
        }
        final String title = call.getString("title", "RF Uangku");
        final String subtitle = call.getString("subtitle", "");
        final String negative = call.getString("negative", "Batal");
        final AtomicBoolean done = new AtomicBoolean(false);
        getActivity().runOnUiThread(() -> {
            try {
                Context context = getContext();
                BiometricPrompt prompt = new BiometricPrompt.Builder(context)
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setNegativeButton(negative, context.getMainExecutor(), (dialog, which) -> finish(call, done, false, "Dibatalkan."))
                    .build();
                prompt.authenticate(new CancellationSignal(), context.getMainExecutor(), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        finish(call, done, true, null);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        finish(call, done, false, errString == null ? "Fingerprint gagal." : errString.toString());
                    }
                });
            } catch (Exception e) {
                finish(call, done, false, "Fingerprint tidak dapat dimulai.");
            }
        });
    }

    private void finish(PluginCall call, AtomicBoolean done, boolean ok, String error) {
        if (!done.compareAndSet(false, true)) return;
        JSObject result = new JSObject();
        result.put("ok", ok);
        if (error != null) result.put("error", error);
        call.resolve(result);
    }
}
