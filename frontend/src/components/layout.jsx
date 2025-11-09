import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ModeToggle from "@/components/ModeToggle";

const Layout = () => {
  const { pathname } = useLocation();
  const isLogin = pathname === "/login";

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close sidebar on route change in mobile
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  if (isLogin) return <Outlet />;

  return (
    <div className="flex bg-white dark:bg-black text-black dark:text-white">
      <Sidebar isCollapsed={isCollapsed} isMobileOpen={isMobileOpen} />

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsMobileOpen(!isMobileOpen);
              } else {
                setIsCollapsed(!isCollapsed);
              }
            }}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Menu size={20} />
          </button>

          <h1 className="text-lg font-semibold">My Dashboard</h1>

          <ModeToggle />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          <Outlet className="min-h-screen" />
        </main>
      </div>
    </div>
  );
};

export default Layout;
    