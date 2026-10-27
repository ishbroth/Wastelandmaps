/** Shown instead of the map until Google answers: no key yet, or Google refused it. */
export default function SetupNotice({ problem }: { problem: string }) {
  const noKey = problem === 'NO KEY';
  return (
    <div className="rm-setup">
      <h2>{noKey ? 'TERMINAL OFFLINE: NO MAP KEY' : `TERMINAL ERROR: ${problem}`}</h2>
      {noKey ? (
        <>
          <p>RadMaps draws its maps with Google Maps, which needs a key. It takes about five minutes:</p>
          <ol>
            <li>In Google Cloud Console, open your project and enable <b>Maps JavaScript API</b>, <b>Geocoding API</b> and <b>Places API (New)</b>.</li>
            <li>Under Credentials, create an API key. Restrict it to <b>HTTP referrers</b>: <code>http://localhost:5173/*</code> now, and your .com once it is registered. Limit it to those three APIs.</li>
            <li>Copy <code>.env.example</code> to <code>.env.local</code> and paste the key after <code>VITE_GOOGLE_MAPS_API_KEY=</code>.</li>
            <li>Restart <code>npm run dev</code>.</li>
          </ol>
        </>
      ) : (
        <>
          <p>Google would not give us a map. The usual causes:</p>
          <ul>
            <li>The key is wrong or has a typo in <code>.env.local</code>.</li>
            <li>Maps JavaScript API, Geocoding API or Places API (New) is not enabled for the key's project.</li>
            <li>The key is restricted to referrers that do not include this address (for example <code>http://localhost:5173/*</code>).</li>
            <li>Billing is not turned on for the Google Cloud project.</li>
          </ul>
          <p>The browser console has Google's exact message.</p>
        </>
      )}
    </div>
  );
}
