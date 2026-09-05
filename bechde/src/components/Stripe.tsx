import { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { colors } from "@/lib/colors";

interface StripeProps {
  angle?: string;
  band?: number;
  c1?: string;
  c2?: string;
  style?: CSSProperties;
  label?: string;
  /** real photo URL — when set, shows the image instead of the striped placeholder */
  src?: string;
  children?: ReactNode;
}

// The prototype's striped placeholder-photo pattern, e.g.
// repeating-linear-gradient(45deg,#F1E9DB 0 9px,#E4D7C1 9px 18px)
// When `src` is provided, the real photo replaces the stripes (badges still overlay).
export default function Stripe({ angle = "45deg", band = 9, c1 = colors.stripe1, c2 = colors.stripe2, style, label, src, children }: StripeProps) {
  return (
    <div
      style={{
        background: src
          ? "#EDE3D2"
          : `repeating-linear-gradient(${angle}, ${c1} 0 ${band}px, ${c2} ${band}px ${band * 2}px)`,
        display: "grid",
        placeItems: "center",
        position: "relative",
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 11,
        color: colors.textMuted,
        textAlign: "center",
        overflow: "hidden", // necessary for next/image fill to respect border-radius
        ...style,
      }}
    >
      {src && (
        <Image
          src={src}
          alt={label ?? "Cover photo"}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={{ objectFit: "cover", zIndex: 0 }}
          // A blob: URL (the sell form's instant local preview, before its own upload
          // resolves) is page-local — next/image's optimizer can't fetch it server-side
          // and errors if asked to try. Serve it directly instead, same as a plain <img>.
          unoptimized={src.startsWith("blob:")}
        />
      )}
      <div style={{ position: "relative", zIndex: 1, display: "contents" }}>
        {!src && label}
        {children}
      </div>
    </div>
  );
}
