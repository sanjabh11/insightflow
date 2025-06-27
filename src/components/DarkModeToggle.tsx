// Version 1.0: Modular DarkModeToggle component
import React from "react";

interface DarkModeToggleProps {
  className?: string;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  className,
}) => {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <button
      className={`px-3 py-1 rounded border text-sm font-medium transition-colors shadow-sm bg-white dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 ${className || ""}`}
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle dark mode"
      type="button"
    >
      {dark ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
};
