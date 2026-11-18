package com.rf_uangku.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.util.TypedValue;
import android.util.Base64;
import android.view.View;
import android.widget.RemoteViews;

/** Widget tren pemasukan vs pengeluaran; ketuk label periode untuk ganti harian/mingguan/bulanan/tahunan. */
public class TrendWidgetProvider extends AppWidgetProvider {
    static final String ACTION_CYCLE = "com.rf_uangku.app.CYCLE_TREND";
    private static final String[] KEYS = {"daily", "weekly", "monthly", "yearly"};
    private static final String[] LABELS = {"Harian · 14 hari", "Mingguan · 8 minggu", "Bulanan · 12 bulan", "Tahunan · 5 tahun"};

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

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_CYCLE.equals(intent.getAction())) {
            SharedPreferences prefs = WidgetStore.prefs(context);
            int next = (prefs.getInt("trend_period", 2) + 1) % KEYS.length;
            prefs.edit().putInt("trend_period", next).apply();
            refresh(context);
            return;
        }
        super.onReceive(context, intent);
    }

    static RemoteViews build(Context context, AppWidgetManager manager, int id) {
        SharedPreferences prefs = WidgetStore.prefs(context);
        float k = WidgetStore.scale(Math.min(WidgetStore.widthDp(manager, id) / 250f, WidgetStore.heightDp(manager, id, 170) / 170f), 0.85f, 1.6f);
        int period = prefs.getInt("trend_period", 2);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_trend);
        views.setTextViewTextSize(R.id.trend_title, TypedValue.COMPLEX_UNIT_SP, 13f * k);
        views.setTextViewTextSize(R.id.trend_period, TypedValue.COMPLEX_UNIT_SP, 11f * k);
        views.setTextViewTextSize(R.id.trend_summary, TypedValue.COMPLEX_UNIT_SP, 13f * k);
        views.setTextViewText(R.id.trend_period, LABELS[period] + "  ▸");
        String summary = prefs.getString("sum_" + KEYS[period], "");
        views.setTextViewText(R.id.trend_summary, summary.isEmpty() ? "Buka aplikasi untuk memuat" : WidgetStore.hidden(context) ? "Nominal disembunyikan" : summary);
        String chart = prefs.getString("chart_" + KEYS[period], "");
        boolean drawn = false;
        if (!chart.isEmpty()) {
            try {
                byte[] bytes = Base64.decode(chart, Base64.DEFAULT);
                Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bitmap != null) {
                    views.setImageViewBitmap(R.id.trend_chart, bitmap);
                    drawn = true;
                }
            } catch (Exception ignored) {
                drawn = false;
            }
        }
        views.setViewVisibility(R.id.trend_chart, drawn ? View.VISIBLE : View.INVISIBLE);
        PendingIntent open = BalanceWidgetProvider.openApp(context);
        if (open != null) views.setOnClickPendingIntent(R.id.trend_root, open);
        Intent cycle = new Intent(context, TrendWidgetProvider.class).setAction(ACTION_CYCLE);
        views.setOnClickPendingIntent(R.id.trend_period, PendingIntent.getBroadcast(context, 3, cycle,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return views;
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TrendWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }
}
