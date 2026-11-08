package com.wastelandmaps.app.car;

import android.app.Presentation;
import android.content.Context;
import android.graphics.Color;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.DateTimeWithZone;
import androidx.car.app.model.Distance;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.model.Maneuver;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.RoutingInfo;
import androidx.car.app.navigation.model.Step;
import androidx.car.app.navigation.model.TravelEstimate;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import com.wastelandmaps.app.R;

import java.util.Locale;
import java.util.TimeZone;

/**
 * The car's screen: the same map as the phone's (the web app in its "car" mode, drawn into the surface the car gives us), with Android Auto's own turn banner and trip
 * estimates over it. The map page is loaded from the live site, so it looks exactly like the phone's.
 */
public class CarMapScreen extends Screen implements SurfaceCallback, CarHub.Screen {
    private static final String PAGE = "https://wastelandmaps.com/?car=1";

    private final NavigationManager navigation;
    private VirtualDisplay display;
    private Presentation presentation;
    private WebView web;
    private boolean loaded;

    public CarMapScreen(@NonNull CarContext carContext, NavigationManager navigation) {
        super(carContext);
        this.navigation = navigation;
        carContext.getCarService(AppManager.class).setSurfaceCallback(this);
        CarHub.get().attach(this, navigation);
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onDestroy(@NonNull LifecycleOwner owner) {
                release();
                CarHub.get().detach(CarMapScreen.this);
            }
        });
    }

    // ---- the surface the car gives us, and the web page drawn on it ----

    @Override
    public void onSurfaceAvailable(@NonNull SurfaceContainer container) {
        release();
        if (container.getSurface() == null) return;
        Context context = getCarContext();
        DisplayManager displays = (DisplayManager) context.getSystemService(Context.DISPLAY_SERVICE);
        display = displays.createVirtualDisplay("wasteland-map", container.getWidth(), container.getHeight(), container.getDpi(), container.getSurface(),
                DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY | DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION);
        presentation = new Presentation(context, display.getDisplay());
        web = new WebView(presentation.getContext());
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.setBackgroundColor(Color.parseColor("#021308"));
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                loaded = true;
                push();
            }
        });
        presentation.setContentView(web, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        presentation.show();
        loaded = false;
        web.loadUrl(PAGE);
    }

    @Override
    public void onSurfaceDestroyed(@NonNull SurfaceContainer container) {
        release();
    }

    private void release() {
        loaded = false;
        if (web != null) { web.destroy(); web = null; }
        if (presentation != null) { presentation.dismiss(); presentation = null; }
        if (display != null) { display.release(); display = null; }
    }

    /** Hands the page the newest state. */
    private void push() {
        if (web == null || !loaded) return;
        web.evaluateJavascript("window.carUpdate && window.carUpdate(" + CarHub.get().json + ")", null);
    }

    // ---- CarHub.Screen ----

    @Override
    public void onState() {
        push();
        invalidate();
    }

    @Override
    public void onAlert(String title, String subtitle) {
        CarToast.makeText(getCarContext(), title + ": " + subtitle, CarToast.LENGTH_LONG).show();
    }

    // ---- the turn banner and the trip estimate: Android Auto's own ----

    @NonNull
    @Override
    public Template onGetTemplate() {
        CarHub hub = CarHub.get();
        NavigationTemplate.Builder template = new NavigationTemplate.Builder()
                .setBackgroundColor(androidx.car.app.model.CarColor.createCustom(Color.parseColor("#021308"), Color.parseColor("#021308")))
                .setActionStrip(new ActionStrip.Builder()
                        .addAction(new Action.Builder().setTitle("End").setOnClickListener(() -> CarHub.get().requestEnd()).build())
                        .build());
        if (hub.active) {
            String text = hub.instruction.isEmpty() ? "Continue" : hub.instruction;
            Maneuver maneuver = new Maneuver.Builder(maneuverType(text))
                    .setIcon(new CarIcon.Builder(IconCompat.createWithResource(getCarContext(), iconFor(text))).build())
                    .build();
            Step step = new Step.Builder(text).setManeuver(maneuver).build();
            template.setNavigationInfo(new RoutingInfo.Builder().setCurrentStep(step, distance(hub.distanceToTurn)).build());
            long seconds = (long) Math.max(0, hub.remainingSeconds);
            template.setDestinationTravelEstimate(new TravelEstimate.Builder(distance(hub.remainingMeters),
                    DateTimeWithZone.create(System.currentTimeMillis() + seconds * 1000, TimeZone.getDefault()))
                    .setRemainingTimeSeconds(seconds)
                    .build());
        }
        return template.build();
    }

    /** Feet and miles in the United States, meters and kilometers elsewhere. */
    private static Distance distance(double meters) {
        double m = Math.max(0, meters);
        boolean us = "US".equals(Locale.getDefault().getCountry());
        if (us) {
            if (m < 160) return Distance.create(Math.max(50, Math.round(m * 3.281 / 50.0) * 50.0), Distance.UNIT_FEET);
            return Distance.create(m / 1609.34, Distance.UNIT_MILES_P1);
        }
        if (m < 1000) return Distance.create(Math.max(10, Math.round(m / 10.0) * 10.0), Distance.UNIT_METERS);
        return Distance.create(m / 1000.0, Distance.UNIT_KILOMETERS_P1);
    }

    private static int maneuverType(String instruction) {
        String t = instruction.toLowerCase(Locale.ROOT);
        if (t.contains("u-turn")) return Maneuver.TYPE_U_TURN_LEFT;
        if (t.contains("destination") || t.contains("arrive")) return Maneuver.TYPE_DESTINATION;
        if (t.contains("sharp left")) return Maneuver.TYPE_TURN_SHARP_LEFT;
        if (t.contains("sharp right")) return Maneuver.TYPE_TURN_SHARP_RIGHT;
        if (t.contains("slight left")) return Maneuver.TYPE_TURN_SLIGHT_LEFT;
        if (t.contains("slight right")) return Maneuver.TYPE_TURN_SLIGHT_RIGHT;
        if (t.contains("left")) return Maneuver.TYPE_TURN_NORMAL_LEFT;
        if (t.contains("right")) return Maneuver.TYPE_TURN_NORMAL_RIGHT;
        return Maneuver.TYPE_STRAIGHT;
    }

    private static int iconFor(String instruction) {
        String t = instruction.toLowerCase(Locale.ROOT);
        if (t.contains("u-turn")) return R.drawable.ic_car_uturn;
        if (t.contains("destination") || t.contains("arrive")) return R.drawable.ic_car_flag;
        if (t.contains("left")) return R.drawable.ic_car_left;
        if (t.contains("right")) return R.drawable.ic_car_right;
        return R.drawable.ic_car_straight;
    }
}
