package com.rf_uangku.app;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Status bar dan navigation bar transparan (menyatu dengan latar aplikasi) plus ukuran inset untuk CSS. */
@CapacitorPlugin(name = "RfSystemBars")
public class RfSystemBarsPlugin extends Plugin {
    /** Diisi MainActivity dari WindowInsets (piksel). */
    static volatile int top = 0;
    static volatile int bottom = 0;

    @PluginMethod
    public void getInsets(PluginCall call) {
        float density = getContext().getResources().getDisplayMetrics().density;
        JSObject result = new JSObject();
        result.put("top", Math.round(top / density));
        result.put("bottom", Math.round(bottom / density));
        call.resolve(result);
    }

    /** dark = tema gelap aplikasi: ikon bar jadi terang; tema terang: ikon gelap. */
    @PluginMethod
    public void setTheme(PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", true));
        getActivity().runOnUiThread(() -> apply(dark));
        call.resolve();
    }

    private void apply(boolean dark) {
        Window window = getActivity().getWindow();
        View decor = window.getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(dark ? 0 : mask, mask);
            }
        } else {
            // Android lama: bar tidak transparan, jadi diberi warna yang sama dengan latar tema.
            int color = dark ? Color.parseColor("#020617") : Color.parseColor("#F8FAFC");
            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);
            int flags = decor.getSystemUiVisibility();
            int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) light |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            decor.setSystemUiVisibility(dark ? (flags & ~light) : (flags | light));
        }
    }
}
