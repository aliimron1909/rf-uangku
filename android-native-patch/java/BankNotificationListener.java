package com.rf_uangku.app;

import android.app.Notification;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Membaca notifikasi dari aplikasi bank dan e-wallet yang dipantau (hanya bila fitur diaktifkan pengguna).
 * Isi notifikasi hanya disimpan di HP ini (antrean lokal) untuk diurai aplikasi; tidak dikirim ke mana pun.
 */
public class BankNotificationListener extends NotificationListenerService {
    static final String PREFS = "rf_notif";
    private static final Object LOCK = new Object();
    private static final int MAX_QUEUE = 100;

    private static final String[] EXACT = {
        "id.dana", "ovo.id", "com.gojek.app", "com.shopee.id", "com.telkom.mwallet",
        "id.co.bri.brimo", "id.bmri.livin", "src.com.bni", "com.btpn.dc", "com.jago.digitalBanking",
        "id.co.bcadigital.blu", "com.bca", "com.bca.mybca.omni.android",
        "id.co.cimbniaga.mobile.android", "net.myinfosys.PermataMobileX", "com.bsm.activity2",
        "com.bnc.finance", "id.co.seabank.android", "com.seabank.seabank",
    };
    private static final String[] PREFIX = {"com.bca", "id.co.bri", "id.bmri", "com.mandiri", "src.com.bni", "com.jago", "id.co.bcadigital"};

    static boolean watched(String pkg) {
        if (pkg == null) return false;
        for (String item : EXACT) if (item.equals(pkg)) return true;
        for (String item : PREFIX) if (pkg.startsWith(item)) return true;
        return false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (!prefs.getBoolean("enabled", false)) return;
            String pkg = sbn.getPackageName();
            if (!watched(pkg)) return;
            Notification notification = sbn.getNotification();
            if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
            Bundle extras = notification.extras;
            CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            if (text == null) text = extras.getCharSequence(Notification.EXTRA_TEXT);
            if (text == null) return;

            JSONObject item = new JSONObject();
            item.put("id", pkg + ":" + sbn.getPostTime() + ":" + sbn.getId());
            item.put("pkg", pkg);
            item.put("title", title == null ? "" : title.toString());
            item.put("text", text.toString());
            item.put("time", sbn.getPostTime());

            synchronized (LOCK) {
                JSONArray queue = new JSONArray(prefs.getString("queue", "[]"));
                String id = item.getString("id");
                for (int i = 0; i < queue.length(); i++) {
                    if (id.equals(queue.getJSONObject(i).optString("id"))) return;
                }
                queue.put(item);
                JSONArray trimmed = new JSONArray();
                for (int i = Math.max(0, queue.length() - MAX_QUEUE); i < queue.length(); i++) {
                    trimmed.put(queue.get(i));
                }
                prefs.edit().putString("queue", trimmed.toString()).apply();
            }
        } catch (Exception ignored) {
            // Notifikasi yang tidak bisa dibaca dilewati.
        }
    }
}
