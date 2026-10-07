export function Stripe() {
  return (
    <div className="flex h-1.5 w-full">
      <div className="flex-[5] bg-zgreen" />
      <div className="flex-1 bg-zred" />
      <div className="flex-1 bg-zblack" />
      <div className="flex-1 bg-zorange" />
    </div>
  );
}

export function Wordmark({
  light = false,
  className = "text-2xl",
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      <span className={light ? "text-white" : "text-zblack"}>Fix</span>
      <span className="text-zorange">Zed</span>
    </span>
  );
}