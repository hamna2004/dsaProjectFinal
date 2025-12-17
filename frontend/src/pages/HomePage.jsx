import React, { useEffect, useState } from "react";
import Sidebar from "../components/sidebar";
import FlightSearch from "../components/FlightSearch";
import "../styles/dashboard.css";
import {Link} from "react-router-dom";
import { fetchDashboardStats } from "../services/api";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalFlights: 0,
    activeRoutes: 0,
    averagePrice: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      const data = await fetchDashboardStats();
    const target = {
        totalFlights: data.totalFlights || 0,
        activeRoutes: data.activeRoutes || 0,
        averagePrice: data.averagePrice || 0,
    };

      // Animate from 0 to target values
    const duration = 1200;
    const frameRate = 1000 / 60;
    const steps = Math.round(duration / frameRate);
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep += 1;
      const progress = Math.min(currentStep / steps, 1);

      setStats({
        totalFlights: Math.floor(target.totalFlights * progress),
        activeRoutes: Math.floor(target.activeRoutes * progress),
        averagePrice: Math.floor(target.averagePrice * progress),
      });

      if (progress === 1) clearInterval(interval);
    }, frameRate);
    };

    loadStats();
  }, []);

  return (
    <div className="app-content">
      <div className="page-grid">

        {/* LEFT SIDEBAR */}
        <Sidebar />

        {/* MAIN CONTENT */}
        <div className="main">

          {/* HERO SECTION */}
          <div className="hero-card">
            <div className="hero-left">
              <h1>Plan your flights smarter.</h1>
              <p>
                Search flights, explore route options, and track real-time aircraft.
              </p>

              <div className="hero-actions">
         <Link to="/planner">
                  <button className="btn btn--primary btn--hero-large">Start Planning</button>
</Link>
              </div>
            </div>

            <div className="hero-right">
              <div className="hero-right-card">
                <div className="label">Sample Route</div>
                <div className="route">KHI → LHE → LHR</div>
                <div className="meta">14h 35m • 2 stops</div>
              </div>
            </div>

            <div className="hero-animations" aria-hidden="true">
              <span className="hero-plane hero-plane--one">✈</span>
              <span className="hero-plane hero-plane--two">✈</span>
              <span className="hero-plane hero-plane--three">✈</span>
              <span className="hero-plane hero-plane--four">✈</span>
              <span className="hero-plane hero-plane--five">✈</span>
              <span className="hero-dot hero-dot--one"></span>
              <span className="hero-dot hero-dot--two"></span>
            </div>
          </div>

          {/* STAT CARDS */}
          <div className="stats-grid">
            <div className="stat-card total-flights-card">
              <h4>Total Flights</h4>
              <div className="value" data-animate="true">{stats.totalFlights.toLocaleString()}</div>
            </div>

            <div className="stat-card active-routes-card">
              <h4>Active Routes</h4>
              <div className="value" data-animate="true">{stats.activeRoutes.toLocaleString()}</div>
            </div>

            <div className="stat-card average-price-card">
              <h4>Average Price</h4>
              <div className="value" data-animate="true">${stats.averagePrice.toLocaleString()}</div>
            </div>
          </div>

          {/* FLIGHT SEARCH */}
          <div className="search-wrapper">
            <h3 className="section-title">Search Flights</h3>
            <FlightSearch />
          </div>

        </div>
      </div>
    </div>
  );
}
