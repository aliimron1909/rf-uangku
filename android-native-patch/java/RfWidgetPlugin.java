package com.rf_uangku.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Iterator;

/** Jembatan web -> widget: menyimpan data lalu menyegarkan semua widget layar utama. */
@CapacitorPlugin(name = "RfWidget")
public class RfWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        SharedPreferences.Editor editor = WidgetStore.prefs(context).edit();
        String[] keys = {"balance", "income", "expense", "budget", "updated", "accounts"};
        for (String key : keys) {
            if (call.hasOption(key)) editor.putString(key, call.getString(key, ""));
        }
        putMap(editor, call.getObject("charts"), "chart_");
        putMap(editor, call.getObject("summaries"), "sum_");
        editor.apply();
        WidgetStore.refreshAll(context);
        call.resolve();
    }

    private void putMap(SharedPreferences.Editor editor, JSObject map, String prefix) {
        if (map == null) return;
        Iterator<String> it = map.keys();
        while (it.hasNext()) {
            String key = it.next();
            editor.putString(prefix + key, map.optString(key, ""));
        }
    }

    @PluginMethod
    public void setHidden(PluginCall call) {
        Context context = getContext();
        WidgetStore.prefs(context).edit().putBoolean(WidgetStore.HIDDEN, Boolean.TRUE.equals(call.getBoolean("hidden", false))).apply();
        WidgetStore.refreshAll(context);
        call.resolve();
    }

    @PluginMethod
    public void getHidden(PluginCall call) {
        JSObject result = new JSObject();
        result.put("hidden", WidgetStore.hidden(getContext()));
        call.resolve(result);
    }
}
