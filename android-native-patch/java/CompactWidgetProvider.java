package com.rf_uangku.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

/** Widget ringkas 4x1: saldo total, keluar/masuk bulan ini, dan tombol tambah. */
public class CompactWidgetProvider extends AppWidgetProvider {
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
        SharedPreferences prefs = WidgetStore.prefs(context);
        int width = WidgetStore.widthDp(manager, id);
        float k = WidgetStore.scale(width / 250f, 0.85f, 1.5f);
        boolean loaded = prefs.contains("expense");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_compact);
        views.setTextViewText(R.id.compact_balance, WidgetStore.money(context, prefs.getString("balance", "Rp –")));
        views.setTextViewTextSize(R.id.compact_balance, TypedValue.COMPLEX_UNIT_SP, 20f * k);
        views.setTextViewTextSize(R.id.compact_title, TypedValue.COMPLEX_UNIT_SP, 11f * k);
        views.setTextViewText(R.id.compact_expense, WidgetStore.money(context, prefs.getString("expense", "Rp 0")));
        views.setTextViewText(R.id.compact_income, WidgetStore.money(context, prefs.getString("income", "Rp 0")));
        for (int text : new int[] {R.id.compact_expense, R.id.compact_income, R.id.compact_expense_label,
                R.id.compact_income_label}) {
            views.setTextViewTextSize(text, TypedValue.COMPLEX_UNIT_SP, 11f * k);
        }
        views.setViewVisibility(R.id.compact_flow, loaded && width >= 220 ? View.VISIBLE : View.GONE);

        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent open = BalanceWidgetProvider.openApp(context);
        if (open != null) views.setOnClickPendingIntent(R.id.compact_root, open);
        Intent add = new Intent(Intent.ACTION_VIEW, Uri.parse("rfuangku://new"));
        add.setPackage(context.getPackageName());
        views.setOnClickPendingIntent(R.id.compact_add, PendingIntent.getActivity(context, 3, add, flags));
        return views;
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, CompactWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }
}
