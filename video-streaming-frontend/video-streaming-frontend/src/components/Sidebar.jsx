import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, PlaySquare, Film, Upload,
  Users, Shield, Settings, Activity, BarChart2, Menu, ListVideo, Video, Megaphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import ModTubeLogo from './ModTubeLogo';

const MAIN_NAV = [
  { to: '/',       icon: Home,       label: 'Ana Səhifə' },
  { to: '/shorts', icon: PlaySquare, label: 'Shorts'      },
];

const CONTENT_NAV = [
  { to: '/my-videos',    icon: Film,      label: 'Videolarım',  perms: ['upload-video', 'admin-modtube'] },
  { to: '/upload',       icon: Upload,    label: 'Yüklə',       perms: ['upload-video', 'admin-modtube'] },
  { to: '/meetings',     icon: Video,     label: 'Görüşlər',    perms: ['video-call', 'manage-meetings'] },
];

const USER_NAV = [
  { to: '/my-playlists', icon: ListVideo, label: 'Pleylistlərim' },
];

const ADMIN_NAV = [
  { to: '/admin/users',    icon: Users,    label: 'İstifadəçilər', perms: ['manage-users']    },
  { to: '/admin/roles',    icon: Shield,   label: 'Rollar',         perms: ['manage-roles']    },
  { to: '/admin/settings', icon: Settings, label: 'Tənzimləmələr', perms: ['manage-settings'] },
  { to: '/admin/metrics',    icon: Activity,  label: 'Metriklər',    perms: ['view-metrics'] },
  { to: '/admin/analytics',  icon: BarChart2, label: 'Analitika',    perms: ['view-metrics'] },
  { to: '/admin/notifications', icon: Megaphone, label: 'Bildirişlər', perms: ['manage-notifications'] },
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

  const canSee = (perms) => isSuperAdmin || perms.some(p => hasPermission(p));

  const visibleContent = isAuthenticated ? CONTENT_NAV.filter(i => canSee(i.perms)) : [];
  const visibleAdmin   = isAuthenticated ? ADMIN_NAV.filter(i => canSee(i.perms))   : [];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col overflow-hidden
                  transition-all duration-200 select-none
                  bg-white dark:bg-army-800 border-r border-gray-200 dark:border-army-700
                  ${isOpen ? 'w-60 translate-x-0' : 'w-16 -translate-x-full sm:translate-x-0'}`}
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
          <span className="ml-2 flex-shrink-0">
            <ModTubeLogo size={28} />
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {MAIN_NAV.map(item => (
          <NavItem key={item.to} {...item} isOpen={isOpen} />
        ))}

        {isAuthenticated && (
          <>
            <Divider />
            {USER_NAV.map(item => (
              <NavItem key={item.to} {...item} isOpen={isOpen} />
            ))}
          </>
        )}

        {visibleContent.length > 0 && (
          <>
            <Divider />
            {visibleContent.map(item => (
              <NavItem key={item.to} {...item} isOpen={isOpen} />
            ))}
          </>
        )}

        {visibleAdmin.length > 0 && (
          <>
            <Divider />
            {visibleAdmin.map(item => (
              <NavItem key={item.to} {...item} isOpen={isOpen} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
