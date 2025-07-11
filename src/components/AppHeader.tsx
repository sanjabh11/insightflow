import { Logo } from "@/components/icons/Logo";

export function AppHeader() {
  return (
    <header className="w-full sticky top-0 z-50 bg-gradient-to-r from-blue-100/70 via-indigo-100/70 to-purple-100/70 glass shadow-xl border-0 px-0 py-0">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3 sm:px-8 sm:py-4">
        <div className="flex items-center gap-4">
          <Logo className="w-10 h-10 drop-shadow-lg" />
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent select-none drop-shadow-md">
            InsightFlow
          </span>
        </div>
        {/* Optional: Add user profile, theme toggle, or nav links here */}
      </div>
    </header>
  );
}
