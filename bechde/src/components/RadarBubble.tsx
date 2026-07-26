"use client";

import { colors } from "@/lib/colors";
import Hoverable from "./Hoverable";
import Stripe from "./Stripe";

interface RadarBubbleProps {
  left: string | number;
  top: string | number;
  size: number;
  angle: string;
  label: string;
  price: string;
  dur: string;
  delay: string;
  onClick: () => void;
  hoverZ?: number;
  hidden?: boolean;
  /** real cover photo — falls back to the striped placeholder when absent */
  src?: string;
}

export default function RadarBubble({ left, top, size, angle, label, price, dur, delay, onClick, hoverZ = 5, hidden, src }: RadarBubbleProps) {
  if (hidden) return null;
  return (
    <Hoverable
      onClick={onClick}
      style={{
        position: "absolute",
        left,
        top,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        animation: `bd-bob ${dur} ease-in-out infinite`,
        animationDelay: delay,
        zIndex: 2,
      }}
      hoverStyle={{ zIndex: hoverZ, transform: "scale(1.12)" }}
    >
      <Stripe
        angle={angle}
        src={src}
        label={label}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "3px solid #fff",
          boxShadow: "0 4px 12px rgba(60,45,20,.18)",
          fontSize: 10,
        }}
      />
      <div
        style={{
          background: "#fff",
          border: `1.5px solid ${colors.sand}`,
          borderRadius: 999,
          padding: "2px 9px",
          fontSize: 11.5,
          fontWeight: 700,
          color: colors.ink,
          boxShadow: "0 2px 6px rgba(60,45,20,.1)",
          whiteSpace: "nowrap",
        }}
      >
        {price}
      </div>
    </Hoverable>
  );
}
