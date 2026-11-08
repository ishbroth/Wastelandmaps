package com.wastelandmaps.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.wastelandmaps.app.car.CarHub;

/**
 * The web app's way to talk to the car's screen (Android Auto). It has the same name and calls as the iPhone's, so the web app needs no difference between them:
 *   CarPlay.update({ ...the route, position, places and next turn }), CarPlay.end(), CarPlay.alert({ title, subtitle }), CarPlay.status().
 * Events: "connection" ({ connected }) and "endRequested". Without a car every call is harmless: the state is kept and nothing is drawn.
 */
@CapacitorPlugin(name = "CarPlay")
public class CarPlayPlugin extends Plugin {
    @Override
    public void load() {
        CarHub.get().setEvents(new CarHub.Events() {
            @Override
            public void onConnection(boolean connected) {
                JSObject data = new JSObject();
                data.put("connected", connected);
                notifyListeners("connection", data);
            }

            @Override
            public void onEndRequested() {
                notifyListeners("endRequested", new JSObject());
            }
        });
    }

    @PluginMethod
    public void update(PluginCall call) {
        CarHub.get().update(call.getData());
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        CarHub.get().end();
        call.resolve();
    }

    @PluginMethod
    public void alert(PluginCall call) {
        CarHub.get().alert(call.getString("title", ""), call.getString("subtitle", ""));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject data = new JSObject();
        data.put("connected", CarHub.get().isConnected());
        call.resolve(data);
    }
}
