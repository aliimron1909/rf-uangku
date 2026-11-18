package com.rf_uangku.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Jembatan web -> pembaca notifikasi bank/e-wallet. */
@CapacitorPlugin(name = "RfNotif")
public class RfNotifPlugin extends Plugin {
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(BankNotificationListener.PREFS, Context.MODE_PRIVATE);
    }

    private boolean accessGranted() {
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        return enabled != null && enabled.contains(getContext().getPackageName());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("access", accessGranted());
        result.put("enabled", prefs().getBoolean("enabled", false));
        call.resolve(result);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        prefs().edit().putBoolean("enabled", Boolean.TRUE.equals(call.getBoolean("enabled", false))).apply();
        call.resolve();
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openAppInfo(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** Mengambil dan mengosongkan antrean notifikasi yang terbaca. */
    @PluginMethod
    public void drain(PluginCall call) {
        SharedPreferences prefs = prefs();
        JSObject result = new JSObject();
        try {
            synchronized (RfNotifPlugin.class) {
                String raw = prefs.getString("queue", "[]");
                prefs.edit().putString("queue", "[]").apply();
                result.put("items", new JSArray(raw));
            }
        } catch (Exception e) {
            result.put("items", new JSArray());
        }
        call.resolve(result);
    }
}
