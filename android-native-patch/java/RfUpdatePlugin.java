package com.rf_uangku.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Mengunduh APK pembaruan dari Releases GitHub di dalam aplikasi, lalu membuka pemasang Android. */
@CapacitorPlugin(name = "RfUpdate")
public class RfUpdatePlugin extends Plugin {
    private static final String ALLOWED_PREFIX = "https://github.com/aliimron1909/rf-uangku/releases/download/";
    private static volatile String state = "idle";
    private static volatile int percent = 0;
    private static volatile String error = "";

    private File apkFile(Context context) {
        File dir = new File(context.getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, "rf-uangku-update.apk");
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean ok = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject result = new JSObject();
        result.put("allowed", ok);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url", "");
        if (url == null || !url.startsWith(ALLOWED_PREFIX)) {
            call.reject("Alamat unduhan tidak dikenal.");
            return;
        }
        if ("downloading".equals(state)) {
            call.resolve();
            return;
        }
        state = "downloading";
        percent = 0;
        error = "";
        final File target = apkFile(getContext());
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                if (connection.getResponseCode() / 100 != 2) {
                    throw new Exception("Server menjawab " + connection.getResponseCode());
                }
                long total = connection.getContentLengthLong();
                File partial = new File(target.getParentFile(), "download.part");
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[64 * 1024];
                    long read = 0;
                    int count;
                    while ((count = in.read(buffer)) != -1) {
                        out.write(buffer, 0, count);
                        read += count;
                        if (total > 0) percent = (int) (read * 100 / total);
                    }
                }
                if (target.exists() && !target.delete()) throw new Exception("Gagal mengganti berkas lama.");
                if (!partial.renameTo(target)) throw new Exception("Gagal menyimpan berkas.");
                percent = 100;
                state = "done";
            } catch (Exception e) {
                error = e.getMessage() == null ? "Unduhan gagal." : e.getMessage();
                state = "error";
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
        call.resolve();
    }

    @PluginMethod
    public void progress(PluginCall call) {
        JSObject result = new JSObject();
        result.put("state", state);
        result.put("percent", percent);
        result.put("error", error);
        call.resolve(result);
    }

    @PluginMethod
    public void install(PluginCall call) {
        Context context = getContext();
        File file = apkFile(context);
        if (!file.exists()) {
            call.reject("Berkas pembaruan belum diunduh.");
            return;
        }
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        call.resolve();
    }
}
