import { Logo } from '@/components/icons/Logo';

export function AppHeader() {
  return (
    <header className="py-4 px-6 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
        </div>
        {/* Additional header elements like user profile can go here */}
      </div>
    </header>
  );
}
