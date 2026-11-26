package com.rf_uangku.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
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
    private static final int[] WHENS_HOT = {R.id.due_when_hot_1, R.id.due_when_hot_2, R.id.due_when_hot_3, R.id.due_when_hot_4};
    private static final int[] AMOUNTS = {R.id.due_amount_1, R.id.due_amount_2, R.id.due_amount_3, R.id.due_amount_4};
    private static final int[] AMOUNTS_GOOD = {R.id.due_amount_good_1, R.id.due_amount_good_2, R.id.due_amount_good_3, R.id.due_amount_good_4};
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
        int height = WidgetStore.heightDp(manager, id, 110);
        float k = WidgetStore.scale(width / 250f, 0.85f, 1.3f);
        // Satu baris insight bila tinggi 4x2; dua baris bila diperbesar. Tiap baris tagihan sekitar 20dp.
        int insightLines = height >= 190 ? 2 : 1;
        float insightHeight = insightLines * 14f + 8f;
        int capacity = (int) WidgetStore.scale((height - 40f - insightHeight) / (20f * k), 1f, 4f);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_due);
        views.setTextViewTextSize(R.id.due_title, TypedValue.COMPLEX_UNIT_SP, 10f * k);
        int shown = 0;
        try {
            JSONArray list = new JSONArray(prefs.getString("dues", "[]"));
            for (int i = 0; i < list.length() && i < capacity; i++) {
                JSONObject item = list.getJSONObject(i);
                boolean hot = item.optBoolean("hot", false);
                boolean good = "p".equals(item.optString("k"));
                String when = item.optString("w");
                String amount = WidgetStore.money(context, item.optString("a"));
                views.setTextViewText(NAMES[i], item.optString("n"));
                views.setTextViewText(WHENS[i], when);
                views.setTextViewText(WHENS_HOT[i], when);
                views.setViewVisibility(WHENS[i], hot ? View.GONE : View.VISIBLE);
                views.setViewVisibility(WHENS_HOT[i], hot ? View.VISIBLE : View.GONE);
                views.setTextViewText(AMOUNTS[i], amount);
                views.setTextViewText(AMOUNTS_GOOD[i], amount);
                views.setViewVisibility(AMOUNTS[i], good ? View.GONE : View.VISIBLE);
                views.setViewVisibility(AMOUNTS_GOOD[i], good ? View.VISIBLE : View.GONE);
                views.setTextViewTextSize(NAMES[i], TypedValue.COMPLEX_UNIT_SP, 11f * k);
                for (int text : new int[] {WHENS[i], WHENS_HOT[i]}) {
                    views.setTextViewTextSize(text, TypedValue.COMPLEX_UNIT_SP, 10f * k);
                }
                for (int text : new int[] {AMOUNTS[i], AMOUNTS_GOOD[i]}) {
                    views.setTextViewTextSize(text, TypedValue.COMPLEX_UNIT_SP, 11f * k);
                }
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
        views.setTextViewTextSize(R.id.due_empty, TypedValue.COMPLEX_UNIT_SP, 11f * k);

        int lines = 0;
        try {
            JSONArray list = new JSONArray(prefs.getString("insights", "[]"));
            int max = insightLines;
            for (int i = 0; i < list.length() && i < max; i++) {
                views.setTextViewText(INSIGHTS[i], list.getString(i));
                views.setTextViewTextSize(INSIGHTS[i], TypedValue.COMPLEX_UNIT_SP, 10f * k);
                views.setViewVisibility(INSIGHTS[i], View.VISIBLE);
                lines++;
            }
        } catch (Exception ignored) {
            lines = 0;
        }
        for (int i = lines; i < INSIGHTS.length; i++) {
            views.setViewVisibility(INSIGHTS[i], View.GONE);
        }
        views.setViewVisibility(R.id.due_insight_box, lines > 0 ? View.VISIBLE : View.GONE);

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
