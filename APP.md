# Building the apps (Capacitor)

The app is the website (`dist/`) wrapped by Capacitor. The `android/` and `ios/` folders are generated projects: open them in Android Studio and Xcode, do not edit the web files inside them (`npm run app:sync` copies the latest build in).

## Every time the web code changes

```
npm install
npm run app:sync        # type-checks, builds the site, copies it into android/ and ios/
```

`npm run app:android` / `npm run app:ios` do the same and then open Android Studio / Xcode.

## Android (Android Studio)

1. `npm run app:android`, let Gradle sync.
2. Run on a device or emulator. For the Play Store: Build > Generate Signed Bundle (create an upload key and keep it safe).
3. Version: `android/app/build.gradle` (`versionCode`, `versionName`).

## iOS (Xcode, on the Mac)

1. `npm install`, then `npm run app:ios` (Capacitor 8 uses Swift Package Manager; there is no `pod install`).
2. App target > Signing & Capabilities: pick your team. Bundle identifier is `com.wastelandmaps.app` (see below).
3. Product > Archive to upload to App Store Connect. Version/build: General tab.

## Before the first store upload

- **App id.** `com.wastelandmaps.app` is set in `capacitor.config.ts`, the Android manifest's sign-in link scheme, the iOS `Info.plist` URL scheme, and `src/lib/native.ts` (`APP_SCHEME`). If you pick a different id, change all four, then `npx cap sync`. It cannot change after the first upload.
- **In-app purchases.** Apple and Google require their own purchase systems for digital goods like these credits. The app does not offer Stripe checkout (`purchasesAvailable()` in `src/lib/native.ts` is false in the app); credits bought on the website still work after signing in. Add Apple/Google purchases (RevenueCat is the usual shortcut) and have them call the `add_credits` database function, then turn `purchasesAvailable` on.
- **Sign-in links.** The email link opens the app through `com.wastelandmaps.app://auth`. That address must be in the Supabase project's allowed redirect URLs (it is in `supabase/auth/auth-settings.toml`; push the config with `supabase config push`).
- **Server origins.** The functions allow the app's origins (`capacitor://localhost`, `https://localhost`) in `supabase/functions/_shared/common.ts`. Redeploy the functions after that file changes.
- **Google key.** Inside the app the pages come from `capacitor://localhost` / `https://localhost`, which a website-restricted Google key refuses. Use a key for the app that is restricted by API only (Maps JavaScript, Places, Geocoding, Directions, Street View Static) and set quotas and a billing alert, since it ships inside the app.
- **Privacy.** Both stores need a privacy policy URL and answers about location, account email and purchases. Location is also used in the background while AUTO-DISCOVER is on (see the last section).
- **Icons and splash.** Placeholder art from `_tools/make-app-art.mjs` into `resources/`; replace the PNGs there and run `npm run app:assets` to regenerate every size.

## What is app-aware in the code

`src/lib/native.ts` (links, saving/sharing pictures through the share sheet, resume, status bar, splash), `src/lib/geo.ts` (location through Capacitor), `src/lib/notify.ts` (local notifications), the sign-in link in `src/lib/account.ts`.

## Feel, background discovery and store requirements (added)

- **Haptics and sounds** (`src/lib/haptics.ts`, `src/lib/sound.ts`): setting out on a fast travel, arriving, discovering, gaining XP, levelling up, and every gun and hit in the shooting gallery buzz and chirp. Sound is on by default in the app and off on the website; vibration has its own switch (Share tab).
- **Discovery with the phone in a pocket** (`src/lib/geo.ts`): with AUTO-DISCOVER on, the app keeps receiving positions while locked or in the background (community plugin `@capacitor-community/background-geolocation`). Android shows a notification while it does (that is the system's rule); iOS shows the blue status bar. Web requests use Capacitor's native networking (`CapacitorHttp`) so discoveries still reach the server after five minutes in the background. Test this on real phones: the simulator cannot move.
  - **Apple review:** background location needs a clear reason and the `UIBackgroundModes: location` entry (done). In App Store Connect's review notes, say that background location is used only to discover nearby places while the user has AUTO-DISCOVER on, and that it can be switched off in the app.
  - **Google Play review:** `ACCESS_BACKGROUND_LOCATION` needs the Play Console's location declaration and a short demo video of the feature.
- **Account deletion** (required by both stores): Account > Delete my account (`delete-account` function). **Privacy policy:** `/privacy.html` (replace the contact address with a real one before submitting).
- **iOS privacy manifest:** `ios/App/App/PrivacyInfo.xcprivacy` is added to the Xcode project's resources. In Xcode, Product > Archive, then check "Generate Privacy Report" lists nothing undeclared.
- **Reviewer login:** the sign-in is an emailed link, which a store reviewer cannot open. Before submitting, add a review account they can use (for example a fixed email with a password sign-in only that account can use) and put it in the review notes.

## iOS without a Mac: build in the cloud and send to TestFlight

There is no CocoaPods step: Capacitor 8 uses Swift Package Manager, and every plugin here supports it. The packages are resolved from `node_modules` when Xcode builds, so `npm install` (or `npm ci`) must run first; the workflow does that.

`.github/workflows/ios-testflight.yml` builds the app on a GitHub-hosted Mac, signs it with Apple's cloud signing, and uploads it to App Store Connect. (Xcode Cloud, Apple's own service, does the same job but its first setup needs Xcode on a Mac; use it instead if you are renting one anyway.)

One-time setup:
1. Enrol in the **Apple Developer Program** (developer.apple.com, $99/year; approval can take a day or two).
2. developer.apple.com > Identifiers: register the App ID `com.wastelandmaps.app`. Turn on **Push Notifications** is not needed; nothing else is.
3. App Store Connect > Apps > + New App: name WastelandMaps, bundle ID `com.wastelandmaps.app`, any SKU.
4. App Store Connect > Users and Access > Integrations > **App Store Connect API**: create a key with the **Admin** role (cloud signing needs it). Download the `.p8` file once. Note the Key ID and the Issuer ID, and your Team ID (developer.apple.com > Membership).
5. GitHub > repo Settings > Secrets and variables > Actions: add `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, and `ASC_KEY_P8` (the .p8 file's contents, base64-encoded: `base64 -w0 AuthKey_XXXX.p8`). `VITE_GOOGLE_MAPS_API_KEY` and `VITE_SUPABASE_ANON_KEY` are already there from the website build.

Each build: GitHub > Actions > **iOS build to TestFlight** > Run workflow. After about 15 minutes of building, App Store Connect processes the build (10 to 30 minutes more) and it appears under TestFlight.

TestFlight:
- Internal testers (people you add under Users and Access, up to 100) can install straight away, with no review: they install Apple's TestFlight app and accept the invite.
- External testers (anyone, by email or public link, up to 10,000) need a short Beta App Review, usually under a day.
- Before TestFlight accepts a first external build, App Store Connect asks for the app's privacy answers and a test contact.

The workflow has not been run yet; the first run may need small fixes (a missing capability, a signing complaint). Paste the error and it can be adjusted.
