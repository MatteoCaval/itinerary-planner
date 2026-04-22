export function MobileAppBar() {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border-b border-border"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)' }}
    >
      <img
        src={`${import.meta.env.BASE_URL}logo.svg`}
        alt=""
        aria-hidden="true"
        className="size-6 rounded-full shadow-sm"
      />
      <span className="text-sm font-bold tracking-tight text-foreground">Tappa</span>
    </div>
  );
}
