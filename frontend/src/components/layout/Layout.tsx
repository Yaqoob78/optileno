// src/components/layout/Layout.tsx - CONNECTED WITH CSS
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Calendar,
  BarChart3,
  Settings,
  LayoutDashboard
} from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useMobile } from "../../hooks/useMobile";
import "../../styles/layout/layout.css"; // CSS CONNECTION";

interface MenuItem {
  id: number;
  icon: React.ReactNode;
  label: string;
  gradient: string;
}
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMobile();

  // Mobile: default closed, Desktop: default open
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.innerWidth >= 768;
  });
  const [currentPage, setCurrentPage] = useState("Chat");

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Lock background scroll when mobile sidebar is open.
  useEffect(() => {
    if (!isMobile) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (!isMobile || !sidebarOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobile, sidebarOpen]);


  // CORRECTED MENU ORDER: Chat → Planner → Analytics → Settings → Dashboard
  const menuItems: MenuItem[] = [
    {
      id: 1,
      icon: <MessageSquare size={20} />,
      label: "Chat",
      gradient: "from-blue-600 to-cyan-500"
    },
    {
      id: 2,
      icon: <Calendar size={20} />,
      label: "Planner",
      gradient: "from-emerald-600 to-teal-500"
    },
    {
      id: 3,
      icon: <BarChart3 size={20} />,
      label: "Analytics",
      gradient: "from-purple-600 to-pink-500"
    },
    {
      id: 4,
      icon: <Settings size={20} />,
      label: "Settings",
      gradient: "from-gray-700 to-gray-600"
    },
    {
      id: 5,
      icon: <LayoutDashboard size={20} />,
      label: "Dashboard",
      gradient: "from-amber-600 to-orange-500"
    },
  ];

  const routeMap: Record<string, string> = {
    "Chat": "/chat",
    "Planner": "/planner",
    "Analytics": "/analytics",
    "Settings": "/settings",
    "Dashboard": "/dashboard",
  };

  // Sync active page with URL
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    const activeItem = menuItems.find(item =>
      routeMap[item.label] === path || path.startsWith(routeMap[item.label])
    );

    if (activeItem) {
      setCurrentPage(activeItem.label);
    }
  }, [location.pathname]);

  const handlePageChange = (page: string) => {
    setCurrentPage(page);
    if (isMobile) {
      setSidebarOpen(false);
    }
    navigate(routeMap[page] || "/chat");
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  return (
    <div className={`layout-container ${isMobile && sidebarOpen ? "mobile-sidebar-active" : ""}`}>
      {/* Luxury Background Texture */}
      <div className="layout-background" />

      <div className="layout-content-wrapper">
        {/* Mobile sidebar overlay (must be inside shell so sidebar stays clickable above it) */}
        {isMobile && sidebarOpen && (
          <div
            className="mobile-sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* Sidebar */}
        <motion.div
          className={`layout-sidebar-wrapper ${isMobile && sidebarOpen ? 'mobile-open' : ''}`}
          animate={{
            width: isMobile ? 280 : (sidebarOpen ? 260 : 70)
          }}
          transition={{ duration: 0.3 }}
        >
          <Sidebar
            isOpen={isMobile ? true : sidebarOpen}
            menuItems={menuItems}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onToggle={toggleSidebar}
          />
        </motion.div>

        {/* Main Content Area */}
        <motion.div
          className="layout-main-content"
          animate={{
            marginLeft: isMobile ? 0 : (sidebarOpen ? 260 : 70)
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <Header page={currentPage} onMenuToggle={toggleSidebar} isMobile={isMobile} />

          {/* Main Content */}
          <main className="main-content-area">
            <div className="content-max-width">
              <Outlet />
            </div>
          </main>

        </motion.div>
      </div>
    </div>
  );
}
