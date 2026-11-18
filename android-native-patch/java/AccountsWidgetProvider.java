package com.rf_uangku.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget saldo per rekening (maksimal 6 baris teratas). */
public class AccountsWidgetProvider extends AppWidgetProvider {
    private static final int[] NAMES = {R.id.acc_name_1, R.id.acc_name_2, R.id.acc_name_3, R.id.acc_name_4, R.id.acc_name_5, R.id.acc_name_6};
    private static final int[] BALANCES = {R.id.acc_bal_1, R.id.acc_bal_2, R.id.acc_bal_3, R.id.acc_bal_4, R.id.acc_bal_5, R.id.acc_bal_6};
    private static final int[] ROWS = {R.id.acc_row_1, R.id.acc_row_2, R.id.acc_row_3, R.id.acc_row_4, R.id.acc_row_5, R.id.acc_row_6};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    static RemoteViews build(Context context) {
        android.content.SharedPreferences prefs = WidgetStore.prefs(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_accounts);
        views.setTextViewText(R.id.acc_total, WidgetStore.money(context, prefs.getString("balance", "Rp –")));
        int shown = 0;
        try {
            JSONArray list = new JSONArray(prefs.getString("accounts", "[]"));
            for (int i = 0; i < list.length() && i < ROWS.length; i++) {
                JSONObject item = list.getJSONObject(i);
                views.setTextViewText(NAMES[i], item.optString("n"));
                views.setTextViewText(BALANCES[i], WidgetStore.money(context, item.optString("b")));
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
            manager.updateAppWidget(id, build(context));
        }
    }
}
