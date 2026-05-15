import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, PlaySquare, Film, Upload,
  Users, Shield, Settings, Activity, Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';

const MAIN_NAV = [
  { to: '/',       icon: Home,       label: 'Ana Səhifə' },
  { to: '/shorts', icon: PlaySquare, label: 'Shorts'      },
];

const ADMIN_NAV = [
  { to: '/my-videos', icon: Film,   label: 'Videolarım', perm: 'admin-modtube' },
  { to: '/upload',    icon: Upload, label: 'Yüklə',      perm: 'admin-modtube' },
];

const SUPER_NAV = [
  { to: '/admin/users',    icon: Users,    label: 'İstifadəçilər' },
  { to: '/admin/roles',    icon: Shield,   label: 'Rollar'         },
  { to: '/admin/settings', icon: Settings, label: 'Tənzimləmələr' },
  { to: '/admin/metrics',  icon: Activity, label: 'Metriklər'      },
];

function NavItem({ to, icon: Icon, label, isOpen }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={!isOpen ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 mx-1 px-3 py-2.5 rounded-xl transition-colors duration-150
         ${isActive
           ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400'
           : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-army-700 hover:text-gray-900 dark:hover:text-gray-100'
         }`
      }
    >
      <Icon className="flex-shrink-0 h-5 w-5" />
      {isOpen && <span className="text-sm font-medium truncate">{label}</span>}
    </NavLink>
  );
}

function Divider() {
  return <div className="mx-3 my-1.5 border-t border-gray-200 dark:border-army-700" />;
}

export default function Sidebar() {
  const { isOpen, toggle } = useSidebar();
  const { isAuthenticated, hasPermission } = useAuth();
  const isSuperAdmin = hasPermission('super-admin');
  const isAdmin = hasPermission('admin-modtube') || isSuperAdmin;

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col overflow-hidden
                  transition-all duration-200 select-none
                  bg-white dark:bg-army-800 border-r border-gray-200 dark:border-army-700
                  ${isOpen ? 'w-60' : 'w-16'}`}
    >
      {/* Header — matches navbar height */}
      <div className="flex items-center h-14 px-3 flex-shrink-0 border-b border-gray-200 dark:border-army-700">
        <button
          onClick={toggle}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400
                     hover:bg-gray-100 dark:hover:bg-army-700 transition-colors flex-shrink-0"
          title={isOpen ? 'Bağla' : 'Aç'}
        >
          <Menu className="h-5 w-5" />
        </button>
        {isOpen && (
          <span className="ml-2 font-bold text-sm text-gray-800 dark:text-gray-100 truncate tracking-wide">
            MOD|TUBE
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {MAIN_NAV.map(item => (
          <NavItem key={item.to} {...item} isOpen={isOpen} />
        ))}

        {isAuthenticated && isAdmin && (
          <>
            <Divider />
            {ADMIN_NAV.filter(i => hasPermission(i.perm) || isSuperAdmin).map(item => (
              <NavItem key={item.to} {...item} isOpen={isOpen} />
            ))}
          </>
        )}

        {isSuperAdmin && (
          <>
            <Divider />
            {SUPER_NAV.map(item => (
              <NavItem key={item.to} {...item} isOpen={isOpen} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
