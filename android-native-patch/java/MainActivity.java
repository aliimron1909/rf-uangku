package com.rf_uangku.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RfWidgetPlugin.class);
        registerPlugin(RfNotifPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
