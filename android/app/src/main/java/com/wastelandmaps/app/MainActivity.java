package com.wastelandmaps.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the app's own plugins, beside the ones Capacitor finds by itself (this one talks to the car's screen)
        registerPlugin(CarPlayPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
