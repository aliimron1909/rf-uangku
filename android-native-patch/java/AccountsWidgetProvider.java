package com.rf_uangku.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget saldo per rekening; jumlah baris menyesuaikan tinggi widget (maksimal 6). */
public class AccountsWidgetProvider extends AppWidgetProvider {
    private static final int[] NAMES = {R.id.acc_name_1, R.id.acc_name_2, R.id.acc_name_3, R.id.acc_name_4, R.id.acc_name_5, R.id.acc_name_6};
    private static final int[] BALANCES = {R.id.acc_bal_1, R.id.acc_bal_2, R.id.acc_bal_3, R.id.acc_bal_4, R.id.acc_bal_5, R.id.acc_bal_6};
    private static final int[] ROWS = {R.id.acc_row_1, R.id.acc_row_2, R.id.acc_row_3, R.id.acc_row_4, R.id.acc_row_5, R.id.acc_row_6};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, build(context, manager, id));
    }

    static RemoteViews build(Context context, AppWidgetManager manager, int id) {
        android.content.SharedPreferences prefs = WidgetStore.prefs(context);
        int width = WidgetStore.widthDp(manager, id);
        int height = WidgetStore.heightDp(manager, id, 180);
        float k = WidgetStore.scale(width / 250f, 0.9f, 1.6f);
        // Tiap baris sekitar 30dp setelah judul dan bantalan.
        int capacity = (int) WidgetStore.scale((height - 62) / (30f * k), 1f, 6f);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_accounts);
        views.setTextViewText(R.id.acc_total, WidgetStore.money(context, prefs.getString("balance", "Rp –")));
        views.setTextViewTextSize(R.id.acc_title, TypedValue.COMPLEX_UNIT_SP, 13f * k);
        views.setTextViewTextSize(R.id.acc_total, TypedValue.COMPLEX_UNIT_SP, 16f * k);
        int shown = 0;
        try {
            JSONArray list = new JSONArray(prefs.getString("accounts", "[]"));
            for (int i = 0; i < list.length() && i < capacity; i++) {
                JSONObject item = list.getJSONObject(i);
                views.setTextViewText(NAMES[i], item.optString("n"));
                views.setTextViewText(BALANCES[i], WidgetStore.money(context, item.optString("b")));
                views.setTextViewTextSize(NAMES[i], TypedValue.COMPLEX_UNIT_SP, 14f * k);
                views.setTextViewTextSize(BALANCES[i], TypedValue.COMPLEX_UNIT_SP, 14f * k);
                views.setViewVisibility(ROWS[i], View.VISIBLE);
                shown++;
            }
        } catch (Exception ignored) {
            shown = 0;
        }
        for (int i = shown; i < ROWS.length; i++) {
            views.setViewVisibility(ROWS[i], View.GONE);
        }
        views.setViewVisibility(R.id.acc_empty, shown == 0 ? View.VISIBLE : View.GONE);
        android.app.PendingIntent open = BalanceWidgetProvider.openApp(context);
        if (open != null) views.setOnClickPendingIntent(R.id.acc_root, open);
        return views;
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, AccountsWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }
}
