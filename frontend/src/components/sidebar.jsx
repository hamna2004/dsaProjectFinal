import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FiHome, FiAirplay, FiMap, FiPieChart, FiLayers } from "react-icons/fi";
import "../styles/sidebar.css";

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    { name: "Dashboard", path: "/", icon: <FiHome /> },
    { name: "Flights", path: "/flights", icon: <FiAirplay /> },
    { name: "Live Tracker", path: "/live", icon: <FiMap /> },
    { name: "Algorithm Lab", path: "/lab", icon: <FiLayers /> },
    { name: "Graph Analysis", path: "/reports", icon: <FiPieChart /> },
  ];

  return (
    <aside className="sidebar">
      <div className="app-brand">
        <div className="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="currentColor"/>
          </svg>
        </div>
        <div className="brand-text">
          <h3 className="brand-title">Flight Route Planner</h3>
          <p className="brand-tagline">Navigate with Intelligence</p>
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
