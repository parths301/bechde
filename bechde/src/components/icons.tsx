/**
 * Nav icons, drawn here rather than pulled from an icon set.
 *
 * They inherit `currentColor`, so the active/muted states come from the same
 * `colors` tokens as every other bit of chrome — the bottom nav used to fake a
 * muted state with `filter: grayscale()` on an emoji, which no token could reach.
 * Stroke is 1.9 rather than the usual 1.5: thinner lines look brittle next to
 * Bricolage 800 and the tilted, thick-cornered shapes around them.
 */

interface IconProps {
  size?: number;
}

function Svg({ size = 22, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.2 10.6 12 3.5l8.8 7.1" />
      <path d="M5.4 9.4V20h13.2V9.4" />
      <path d="M9.6 20v-5.4h4.8V20" />
    </Svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.2 4.3 3.5 6.4v13.3l5.7-2.1 5.6 2.1 5.7-2.1V4.3l-5.7 2.1z" />
      <path d="M9.2 4.3v13.3" />
      <path d="M14.8 6.4v13.3" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5.2v13.6" />
      <path d="M5.2 12h13.6" />
    </Svg>
  );
}

export function IconChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 12.2c0 4.1-3.8 7.4-8.5 7.4a9.8 9.8 0 0 1-2.6-.35L4.4 20.5l1.3-3.5a7 7 0 0 1-2.2-4.8c0-4.1 3.8-7.4 8.5-7.4s8.5 3.3 8.5 7.4z" />
    </Svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.4" r="3.9" />
      <path d="M4.8 20.2c0-3.6 3.2-5.9 7.2-5.9s7.2 2.3 7.2 5.9" />
    </Svg>
  );
}
