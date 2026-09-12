import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  reversed?: boolean;
};

export function BrandLogo({ className = "h-10 w-auto", priority = false, reversed = false }: BrandLogoProps) {
  return (
    <Image
      src={reversed ? "/brand/logo/bidscope-logo-white.svg" : "/brand/logo/bidscope-horizontal.svg"}
      alt="BidScope"
      width={920}
      height={240}
      priority={priority}
      className={`object-contain ${className}`}
    />
  );
}
