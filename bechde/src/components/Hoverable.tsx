"use client";

import { CSSProperties, ElementType, ReactNode, useState } from "react";

interface HoverableProps {
  as?: ElementType;
  style?: CSSProperties;
  hoverStyle?: CSSProperties;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
  title?: string;
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
  return (
    <Tag
      className={className}
      style={{ ...style, ...(hover ? hoverStyle : null) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Tag>
  );
}
