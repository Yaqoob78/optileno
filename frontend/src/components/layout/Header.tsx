
import React, { useState } from "react";
import { Search, Bell } from "lucide-react";
import "../../styles/layout/header.css"; // CSS CONNECTION

interface HeaderProps {
  page: string;
}

export default function Header({ page }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const pageTitles: Record<string, string> = {
    "Chat": "Chat Leno",
    "Planner": "Planner",
    "Analytics": "Analytics",
    "Settings": "Settings",
    "Dashboard": "Dashboard"
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching:", searchQuery);
    }
  };

  return (
    <header className="premium-header">
      <div className="header-container">
        <div className="header-content">
          {/* Left Section - Page Title */}
          <div className="header-title-section">
            <h1 className="header-title">
              {page === "Chat" ? "Chat Optileno" : pageTitles[page] || page}
            </h1>

            {page === "Chat" && (
              <p className="header-subtitle">
                Leno
              </p>
            )}
          </div>

          {/* Right Section - Actions */}
          <div className="header-actions">
            {/* Search */}
            {searchOpen ? (
              <form
                onSubmit={handleSearch}
                className="header-search-active"
              >
                <div className="search-input-wrapper">
                  <Search size={18} className="search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="search-input"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="search-cancel"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="search-toggle"
                aria-label="Search"
              >
                <Search size={20} />
              </button>
            )}

            {/* Notifications */}
            <div className="notification-container">
              <button
                className="notification-button"
                aria-label="Notifications"
              >
                <Bell size={20} />
                <span className="notification-badge">

                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}