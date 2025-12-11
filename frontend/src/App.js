import React from "react";
import {BrowserRouter as Router,Routes,Route} from "react-router-dom";



import './styles/global.css';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LivePage from "./pages/LivePage";
import RoutePlanner from "./pages/RoutePlanner";
import FlightsPage from "./pages/FlightsPage";
import AlgorithmLab from "./pages/AlgorithmLab";
import ReportsPage from "./pages/ReportsPage";


function App() {
  return (
    <Router>
    <Layout>
      <Routes>
      <Route path="/" element={<HomePage/>}/>
      <Route path="/live" element={<LivePage/>}/>
            
      <Route path="/planner" element={<RoutePlanner />} />

       <Route path="/flights" element={<FlightsPage/>}/>

       <Route path="/lab" element={<AlgorithmLab />} />

       <Route path="/reports" element={<ReportsPage />} />

      </Routes>
    </Layout>
    </Router>
  );
}

export default App;