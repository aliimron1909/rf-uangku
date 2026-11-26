package com.rf_uangku.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Widget jatuh tempo: tagihan berulang, hutang dan piutang terdekat, plus insight bulan ini. */
public class DueWidgetProvider extends AppWidgetProvider {
    private static final int[] ROWS = {R.id.due_row_1, R.id.due_row_2, R.id.due_row_3, R.id.due_row_4};
    private static final int[] NAMES = {R.id.due_name_1, R.id.due_name_2, R.id.due_name_3, R.id.due_name_4};
    private static final int[] WHENS = {R.id.due_when_1, R.id.due_when_2, R.id.due_when_3, R.id.due_when_4};
    private static final int[] AMOUNTS = {R.id.due_amount_1, R.id.due_amount_2, R.id.due_amount_3, R.id.due_amount_4};
    private static final int[] INSIGHTS = {R.id.due_insight_1, R.id.due_insight_2};

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
        int height = WidgetStore.heightDp(manager, id, 180);
        float k = WidgetStore.scale(width / 250f, 0.9f, 1.5f);
        boolean showInsight = height >= 150;
        // Tiap baris sekitar 36dp; sisanya untuk judul dan (bila muat) insight.
        int reserved = showInsight ? 120 : 40;
        int capacity = (int) WidgetStore.scale((height - reserved) / (36f * k), 1f, 4f);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_due);
        views.setTextViewTextSize(R.id.due_title, TypedValue.COMPLEX_UNIT_SP, 12f * k);
        int shown = 0;
        try {
            JSONArray list = new JSONArray(prefs.getString("dues", "[]"));
            for (int i = 0; i < list.length() && i < capacity; i++) {
                JSONObject item = list.getJSONObject(i);
                String kind = item.optString("k");
                boolean hot = item.optBoolean("hot", false);
                views.setTextViewText(NAMES[i], item.optString("n"));
                views.setTextViewText(WHENS[i], item.optString("w"));
                views.setTextColor(WHENS[i], Color.parseColor(hot ? "#FDA4AF" : "#CBD5E1"));
                views.setTextViewText(AMOUNTS[i], WidgetStore.money(context, item.optString("a")));
                views.setTextColor(AMOUNTS[i], Color.parseColor("p".equals(kind) ? "#86EFAC" : "#FFFFFF"));
                views.setTextViewTextSize(NAMES[i], TypedValue.COMPLEX_UNIT_SP, 13f * k);
                views.setTextViewTextSize(WHENS[i], TypedValue.COMPLEX_UNIT_SP, 11f * k);
                views.setTextViewTextSize(AMOUNTS[i], TypedValue.COMPLEX_UNIT_SP, 13f * k);
                views.setViewVisibility(ROWS[i], View.VISIBLE);
                shown++;
            }
        } catch (Exception ignored) {
            shown = 0;
        }
        for (int i = shown; i < ROWS.length; i++) {
            views.setViewVisibility(ROWS[i], View.GONE);
        }
        views.setViewVisibility(R.id.due_empty, shown == 0 ? View.VISIBLE : View.GONE);
        views.setTextViewTextSize(R.id.due_empty, TypedValue.COMPLEX_UNIT_SP, 12f * k);

        int lines = 0;
        try {
            JSONArray list = new JSONArray(prefs.getString("insights", "[]"));
            int max = height >= 220 ? 2 : 1;
            for (int i = 0; i < list.length() && i < max; i++) {
                views.setTextViewText(INSIGHTS[i], list.getString(i));
                views.setTextViewTextSize(INSIGHTS[i], TypedValue.COMPLEX_UNIT_SP, 12f * k);
                views.setViewVisibility(INSIGHTS[i], View.VISIBLE);
                lines++;
            }
        } catch (Exception ignored) {
            lines = 0;
        }
        for (int i = lines; i < INSIGHTS.length; i++) {
            views.setViewVisibility(INSIGHTS[i], View.GONE);
        }
        views.setViewVisibility(R.id.due_insight_box, showInsight && lines > 0 ? View.VISIBLE : View.GONE);

        android.app.PendingIntent open = BalanceWidgetProvider.openApp(context);
        if (open != null) views.setOnClickPendingIntent(R.id.due_root, open);
        return views;
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, DueWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }
}
