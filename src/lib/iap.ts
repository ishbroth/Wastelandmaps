// Buying caps with the App Store's own In-App Purchase, in the iPhone app. (Apple requires it for digital goods like these; the website keeps Stripe.)
//
// The flow: the phone shows Apple's purchase sheet; when it succeeds the app sends the transaction's number to our server (the redeem-iap function), which asks
// Apple directly whether that purchase is real, belongs to this account and has not been used, and only then adds the caps. The purchase stays unfinished
// on the phone until the server has said yes, so a dropped connection never loses a purchase: it is picked up again the next time the app opens.

import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { useEffect, useState } from 'react';
import { PACKS, buyPack, db } from './account';
import { platform } from './native';

/** The App Store product for each pack (consumable products with these exact identifiers are created in App Store Connect). */
export const IAP_PRODUCT: Record<string, string> = {
  caps400: 'com.wastelandmaps.app.caps400',
  caps1800: 'com.wastelandmaps.app.caps1800',
  caps4400: 'com.wastelandmaps.app.caps4400',
};

/** Are purchases made with the App Store here? (The iPhone app.) */
export const usesAppStore = (): boolean => platform() === 'ios';

/** Tells the server about a purchase; true once the caps were added (or had already been added). */
async function redeem(transactionId: string): Promise<boolean> {
  const { data, error } = await db().functions.invoke('redeem-iap', { body: { transactionId } });
  return !error && data?.ok === true;
}

async function redeemAndFinish(t: Transaction): Promise<boolean> {
  if (!(await redeem(t.transactionId))) return false;
  try { await NativePurchases.finishTransaction({ transactionId: t.transactionId }); } catch { /* it will be offered again; the server will say it has been used */ }
  return true;
}

/**
 * While someone is signed in in the iPhone app: purchases that were paid but never reached the server (a dropped connection, the app closed during the
 * purchase) are sent now, and any that appear later are sent as they come. `onCaps` is called when caps were added. Returns the way to stop.
 */
export function startPurchases(onCaps: () => void): () => void {
  if (!usesAppStore()) return () => {};
  let off = false;
  let handle: { remove: () => Promise<void> } | null = null;
  void (async () => {
    try {
      await NativePurchases.configure({ autoFinishTransactions: false });
      handle = await NativePurchases.addListener('transactionUpdated', (t) => { void redeemAndFinish(t).then((ok) => { if (ok && !off) onCaps(); }); });
      const { transactions } = await NativePurchases.getUnfinishedTransactions();
      for (const t of transactions) if (await redeemAndFinish(t) && !off) onCaps();
    } catch { /* purchases are not available on this device: nothing to recover */ }
  })();
  return () => { off = true; void handle?.remove(); };
}

/** The price of each pack as the App Store shows it (in the person's own currency), or the website's price until it is known. */
export function usePackPrices(): Record<string, string> {
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(PACKS.map((p) => [p.id, p.price])));
  useEffect(() => {
    if (!usesAppStore()) return;
    let off = false;
    NativePurchases.getProducts({ productIdentifiers: Object.values(IAP_PRODUCT), productType: PURCHASE_TYPE.INAPP })
      .then(({ products }) => {
        if (off) return;
        const found: Record<string, string> = {};
        for (const [pack, productId] of Object.entries(IAP_PRODUCT)) {
          const product = products.find((p) => p.identifier === productId);
          if (product) found[pack] = product.priceString;
        }
        setPrices((was) => ({ ...was, ...found }));
      })
      .catch(() => {});
    return () => { off = true; };
  }, []);
  return prices;
}

/**
 * Buys a pack. On the iPhone this is Apple's purchase sheet (bought: true when the caps have been added); elsewhere it opens the Stripe checkout page, which
 * takes the whole window (so nothing more happens here). `problem` is a message to show, or null.
 */
export async function purchasePack(pack: string): Promise<{ bought: boolean; problem: string | null }> {
  if (!usesAppStore()) return { bought: false, problem: await buyPack(pack) };
  const productId = IAP_PRODUCT[pack];
  const { data } = await db().auth.getSession();
  const user = data.session?.user.id;
  if (!productId || !user) return { bought: false, problem: 'Sign in first.' };
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    if (!isBillingSupported) return { bought: false, problem: 'Purchases are turned off on this iPhone (Settings, Screen Time, Content & Privacy Restrictions).' };
    // the account's own id travels with the purchase, so Apple's record says whose it is and nobody else can claim it
    const t = await NativePurchases.purchaseProduct({ productIdentifier: productId, productType: PURCHASE_TYPE.INAPP, quantity: 1, appAccountToken: user, autoAcknowledgePurchases: false });
    if (await redeemAndFinish(t)) return { bought: true, problem: null };
    return { bought: false, problem: 'Your purchase went through, but the caps could not be added just now. They will be added the next time you open the app.' };
  } catch (e) {
    if (/cancel/i.test(String((e as { message?: string }).message ?? e))) return { bought: false, problem: null };
    return { bought: false, problem: 'The purchase did not go through. You have not been charged. Try again in a moment.' };
  }
}
