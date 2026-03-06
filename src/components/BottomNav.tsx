import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, Activity, Droplets, Camera } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/voeding', icon: UtensilsCrossed, label: 'Voeding' },
  { path: '/scanner', icon: Camera, label: 'Scanner' },
  { path: '/symptomen', icon: Activity, label: 'Symptomen' },
  { path: '/dialyse', icon: Droplets, label: 'Dialyse' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-lg">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className={`h-6 w-6 ${isActive ? 'text-primary' : ''}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
