import { useEffect, useState } from 'react';

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Shown when the day's cap on new snapshots has been used up: "THE VAULT PROJECTOR IS DOWN UNTIL 4:00 PM", flashing, with a countdown that ticks down to the moment the
 * count starts again (midnight UTC, shown in the person's own time). Nothing was charged.
 */
export default function ProjectorDown({ resetsAt }: { resetsAt: string }) {
  const until = new Date(resetsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((until - now) / 1000));
  const clock = new Date(until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  if (left === 0) return <p className="rm-account-note">THE VAULT PROJECTOR IS BACK ONLINE. TRY AGAIN.</p>;
  return (
    <div className="rm-projector" role="alert">
      <b className="rm-projector-flash">THE VAULT PROJECTOR IS DOWN UNTIL {clock}</b>
      <span className="rm-projector-count">{two(Math.floor(left / 3600))}:{two(Math.floor((left % 3600) / 60))}:{two(left % 60)}</span>
      <small>Nothing was charged.</small>
    </div>
  );
}
