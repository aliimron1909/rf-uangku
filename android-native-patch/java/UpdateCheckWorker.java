package com.rf_uangku.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * Cek versi baru di latar belakang (tiap beberapa jam, tanpa server) dan tampilkan notifikasi
 * sekali per versi. Mengetuk notifikasi membuka aplikasi dan dialog pembaruan.
 */
public class UpdateCheckWorker extends Worker {
    static final String PREFS = "rf_update";
    static final String KEY_NOTIFY = "notify";
    private static final String KEY_LAST = "last_notified_build";
    private static final String WORK_NAME = "rf_update_check";
    private static final String CHANNEL = "rf_update";
    private static final int NOTIFICATION_ID = 9200;
    private static final int BUILD_OFFSET = 200; // sama dengan BUILD_OFFSET di nativeUpdate.ts
    private static final String RELEASES_URL = "https://api.github.com/repos/aliimron1909/rf-uangku/releases/latest";
    private static final Pattern TAG = Pattern.compile("^native-v([\\d.]+)-(\\d+)$");

    public UpdateCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static void schedule(Context context) {
        Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(UpdateCheckWorker.class, 6, TimeUnit.HOURS)
            .setConstraints(constraints)
            .setInitialDelay(30, TimeUnit.MINUTES)
            .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    static boolean notifyEnabled(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_NOTIFY, true);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!notifyEnabled(context)) return Result.success();
        try {
            JSONObject release = fetchLatest();
            Matcher match = TAG.matcher(release.optString("tag_name", ""));
            if (!match.matches()) return Result.success();
            long build = BUILD_OFFSET + Long.parseLong(match.group(2));
            if (build <= installedBuild(context) || build <= prefs.getLong(KEY_LAST, 0)) return Result.success();
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return Result.success();
            notifyUpdate(context, match.group(1), firstChange(release.optString("body", "")));
            prefs.edit().putLong(KEY_LAST, build).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private static long installedBuild(Context context) throws Exception {
        PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    private static JSONObject fetchLatest() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(RELEASES_URL).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "rf-uangku");
        try {
            if (connection.getResponseCode() != 200) throw new Exception("HTTP " + connection.getResponseCode());
            StringBuilder text = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) text.append(line).append('\n');
            }
            return new JSONObject(text.toString());
        } finally {
            connection.disconnect();
        }
    }

    /** Butir perubahan pertama dari catatan rilis, tanpa awalan "feat:" dan nomor PR. */
    static String firstChange(String body) {
        for (String raw : body.split("\n")) {
            String line = raw.trim();
            if (line.equals("---")) break;
            if (line.isEmpty() || line.matches("(?i)^(co-authored-by|claude-session|https?://|aplikasi android native).*")) continue;
            line = line.replaceFirst("^[-*•]\\s+", "")
                .replaceFirst("(?i)^(feat|fix|chore|refactor|docs|perf|style|test)(\\([^)]*\\))?:\\s*", "")
                .replaceFirst("\\s*\\(#\\d+\\)\\s*$", "")
                .trim();
            if (!line.isEmpty()) return Character.toUpperCase(line.charAt(0)) + line.substring(1);
        }
        return "";
    }

    private static void notifyUpdate(Context context, String version, String change) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Pembaruan aplikasi", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("rfuangku://update")).setPackage(context.getPackageName());
        PendingIntent pending = PendingIntent.getActivity(context, 4, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String text = change.isEmpty() ? "Ketuk untuk melihat perubahan dan memperbarui." : change;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_rf)
            .setContentTitle("RF Uangku v" + version + " tersedia")
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pending)
            .setAutoCancel(true);
        manager.notify(NOTIFICATION_ID, builder.build());
    }
}
