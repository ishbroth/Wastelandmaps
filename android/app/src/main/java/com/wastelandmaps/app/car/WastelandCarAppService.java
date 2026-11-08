package com.wastelandmaps.app.car;

import android.content.pm.ApplicationInfo;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

/**
 * Android Auto starts this only when a phone is connected to a car (by cable or wirelessly). Until then it is never used, and the phone's map is all anyone sees.
 */
public class WastelandCarAppService extends CarAppService {
    @NonNull
    @Override
    public HostValidator createHostValidator() {
        // while developing (a debug build, tried in the Desktop Head Unit) any host is allowed; a release build trusts only Google's car hosts
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        }
        return new HostValidator.Builder(getApplicationContext())
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build();
    }

    @NonNull
    @Override
    public Session onCreateSession() {
        return new WastelandCarSession();
    }
}
