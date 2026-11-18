package com.rf_uangku.app;

import android.content.Context;
import android.content.SharedPreferences;

/** Penyimpanan bersama untuk semua widget: data dari aplikasi web dan pilihan sembunyikan saldo. */
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

    static void refreshAll(Context context) {
        BalanceWidgetProvider.refresh(context);
        AccountsWidgetProvider.refresh(context);
        TrendWidgetProvider.refresh(context);
    }
}
