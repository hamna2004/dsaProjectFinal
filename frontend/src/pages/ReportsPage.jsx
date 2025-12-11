import React from "react";
import Sidebar from "../components/sidebar";
import GraphAnalysisSection from "../components/sections/GraphAnalysisSection";
import "../styles/reports.css";

export default function ReportsPage() {
  return (
    <div className="app-content">
      <div className="page-grid">
        <Sidebar />
        <div className="main">
          <div className="reports-container">
            <GraphAnalysisSection />
          </div>
        </div>
      </div>
    </div>
  );
}



