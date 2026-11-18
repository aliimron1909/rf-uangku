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

/** Widget layar utama: saldo total, ringkasan bulan ini, dan tombol tambah transaksi. */
public class BalanceWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "rf_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    static RemoteViews build(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);
        views.setTextViewText(R.id.widget_balance, prefs.getString("balance", "Rp –"));
        views.setTextViewText(R.id.widget_month, prefs.getString("month", "Buka aplikasi untuk memuat"));
        views.setTextViewText(R.id.widget_updated, prefs.getString("updated", ""));

        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open, flags));
        }
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse("rfuangku://new"));
        add.setPackage(context.getPackageName());
        views.setOnClickPendingIntent(R.id.widget_add, PendingIntent.getActivity(context, 1, add, flags));
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
