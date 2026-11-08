package com.wastelandmaps.app.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.NavigationManagerCallback;

/** One car connection. It shows the map screen, and tells the web app when the person ends the trip on the car's screen. */
public class WastelandCarSession extends Session {
    @NonNull
    @Override
    public Screen onCreateScreen(@NonNull Intent intent) {
        NavigationManager navigation = getCarContext().getCarService(NavigationManager.class);
        navigation.setNavigationManagerCallback(new NavigationManagerCallback() {
            @Override
            public void onStopNavigation() {
                CarHub.get().requestEnd();
            }

            @Override
            public void onAutoDriveEnabled() { }
        });
        return new CarMapScreen(getCarContext(), navigation);
    }
}
