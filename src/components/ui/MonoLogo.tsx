import React from "react";
import { cn } from "@/lib/utils";

interface MonoLogoProps {
  src: string;
  alt: string;
  className?: string;
}

export const MonoLogo: React.FC<MonoLogoProps> = ({ src, alt, className }) => {
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn("block", className)}
      style={{
        backgroundColor: "hsl(var(--primary))",
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        display: "block",
      }}
    />
  );
};
