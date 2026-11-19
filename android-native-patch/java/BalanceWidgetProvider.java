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

/** Widget saldo: saldo total, keluar/masuk bulan ini, budget, tombol sembunyikan dan tombol tambah. */
public class BalanceWidgetProvider extends AppWidgetProvider {
    static final String ACTION_TOGGLE_HIDDEN = "com.rf_uangku.app.TOGGLE_HIDDEN";

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

    static RemoteViews build(Context context, AppWidgetManager manager, int id) {
        SharedPreferences prefs = WidgetStore.prefs(context);
        boolean hidden = WidgetStore.hidden(context);
        int width = WidgetStore.widthDp(manager, id);
        int height = WidgetStore.heightDp(manager, id, 110);
        float k = WidgetStore.scale(Math.min(width / 250f, height / 110f), 0.85f, 1.8f);
        boolean tall = height >= 135; // budget hanya bila cukup tinggi; keluar/masuk lebih penting

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);
        views.setTextViewText(R.id.widget_balance, WidgetStore.money(context, prefs.getString("balance", "Rp –")));
        views.setTextViewTextSize(R.id.widget_balance, TypedValue.COMPLEX_UNIT_SP, 30f * k);
        views.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, 13f * k);
        views.setTextViewTextSize(R.id.widget_expense, TypedValue.COMPLEX_UNIT_SP, 13f * k);
        views.setTextViewTextSize(R.id.widget_income, TypedValue.COMPLEX_UNIT_SP, 13f * k);
        views.setTextViewTextSize(R.id.widget_budget, TypedValue.COMPLEX_UNIT_SP, 11f * k);

        boolean loaded = prefs.contains("expense");
        views.setTextViewText(R.id.widget_expense, loaded
            ? "Keluar  " + WidgetStore.money(context, prefs.getString("expense", "Rp 0")) : "Buka aplikasi untuk memuat");
        views.setTextViewText(R.id.widget_income, loaded
            ? "Masuk  " + WidgetStore.money(context, prefs.getString("income", "Rp 0")) : "");
        views.setViewVisibility(R.id.widget_income, loaded ? View.VISIBLE : View.GONE);

        String budget = prefs.getString("budget", "");
        int pct = Math.max(0, Math.min(100, prefs.getInt("budget_pct", 0)));
        boolean showBudget = !budget.isEmpty() && tall;
        views.setViewVisibility(R.id.widget_budget_group, showBudget ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.widget_budget, budget);
        views.setProgressBar(R.id.widget_progress, 100, pct, false);
        views.setTextViewText(R.id.widget_updated, prefs.getString("updated", ""));
        views.setViewVisibility(R.id.widget_updated, height >= 130 ? View.VISIBLE : View.GONE);
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
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }
}
