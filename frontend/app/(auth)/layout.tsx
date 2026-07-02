import { Wallet } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-bg-surface to-bg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-accent-violet/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-info/10 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-text-primary">Shazah Finance</p>
            <p className="text-xs text-text-muted">Personal Command Center</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold text-text-primary leading-tight">
            Your complete{' '}
            <span className="gradient-text">financial picture</span>,{' '}
            in one place.
          </h1>
          <p className="text-text-secondary text-base leading-relaxed max-w-sm">
            Track income, expenses, investments, loans, and goals — all from a single, beautiful dashboard.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Net Worth', sub: 'Real-time tracking' },
              { label: 'Investments', sub: 'P&L analysis' },
              { label: 'Goals', sub: 'Smart projections' },
            ].map((item) => (
              <div key={item.label} className="glass-card rounded-2xl p-4">
                <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                <p className="text-xs text-text-muted mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-text-muted">
          © 2025 Shazah Finance. Built with love.
        </p>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
