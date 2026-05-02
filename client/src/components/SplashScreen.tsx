import { Logo } from "./Logo";

export function SplashScreen({ label = "Učitavanje..." }: { label?: string }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 50% 30%, hsl(220 55% 18%) 0%, hsl(220 60% 10%) 60%, hsl(220 65% 6%) 100%)",
      }}
      data-testid="splash-screen"
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <div className="animate-pulse">
          <Logo size={140} ring={false} className="shadow-2xl ring-4 ring-primary/40" />
        </div>
        <div className="space-y-2">
          <h1
            className="text-2xl font-semibold tracking-wide"
            style={{ color: "hsl(28 75% 65%)" }}
            data-testid="text-splash-title"
          >
            Magic Cosmetic Shop
          </h1>
          <p className="text-sm" style={{ color: "hsl(0 0% 75%)" }}>
            {label}
          </p>
        </div>
        <div className="flex gap-1.5 mt-2">
          <span
            className="h-2 w-2 rounded-full animate-bounce"
            style={{ backgroundColor: "hsl(28 75% 55%)", animationDelay: "0ms" }}
          />
          <span
            className="h-2 w-2 rounded-full animate-bounce"
            style={{ backgroundColor: "hsl(28 75% 55%)", animationDelay: "150ms" }}
          />
          <span
            className="h-2 w-2 rounded-full animate-bounce"
            style={{ backgroundColor: "hsl(28 75% 55%)", animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
