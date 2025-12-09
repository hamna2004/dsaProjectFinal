import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FiHome, FiAirplay, FiMap, FiPieChart, FiSettings, FiLayers } from "react-icons/fi";
import "../styles/sidebar.css";

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    { name: "Dashboard", path: "/", icon: <FiHome /> },
    { name: "Flights", path: "/flights", icon: <FiAirplay /> },
    { name: "Live Tracker", path: "/live", icon: <FiMap /> },
    { name: "Algorithm Lab", path: "/lab", icon: <FiLayers /> },
    { name: "Reports", path: "/reports", icon: <FiPieChart /> },
    { name: "Settings", path: "/settings", icon: <FiSettings /> },
  ];

  const profile = {
    name: "Alex Johnson",
    email: "alex.johnson@mail.com",
    role: "Flight Analyst",
    avatar: "/logo192.png",
  };

  return (
    <aside className="sidebar">
      <div className="profile-widget">
        <div className="profile-avatar">
          <img src={profile.avatar} alt={profile.name} />
          <span className="status-dot" />
        </div>
        <div className="profile-meta">
          <p className="profile-role">{profile.role}</p>
          <h4>{profile.name}</h4>
          <p className="profile-email">{profile.email}</p>
        </div>
      </div>

      <nav className="nav">
        {menuItems.map((item) => {
          const isActive = currentPath === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
