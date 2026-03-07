import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, Droplets, Activity, Camera, FileText } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/voeding', icon: UtensilsCrossed, label: 'Voeding' },
  { path: '/vocht', icon: Droplets, label: 'Vocht' },
  { path: '/scanner', icon: Camera, label: 'Scanner' },
  { path: '/symptomen', icon: Activity, label: 'Symptomen' },
  { path: '/rapport', icon: FileText, label: 'Rapport' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md shadow-lg">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`rounded-lg p-1.5 transition-all ${isActive ? 'bg-primary/12' : ''}`}>
                <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : ''}`} />
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
