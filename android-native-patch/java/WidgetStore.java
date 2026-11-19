package com.rf_uangku.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;

/** Penyimpanan bersama untuk semua widget: data dari aplikasi web, pilihan sembunyikan saldo, dan ukuran widget. */
final class WidgetStore {
    static final String PREFS = "rf_widget";
    static final String HIDDEN = "hidden";

    private WidgetStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean hidden(Context context) {
        return prefs(context).getBoolean(HIDDEN, false);
    }

    /** Nominal disamarkan saat saldo disembunyikan. */
    static String money(Context context, String value) {
        return hidden(context) ? "Rp ••••••" : value;
    }

    /** Lebar widget saat ini (dp) menurut peluncur; 250 bila tidak diketahui. */
    static int widthDp(AppWidgetManager manager, int id) {
        Bundle options = manager.getAppWidgetOptions(id);
        int width = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        return width > 0 ? width : 250;
    }

    /** Tinggi widget saat ini (dp) menurut peluncur; 110 bila tidak diketahui. */
    static int heightDp(AppWidgetManager manager, int id, int fallback) {
        Bundle options = manager.getAppWidgetOptions(id);
        int height = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        return height > 0 ? height : fallback;
    }

    /** Faktor skala huruf: widget diperbesar atau diperkecil, teks ikut menyesuaikan. */
    static float scale(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    static void refreshAll(Context context) {
        BalanceWidgetProvider.refresh(context);
        AccountsWidgetProvider.refresh(context);
        TrendWidgetProvider.refresh(context);
        CompactWidgetProvider.refresh(context);
    }
}
