export default function UkOnlyPage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <div className="relative flex flex-col gap-3 pl-5">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shadow-[0_0_18px_rgba(245,158,11,0.7)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-2 top-0 h-full w-[10px] bg-gradient-to-b from-amber-200/10 via-amber-400/20 to-amber-700/10 blur-[8px]"
          />

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            UK access only
          </h1>
          <p className="text-sm sm:text-base text-neutral-300">
            This configurator is currently available to visitors in the United Kingdom only.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border-2 border-amber-400/50 bg-transparent p-5 sm:p-7">
          <p className="text-sm text-neutral-200">
            If you are in the UK and seeing this message, please try again later or contact Wilkins Wardrobes directly.
          </p>
        </div>
      </div>
    </div>
  );
}