package com.wastelandmaps.app.car;

import android.os.Handler;
import android.os.Looper;

import androidx.car.app.navigation.NavigationManager;

import org.json.JSONObject;

/**
 * The one place the car's screen (Android Auto) is kept. It does nothing at all until a car connects: Android Auto only starts the car app service (see
 * WastelandCarAppService) when a phone is connected to a car, and with no car none of this is ever used and the phone's own map is all there is.
 *
 * The web app tells it what to show (position, route, places, the next turn) through CarPlayPlugin; the car's map page (the web app in its "car" mode) draws from the
 * JSON as it was sent, and the turn banner and trip estimates come from the fields read out of it here.
 */
public final class CarHub {
    /** Told when a car connects or goes away, and when the person ends the trip on the car's own screen. */
    public interface Events {
        void onConnection(boolean connected);
        void onEndRequested();
    }

    /** The car's screen, which draws what the hub holds. */
    public interface Screen {
        void onState();
        void onAlert(String title, String subtitle);
    }

    private static final CarHub INSTANCE = new CarHub();

    public static CarHub get() {
        return INSTANCE;
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private Events events;
    private Screen screen;
    private NavigationManager navigation;
    private boolean connected;
    private boolean navigating;

    /** What the web app last said, as the car's map page wants it, and the fields the turn banner needs. */
    public volatile String json = "{\"active\":false}";
    public volatile boolean active;
    public volatile String destination = "";
    public volatile String instruction = "";
    public volatile double distanceToTurn;
    public volatile double remainingMeters;
    public volatile double remainingSeconds;

    private CarHub() { }

    public synchronized void setEvents(Events e) {
        events = e;
    }

    public synchronized void attach(Screen s, NavigationManager nav) {
        screen = s;
        navigation = nav;
        connected = true;
        main.post(() -> { if (events != null) events.onConnection(true); });
        // a car that connects mid-route shows the route at once
        if (active) startNavigating();
    }

    public synchronized void detach(Screen s) {
        if (screen != s) return;
        screen = null;
        navigation = null;
        navigating = false;
        connected = false;
        main.post(() -> { if (events != null) events.onConnection(false); });
    }

    public synchronized boolean isConnected() {
        return connected;
    }

    /** The web app's newest state (kept, so a car that connects later shows it). */
    public void update(JSONObject o) {
        json = o.toString();
        active = o.optBoolean("active", false);
        destination = o.optString("destination", "");
        instruction = o.optString("instruction", "");
        distanceToTurn = o.optDouble("distanceToTurn", 0);
        remainingMeters = o.optDouble("remainingMeters", 0);
        remainingSeconds = o.optDouble("remainingSeconds", 0);
        main.post(() -> {
            if (active) startNavigating(); else stopNavigating();
            Screen s;
            synchronized (this) { s = screen; }
            if (s != null) s.onState();
        });
    }

    public void end() {
        json = "{\"active\":false}";
        active = false;
        main.post(() -> {
            stopNavigating();
            Screen s;
            synchronized (this) { s = screen; }
            if (s != null) s.onState();
        });
    }

    /** A banner on the car's screen (a place discovered along the way, say). */
    public void alert(String title, String subtitle) {
        main.post(() -> {
            Screen s;
            synchronized (this) { s = screen; }
            if (s != null) s.onAlert(title, subtitle);
        });
    }

    /** The person ended the trip on the car's own screen. */
    public void requestEnd() {
        main.post(() -> {
            stopNavigating();
            Events e;
            synchronized (this) { e = events; }
            if (e != null) e.onEndRequested();
        });
    }

    private synchronized void startNavigating() {
        if (navigating || navigation == null) return;
        try { navigation.navigationStarted(); navigating = true; } catch (RuntimeException ignored) { /* the car would not take it: the map still shows */ }
    }

    private synchronized void stopNavigating() {
        if (!navigating || navigation == null) return;
        try { navigation.navigationEnded(); } catch (RuntimeException ignored) { /* already ended */ }
        navigating = false;
    }
}
