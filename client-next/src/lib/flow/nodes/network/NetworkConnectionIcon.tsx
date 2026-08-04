import type { NetworkConnectionKind } from './connections';

// Palette icon for network connection presets (Port of NetworkConnectionIcon.svelte).
export default function NetworkConnectionIcon({ kind = 'ethernet' }: { kind?: NetworkConnectionKind }) {
  const isCurved = kind === 'serial-wan' || kind === 'wireless';
  const isOrthogonal = kind === 'vpn-tunnel' || kind === 'logical-dashed';
  const path = isCurved ? 'M3 18 C11 18 20 6 29 6' : isOrthogonal ? 'M3 18 H15 V6 H29' : 'M3 12 H29';
  const stroke =
    kind === 'fiber' || kind === 'wireless' || kind === 'vpn-tunnel' || kind === 'link-aggregation'
      ? '#a6192e'
      : kind === 'logical-dashed'
        ? '#7a7770'
        : '#2c2c2a';
  const strokeWidth =
    kind === 'link-aggregation'
      ? 3.2
      : kind === 'vpn-tunnel' || kind === 'trunk'
        ? 2.5
        : kind === 'fiber'
          ? 2.1
          : kind === 'wireless'
            ? 1.9
            : kind === 'logical-dashed'
              ? 1.35
              : 1.6;
  const dashArray =
    kind === 'wireless'
      ? '0.8 3.2'
      : kind === 'serial-wan' || kind === 'vpn-tunnel' || kind === 'logical-dashed'
        ? '5 3.5'
        : undefined;

  return (
    <svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg" className="size-[30px] overflow-visible" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {kind === 'link-aggregation' ? (
        <>
          <rect x="11" y="7.5" width="10" height="9" rx="2.5" fill="white" />
          <text x="16" y="12.25" fill="#a6192e" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif" fontSize="4.1" fontWeight={700} textAnchor="middle" dominantBaseline="middle">
            LAG
          </text>
        </>
      ) : null}
    </svg>
  );
}
