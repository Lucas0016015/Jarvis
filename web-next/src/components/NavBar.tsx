'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/',        label: 'Hub',     icon: '◈' },
  { href: '/brain',   label: 'Brain',   icon: '🧠' },
  { href: '/notes',   label: 'Notes',   icon: '◉' },
  { href: '/todos',   label: 'Tasks',   icon: '◊' },
  { href: '/calendar', label: 'Calendar', icon: '◐' },
  { href: '/emails',  label: 'Inbox',   icon: '◎' },
  { href: '/settings', label: 'Config',  icon: '⚙' },
];

export default function NavBar() {
  const pathname = usePathname();

  // Don't show nav on brain standalone page (it has its own controls)
  if (pathname === '/brain') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-jarvis-border/40"
      style={{ backdropFilter: 'blur(20px) saturate(160%)' }}
    >
      <div className="flex items-center justify-around max-w-xl mx-auto px-1 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isCentral = item.href === '/';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-300
                ${isActive
                  ? 'text-jarvis-cyan glow-cyan bg-jarvis-cyan/5'
                  : 'text-gray-500 hover:text-jarvis-cyan/70 hover:bg-jarvis-cyan/5'
                }
                ${isCentral ? 'scale-110' : ''}
              `}
            >
              <span className={`text-lg ${isActive ? 'animate-float' : ''}`}
                style={{
                  filter: isActive ? 'drop-shadow(0 0 8px rgba(0,242,255,0.6))' : 'none',
                }}
              >
                {item.icon}
              </span>
              <span className="text-[8px] tracking-[2px] uppercase font-medium"
                style={{ fontSize: '8px' }}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-jarvis-cyan"
                  style={{ boxShadow: '0 0 8px rgba(0,242,255,0.6)' }}
                />
              )}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
