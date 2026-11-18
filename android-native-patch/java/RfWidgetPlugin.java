package com.rf_uangku.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Jembatan web -> widget: menyimpan teks saldo lalu menyegarkan widget layar utama. */
@CapacitorPlugin(name = "RfWidget")
public class RfWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        SharedPreferences.Editor editor =
            context.getSharedPreferences(BalanceWidgetProvider.PREFS, Context.MODE_PRIVATE).edit();
        editor.putString("balance", call.getString("balance", "Rp 0"));
        editor.putString("month", call.getString("month", ""));
        editor.putString("updated", call.getString("updated", ""));
        editor.apply();
        BalanceWidgetProvider.refresh(context);
        call.resolve();
    }
}
