package com.rf_uangku.app;

import android.app.AlarmManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Diagnosis notifikasi: izin alarm tepat waktu, hemat baterai, dan pintasan ke pengaturan sistem. */
@CapacitorPlugin(name = "RfDiag")
public class RfDiagPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("notificationsEnabled", NotificationManagerCompat.from(context).areNotificationsEnabled());
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            exact = alarms != null && alarms.canScheduleExactAlarms();
        }
        result.put("exactAlarm", exact);
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        result.put("batteryUnrestricted", power != null && power.isIgnoringBatteryOptimizations(context.getPackageName()));
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        result.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    private void start(PluginCall call, Intent intent) {
        try {
            getContext().startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "tidak bisa membuka pengaturan" : e.getMessage());
        }
    }

    private Intent appDetails() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            start(call, new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
        } else {
            start(call, appDetails());
        }
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        start(call, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        start(call, intent);
    }

    /** Layar "Mulai otomatis" bawaan Xiaomi/Oppo/Vivo/Huawei bila ada; jika tidak, info aplikasi. */
    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        String[][] candidates = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
        };
        for (String[] candidate : candidates) {
            Intent intent = new Intent().setComponent(new ComponentName(candidate[0], candidate[1]))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                try {
                    getContext().startActivity(intent);
                    call.resolve();
                    return;
                } catch (Exception ignored) {
                    // lanjut ke kandidat berikutnya
                }
            }
        }
        start(call, appDetails());
    }
}
