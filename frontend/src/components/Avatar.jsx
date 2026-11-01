const SIZES = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs" };

export default function Avatar({ name, size = "md", online = false, inverted = false }) {
  const palette = inverted ? "bg-cream text-brand-900" : "bg-brand-100 text-brand-800";
  return (
    <div className="relative shrink-0">
      <div className={`${SIZES[size]} ${palette} flex items-center justify-center rounded-full font-semibold uppercase`}>
        {name.slice(0, 2)}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
      )}
    </div>
  );
}
