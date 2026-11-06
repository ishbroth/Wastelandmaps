# In-App Purchase for the iPhone app

Caps are a digital good, so Apple requires that the iPhone app sells them with the App Store's own In-App Purchase (and takes its cut: 15% under the
Small Business Program, otherwise 30%). The website keeps Stripe, with Apple Pay and Google Pay on its payment page.

How it works: the app shows Apple's purchase sheet (`src/lib/iap.ts`). When that succeeds it sends the transaction number to the `redeem-iap` edge
function, which asks Apple's App Store Server API what that transaction really is and adds the caps only if it is one of our products, bought by this
signed-in account (the account id travels with the purchase as Apple's `appAccountToken`), and not refunded. `add_credits` records each transaction once
(`apple:<transactionId>`), so the same purchase can never add caps twice. The purchase stays unfinished on the phone until the server has said yes, so a
dropped connection loses nothing: it is retried the next time the app opens.

## What has to be set up (only the account owner can do these)

1. **Agreements, tax and banking.** App Store Connect > Business (Agreements, Tax, and Banking): the *Paid Apps* agreement must be active, with bank and tax
   details filled in. Without it, products do not load.
2. **Three consumable In-App Purchases** (App Store Connect > your app > Monetization > In-App Purchases). Type **Consumable**, with exactly these
   Product IDs (the server and the app both use them; they must match `IAP_PRODUCT` in `src/lib/iap.ts` and `IAP_PRODUCTS` in
   `supabase/functions/_shared/common.ts`):

   | Product ID                        | Gives       | Suggested price |
   | --------------------------------- | ----------- | --------------- |
   | `com.wastelandmaps.app.caps400`   | 400 caps    | $0.99           |
   | `com.wastelandmaps.app.caps1800`  | 1,800 caps  | $3.99           |
   | `com.wastelandmaps.app.caps4400`  | 4,400 caps  | $9.99           |

   Each needs a reference name, a price, a display name and description ("400 bottle caps: spend them on snapshots of places"), and a screenshot of the
   purchase screen for review. Submit them together with the next app version.
3. **An App Store Server API key.** App Store Connect > Users and Access > Integrations > *In-App Purchase* > Generate key. Download the `.p8` file (it
   can be downloaded only once) and note the **Key ID** and the **Issuer ID** shown on that page.
4. **Give the server the key** (Supabase > Edge Functions > Secrets, or `supabase secrets set`):
   - `APPLE_IAP_KEY_ID`: the Key ID
   - `APPLE_IAP_ISSUER_ID`: the Issuer ID
   - `APPLE_IAP_PRIVATE_KEY`: the full text of the `.p8` file (including the BEGIN and END lines)
5. **Deploy the function:** `supabase functions deploy redeem-iap`
6. **The In-App Purchase capability in Xcode:** open `ios/App/App.xcworkspace`, select the App target > Signing & Capabilities > + Capability > *In-App
   Purchase*, and commit the project file change.
7. **Sync the app:** `npm run app:sync`, then build and upload to TestFlight as usual.

## Testing (needs a real iPhone)

- Make a **Sandbox tester** (App Store Connect > Users and Access > Sandbox) and sign in with it under Settings > App Store > Sandbox Account on the iPhone.
- Install a TestFlight (or Xcode) build, sign in to WastelandMaps, open a snapshot you cannot afford and buy a pack. Sandbox purchases cost nothing and the
  server accepts them (it asks Apple's sandbox when the real store has never heard of the transaction).
- Check the balance goes up. Kill the app right after paying to test recovery: the caps should arrive the next time it opens.

## Not done yet

- **Refunds.** A refunded purchase is refused if it is redeemed after the refund, but caps already added are not taken back. Handling Apple's refund
  notifications (App Store Server Notifications V2) would need a second function and a notification URL in App Store Connect.
- **Android.** Google Play has the same rule for its own billing (Play Billing). The Android app still hides buying; the plugin used here supports Play
  Billing too, so it can follow the same way with products made in Google Play Console.
