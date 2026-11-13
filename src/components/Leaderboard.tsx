import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { joinLeaderboard, leaveLeaderboard, setCallsign, loadLeaderboard, myStanding, type Account, type BoardRow } from '../lib/account';

const WINDOW = 10;

/**
 * The leaderboard, on the Share tab under the share link: the top survivors by level, then by places discovered (found, or unlocked a snapshot of). The list is a
 * window that always shows ten rows and scrolls through the rest, like the other long lists on the Pip-Boy. A survivor joins to appear, under a made-up callsign
 * (never their email, never their vault number).
 */
export default function Leaderboard({ account }: { account: Account }) {
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [me, setMe] = useState<BoardRow | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = !!account.session;

  const load = useCallback(async () => {
    const top = await loadLeaderboard(100);
    setFailed(top === null);
    setRows(top ?? []);
    setMe(signedIn ? await myStanding() : null);
  }, [signedIn]);
  useEffect(() => { void load(); }, [load]);

  const join = async (reroll: boolean) => {
    setBusy(true);
    await joinLeaderboard(reroll);
    await load();
    setBusy(false);
  };
  // choosing the callsign: free typing, checked by the server's moderator (letters, numbers, spaces; no cuss words in any language, no contact details)
  const [choosing, setChoosing] = useState<string | null>(null);
  const [chooseNote, setChooseNote] = useState('');
  const REASONS: Record<string, string> = {
    bad_length: 'A CALLSIGN IS 3 TO 20 CHARACTERS',
    bad_characters: 'LETTERS (A TO Z), NUMBERS AND SPACES ONLY',
    personal: 'NO LINKS, EMAIL ADDRESSES OR LONG NUMBERS (NOT YOUR VAULT NUMBER)',
    reserved: 'THAT NAME IS RESERVED',
    not_allowed: 'THAT NAME IS NOT ALLOWED: PICK ANOTHER',
    taken: 'THAT CALLSIGN IS ALREADY TAKEN',
  };
  const saveChoice = async () => {
    if (choosing === null) return;
    setBusy(true);
    const result = await setCallsign(choosing);
    if (result.ok) { setChoosing(null); setChooseNote(''); await load(); }
    else setChooseNote(REASONS[result.error] ?? 'THAT DID NOT GO THROUGH: TRY AGAIN');
    setBusy(false);
  };
  const leave = async () => {
    setBusy(true);
    await leaveLeaderboard();
    await load();
    setBusy(false);
  };

  // a window that always shows ten rows (the height of the first ten) while the Pip-Boy stays where it is
  const listRef = useRef<HTMLUListElement | null>(null);
  const [listHeight, setListHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const measure = () => {
      const items = Array.from(ul.children).slice(0, WINDOW) as HTMLElement[];
      if (items.length < WINDOW || (rows?.length ?? 0) <= WINDOW) { setListHeight(null); return; }
      const h = Math.ceil(items[WINDOW - 1].getBoundingClientRect().bottom - items[0].getBoundingClientRect().top);
      setListHeight((prev) => (prev !== null && Math.abs(prev - h) < 2 ? prev : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [rows]);

  const shown = rows ?? [];
  const meInList = shown.some((r) => r.mine);

  return (
    <div className="rm-board">
      <h3>LEADERBOARD</h3>
      {failed && <p className="rm-fine">The leaderboard is not open yet. Check back soon.</p>}
      {!failed && signedIn && !me && (
        <div className="rm-board-join">
          <p className="rm-fine">Want to be on it? You appear under a made-up callsign, never your email or your vault number.</p>
          <button type="button" className="rm-btn" disabled={busy} onClick={() => void join(false)}>{busy ? 'JOINING…' : 'JOIN THE LEADERBOARD'}</button>
        </div>
      )}
      {!failed && !signedIn && <p className="rm-fine">Sign in (Data tab) to join the leaderboard.</p>}
      {me && (
        <div className="rm-board-me">
          <p className="rm-fine">You are <b>{me.callsign}</b>: #{me.rank}, level {me.level}, {me.places} places.</p>
          <div className="rm-row-buttons">
            <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => void join(true)}>RANDOM</button>
            <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => { setChooseNote(''); setChoosing(me.callsign); }}>CHOOSE</button>
            <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => void leave()}>LEAVE</button>
          </div>
        </div>
      )}
      {me && choosing !== null && (
        <div className="rm-board-choose">
          <input value={choosing} maxLength={20} autoFocus autoCapitalize="words" autoComplete="off" spellCheck={false} placeholder="Type a callsign" aria-label="Your callsign"
            onChange={(e) => setChoosing(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveChoice(); }} />
          <div className="rm-row-buttons">
            <button type="button" className="rm-btn" disabled={busy || choosing.trim().length < 3} onClick={() => void saveChoice()}>TAKE IT</button>
            <button type="button" className="rm-btn rm-btn-ghost" disabled={busy} onClick={() => { setChoosing(null); setChooseNote(''); }}>CANCEL</button>
          </div>
          <p className="rm-fine">3 to 20 letters, numbers and spaces. Names are checked, and rude ones in any language are refused.</p>
        </div>
      )}
      {chooseNote && <p className={`rm-account-note${/TAKEN/.test(chooseNote) ? ' rm-flashnote' : ''}`} key={chooseNote + (busy ? '' : Date.now())}>{chooseNote}</p>}
      {!failed && rows !== null && shown.length === 0 && <p className="rm-empty">Nobody has joined yet. Be the first.</p>}
      {shown.length > 0 && (
        <ul className="rm-list rm-board-list" ref={listRef} style={listHeight ? { height: listHeight } : undefined} aria-label="Leaderboard">
          {shown.map((r) => (
            <li key={`${r.rank}-${r.callsign}`} className={`rm-board-row${r.mine ? ' mine' : ''}`}>
              <span className="rm-board-rank">{r.rank}</span>
              <b>{r.callsign}</b>
              <span className="rm-board-lv">LV {r.level}</span>
              <span className="rm-board-places">{r.places} {r.places === 1 ? 'PLACE' : 'PLACES'}</span>
            </li>
          ))}
        </ul>
      )}
      {me && !meInList && <p className="rm-fine">Your place, #{me.rank}, is below the top {shown.length}.</p>}
      <p className="rm-fine">Ranked by level, then by places discovered: the places you have actually been to.</p>
    </div>
  );
}
