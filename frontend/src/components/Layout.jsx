import NavBar from './NavBar';

const Layout = ({ children }) => (
  <div className="app-shell">
    <NavBar />
    <main className="app-content">{children}</main>
  </div>
);

export default Layout;