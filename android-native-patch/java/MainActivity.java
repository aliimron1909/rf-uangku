package com.rf_uangku.app;

import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RfWidgetPlugin.class);
        registerPlugin(RfNotifPlugin.class);
        registerPlugin(RfBiometricPlugin.class);
        registerPlugin(RfSystemBarsPlugin.class);
        registerPlugin(RfUpdatePlugin.class);
        registerPlugin(RfDiagPlugin.class);
        super.onCreate(savedInstanceState);
        setupEdgeToEdge();
    }

    /**
     * Android 11+: aplikasi digambar penuh sampai belakang status bar dan navigation bar (transparan).
     * Ukuran bar dikirim ke CSS lewat plugin; tinggi keyboard diberikan sebagai padding bawah.
     */
    private void setupEdgeToEdge() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        Window window = getWindow();
        window.setDecorFitsSystemWindows(false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        final View content = findViewById(android.R.id.content);
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            RfSystemBarsPlugin.top = bars.top;
            RfSystemBarsPlugin.bottom = bars.bottom;
            Insets ime = insets.getInsets(WindowInsets.Type.ime());
            view.setPadding(0, 0, 0, ime.bottom);
            return insets;
        });
        content.requestApplyInsets();
    }
}
