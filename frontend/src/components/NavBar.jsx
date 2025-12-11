import { Link } from "react-router-dom";
import "../styles/dashboard.css";

const NavBar = () => (
  <header className="navbar">
    <div className="navbar__brand">
      <Link to="/" className="navbar__brand-link">
        <span className="navbar__brand-icon">✈️</span>
        <span className="navbar__brand-text">Smart Paths, Better Flights</span>
      </Link>
    </div>
  </header>
);

export default NavBar;