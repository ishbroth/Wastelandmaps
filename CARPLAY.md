# CarPlay

What is built, what it does today, and what to do the day Apple grants the entitlement.

## What the car shows

When an iPhone with this app is connected to a CarPlay car (cable or wireless) **and** a fast-travel route is running, the car's screen shows the same map as the
phone: the Pip-Boy green map, the same icons for the places plotted near the route, the pulsing route trail with its chevrons, and where the car is. The turn banner and
the distance/time estimates are CarPlay's own (driving apps get those), the spoken directions come out of the car's speakers (the phone speaks them), and a place
discovered along the way shows as a banner on the car's screen. Ending the trip on the car's screen ends it on the phone.

The car's map is the web app itself in a "car" mode (`src/car/CarApp.tsx`, opened as `https://wastelandmaps.com/?car=1` inside the car's window), so it looks exactly like
the phone's and needs no second copy of the map code. It needs the phone's data connection.

Nobody else sees any change: with no CarPlay car in range the phone's map is all there is. iOS only starts the car's scene when a car is connected, and on the web and on
Android none of the car calls do anything.

## What is in the code (all of it dormant until enabled)

- `ios/App/App/CarPlaySceneDelegate.swift`: iOS calls this only when a car connects (and only once the entitlement is in the app).
- `ios/App/App/CarPlayHub.swift`: the car's navigation session (turn banner, estimates, alerts) and the hand-off to the map page.
- `ios/App/App/CarMapViewController.swift`: the web view that fills the car's window.
- `ios/App/App/CarPlayPlugin.swift` and `MainViewController.swift`: the bridge the web app calls (`CarPlay.update`, `end`, `alert`, `status`).
- `src/lib/carplay.ts`: the web side of that bridge; `src/App.tsx` sends the route, position and nearby places about once a second while navigating.
- `_tools/enable-carplay.mjs`: switches CarPlay on (see below).
- `.github/workflows/ios-compile-check.yml`: builds the app for the simulator on a Mac runner to check the Swift compiles, without signing or uploading.

## Before Apple answers

The Swift code was written without a Mac, so it has never been compiled. Run **Actions > iOS compile check** once: if it fails, send the error lines and they get fixed.
The TestFlight build also compiles it, so a broken CarPlay file would stop TestFlight builds too: the compile check is the way to find out first.

## The day Apple grants the entitlement

1. Apple emails the Account Holder. In developer.apple.com > Certificates, Identifiers & Profiles > Identifiers > `com.wasteland.app`, the CarPlay capability
   (Navigation) is now available. Switch it on and save. (The app signs automatically with the App Store Connect key, so the provisioning profile picks it up on the next build.)
2. Run `node _tools/enable-carplay.mjs`. It adds the car scene to `Info.plist`, creates `App.entitlements` with `com.apple.developer.carplay-maps`, and points the Xcode project at it.
3. Commit and push, then run **Actions > iOS build to TestFlight**.
4. Test in a CarPlay car, or in Xcode's CarPlay simulator (needs a Mac). Start a fast-travel route on the phone; the car's screen shows the map.

If Apple declines the navigation category, nothing here is wasted: the phone navigation, the voice and the screen-awake setting work without it.

## Notes for App Review

The car window shows a map (the same one as the phone's) and CarPlay's own navigation templates; it takes no touches and shows no other content. If Apple wants the map drawn
natively instead of in a web view, `CarMapViewController.swift` is the one file to change.
