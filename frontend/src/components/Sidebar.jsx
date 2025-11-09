import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
} from "lucide-react";

const Sidebar = ({ isCollapsed, isMobileOpen }) => {
  const { pathname } = useLocation();

  const isActive = (path) => pathname === path;

  const navItems = [
    { to: "/", icon: <LayoutDashboard />, label: "Home" },
    { to: "/users", icon: <Users />, label: "Users" },
    { to: "/settings", icon: <Settings />, label: "Settings" },
  ];

  return (
    <div
      className={`${
        isMobileOpen ? "fixed z-50" : "hidden md:flex"
      } ${isCollapsed ? "w-16" : "w-64"} flex-col h-screen transition-all duration-300 border-r bg-white dark:bg-gray-900 dark:border-gray-700`}
    >
      <div className="flex flex-col gap-4 p-4 h-full">
        {/* Logo */}
        {!isCollapsed && (
          <div className="text-xl font-bold text-gray-900 dark:text-white px-2">
            My Dashboard
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1 mt-2">
          {navItems.map(({ to, icon, label }) => (
            <SidebarLink
              key={to}
              to={to}
              icon={icon}
              label={label}
              active={isActive(to)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Logout */}
        <div className="pt-4 border-t dark:border-gray-700">
          <SidebarLink
            to="/logout"
            icon={<LogOut />}
            label="Logout"
            active={isActive("/logout")}
            isCollapsed={isCollapsed}
          />
        </div>
      </div>
    </div>
  );
};

const SidebarLink = ({ to, icon, label, active, isCollapsed }) => {
  return (
    <Link
      to={to}
      title={isCollapsed ? label : ""}
      className={`flex items-center ${
        isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2"
      } rounded-md text-xs transition-colors
        ${
          active
            ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-black dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        }`}
    >
      <div className={`${isCollapsed ? "text-[20px]" : "text-[18px]"}`}>
        {icon}
      </div>
      {!isCollapsed && label}
    </Link>
  );
};

export default Sidebar;
