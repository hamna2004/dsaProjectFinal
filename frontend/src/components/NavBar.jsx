import { Link } from "react-router-dom";
import "../styles/dashboard.css";

const NavBar = () => (
  <header className="navbar">
    <div className="navbar__brand">
      <Link to="/">Flight Route Planner</Link>
    </div>
  </header>
);

export default NavBar;