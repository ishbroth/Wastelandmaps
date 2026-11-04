/** A small padlock, shut or open: the mark on a snapshot that still has to be unlocked, or already is. It takes the colour of the text around it. */
export default function LockIcon({ open = false }: { open?: boolean }) {
  return (
    <svg className="rm-lock" viewBox="0 0 24 24" role="img" aria-label={open ? 'Unlocked' : 'Locked'}>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" fill="currentColor" />
      <path d={open ? 'M8 10.5V7.2a4 4 0 0 1 7.8-1.3' : 'M8 10.5V7.5a4 4 0 0 1 8 0v3'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="15.4" r="1.7" fill="#04170c" />
    </svg>
  );
}
