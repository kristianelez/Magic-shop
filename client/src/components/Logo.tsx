import logoUrl from "@assets/images-2_1777763980088.jpeg";

interface LogoProps {
  size?: number;
  className?: string;
  ring?: boolean;
}

export function Logo({ size = 40, className = "", ring = true }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Magic Cosmetic Shop"
      width={size}
      height={size}
      className={
        "rounded-full object-cover shrink-0 " +
        (ring ? "ring-2 ring-primary/30 shadow-md " : "") +
        className
      }
      data-testid="img-logo"
      style={{ width: size, height: size }}
    />
  );
}

export { logoUrl };
