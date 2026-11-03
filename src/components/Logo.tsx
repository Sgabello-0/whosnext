/** Il marchio del sito (lo stesso disegno della favicon e dell'icona dell'app). */
export function Logo({ grande }: { grande?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={`${grande ? 'size-14 rounded-2xl' : 'size-8 rounded-lg'} shrink-0 shadow-sm`}
    >
      <rect width="32" height="32" rx="8" fill="#2f5bd3" />
      <path d="M9 10h14M9 16h14M9 22h9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
