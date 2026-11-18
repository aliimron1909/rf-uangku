package com.rf_uangku.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

/** Widget saldo: saldo total, ringkasan bulan ini, budget, tombol sembunyikan dan tombol tambah. */
public class BalanceWidgetProvider extends AppWidgetProvider {
    static final String ACTION_TOGGLE_HIDDEN = "com.rf_uangku.app.TOGGLE_HIDDEN";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_TOGGLE_HIDDEN.equals(intent.getAction())) {
            boolean next = !WidgetStore.hidden(context);
            WidgetStore.prefs(context).edit().putBoolean(WidgetStore.HIDDEN, next).apply();
            WidgetStore.refreshAll(context);
            return;
        }
        super.onReceive(context, intent);
    }

    static PendingIntent openApp(Context context) {
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open == null) return null;
        return PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static RemoteViews build(Context context) {
        SharedPreferences prefs = WidgetStore.prefs(context);
        boolean hidden = WidgetStore.hidden(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);
        views.setTextViewText(R.id.widget_balance, WidgetStore.money(context, prefs.getString("balance", "Rp –")));
        String expense = WidgetStore.money(context, prefs.getString("expense", "Rp 0"));
        String income = WidgetStore.money(context, prefs.getString("income", "Rp 0"));
        String month = prefs.contains("expense")
            ? "Bulan ini  −" + expense + "  +" + income
            : "Buka aplikasi untuk memuat";
        views.setTextViewText(R.id.widget_month, month);
        String budget = prefs.getString("budget", "");
        views.setTextViewText(R.id.widget_budget, budget);
        views.setViewVisibility(R.id.widget_budget, budget.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        views.setTextViewText(R.id.widget_updated, prefs.getString("updated", ""));
        views.setTextViewText(R.id.widget_eye, hidden ? "Tampilkan" : "Sembunyikan");

        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent open = openApp(context);
        if (open != null) views.setOnClickPendingIntent(R.id.widget_root, open);
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse("rfuangku://new"));
        add.setPackage(context.getPackageName());
        views.setOnClickPendingIntent(R.id.widget_add, PendingIntent.getActivity(context, 1, add, flags));
        Intent toggle = new Intent(context, BalanceWidgetProvider.class).setAction(ACTION_TOGGLE_HIDDEN);
        views.setOnClickPendingIntent(R.id.widget_eye, PendingIntent.getBroadcast(context, 2, toggle, flags));
        return views;
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BalanceWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }
}
