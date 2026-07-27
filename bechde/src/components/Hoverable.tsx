"use client";

import { CSSProperties, ElementType, KeyboardEvent, ReactNode, useState } from "react";

interface HoverableProps {
  as?: ElementType;
  style?: CSSProperties;
  hoverStyle?: CSSProperties;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
  title?: string;
  type?: "button" | "submit" | "reset";
}

// Direct port of the prototype's `style` + `style-hover` pattern: merges an
// extra style object in on mouse-enter, since inline styles can't express :hover.
export default function Hoverable({
  as: Tag = "div",
  style,
  hoverStyle,
  onClick,
  className,
  children,
  ...rest
}: HoverableProps) {
  const [hover, setHover] = useState(false);
  // When it's clickable it must also be reachable and operable from a keyboard.
  const interactive = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <Tag
      className={className}
      style={{ ...style, ...(hover ? hoverStyle : null) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      {...interactive}
      {...rest}
    >
      {children}
    </Tag>
  );
}
