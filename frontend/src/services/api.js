// =======================
//  API Base URL
// =======================
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

// Helper function
async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {}

  if (!response.ok) {
    throw {
      status: response.status,
      message: data?.error || data?.message || "Request failed",
    };
  }

  return data;
}

// =======================
//  FETCH ALL FLIGHTS
// =======================
export const fetchFlights = async (source = null, dest = null, sort = null, search = null) => {
  try {
    let url = `${API_BASE_URL}/api/flights`;
    const params = new URLSearchParams();

    if (source) params.append("source", source);
    if (dest) params.append("dest", dest);
    if (sort) params.append("sort", sort);  // Add sort parameter
    if (search) params.append("search", search);  // Add search parameter (Linear Search)

    if (params.toString()) url += `?${params.toString()}`;

    return await fetchJson(url);
  } catch (error) {
    console.error("Error fetching flights:", error);
    return [];
  }
};

// =======================
//  FETCH ALL AIRPORTS
// =======================
export const fetchAirports = async () => {
  try {
    return await fetchJson(`${API_BASE_URL}/api/airports`);
  } catch (error) {
    console.error("Error fetching airports:", error);
    return [];
  }
};

// =======================
//  FIND ROUTES (ALL MODES)
//  /api/routes/find?source=&dest=&optimization=&max_stops=
// =======================

// =======================
//  FIND OPTIMAL ROUTE ONLY
//  (Cheapest / Fastest directly)
// =======================
export const findOptimalRoute = async (source, dest, optimization = "cheapest") => {
  try {
    const url = `${API_BASE_URL}/api/routes/find?source=${source}&dest=${dest}&optimization=${optimization}`;
    return await fetchJson(url);
  } catch (error) {
    console.error("Error finding optimal:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// =======================
//  SYNC REAL-TIME FLIGHTS
// =======================
export const syncRealTimeFlights = async (apiKey = null) => {
  try {
    const body = apiKey ? { api_key: apiKey } : {};

    return await fetchJson(`${API_BASE_URL}/api/flights/sync`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("Error syncing flights:", error);
    return { success: false, error: error.message };
  }
  
};

export const findRoutes = async ({ source, dest, optimization, max_stops }) => {
  try {
    const params = new URLSearchParams({
      source: source.trim().toUpperCase(),
      dest: dest.trim().toUpperCase(),
      optimization: optimization.trim().toLowerCase(),
      max_stops,
    });

    const url = `${API_BASE_URL}/api/routes/find?${params.toString()}`;

    return await fetchJson(url);
  } catch (error) {
    const err =
      error instanceof Error
        ? error
        : Object.assign(new Error(error?.message || "Failed to fetch routes"), {
            status: error?.status,
          });
    throw err;
  }
};

export const simulateDijkstra = async ({
  source,
  dest,
  mode = "cheapest",
  max_states = 200,
}) => {
  try {
    const params = new URLSearchParams({
      source: source.trim().toUpperCase(),
      dest: dest.trim().toUpperCase(),
      mode: mode.trim().toLowerCase(),
      max_states,
    });

    const url = `${API_BASE_URL}/api/simulate/dijkstra?${params.toString()}`;
    return await fetchJson(url);
  } catch (error) {
    console.error("Error simulating dijkstra:", error);
    return {
      success: false,
      error: error?.message || "Simulation failed",
      states: [],
    };
  }
};

// =======================
//  GRAPH ANALYSIS APIs
// =======================
export const fetchGraphStats = async () => {
  try {
    return await fetchJson(`${API_BASE_URL}/api/graph/stats`);
  } catch (error) {
    console.error("Error fetching graph stats:", error);
    return { success: false, error: error?.message || "Failed to fetch stats" };
  }
};

export const fetchAdjacencyList = async () => {
  try {
    return await fetchJson(`${API_BASE_URL}/api/graph/adjacency-list`);
  } catch (error) {
    console.error("Error fetching adjacency list:", error);
    return { success: false, error: error?.message || "Failed to fetch adjacency list" };
  }
};

export const fetchAdjacencyMatrix = async () => {
  try {
    return await fetchJson(`${API_BASE_URL}/api/graph/adjacency-matrix`);
  } catch (error) {
    console.error("Error fetching adjacency matrix:", error);
    return { success: false, error: error?.message || "Failed to fetch adjacency matrix" };
  }
};

export const fetchConnectedComponents = async () => {
  try {
    return await fetchJson(`${API_BASE_URL}/api/graph/components`);
  } catch (error) {
    console.error("Error fetching connected components:", error);
    return { success: false, error: error?.message || "Failed to fetch components" };
  }
};

export const fetchRouteGraphAnalysis = async (source, dest, maxHops = 3) => {
  try {
    const params = new URLSearchParams({
      source: source.trim().toUpperCase(),
      dest: dest.trim().toUpperCase(),
      max_hops: maxHops
    });
    return await fetchJson(`${API_BASE_URL}/api/graph/route-analysis?${params.toString()}`);
  } catch (error) {
    console.error("Error fetching route graph analysis:", error);
    return { success: false, error: error?.message || "Failed to fetch route analysis" };
  }
};

export const compareDijkstraPerformance = async ({ source, dest, mode = "cheapest" }) => {
  try {
    const params = new URLSearchParams({
      source: source.trim().toUpperCase(),
      dest: dest.trim().toUpperCase(),
      mode: mode.trim().toLowerCase(),
    });

    const url = `${API_BASE_URL}/api/simulate/compare-performance?${params.toString()}`;
    return await fetchJson(url);
  } catch (error) {
    console.error("Error comparing performance:", error);
    return {
      success: false,
      error: error?.message || "Performance comparison failed",
    };
  }
};

// =======================
//  MST ALGORITHMS
// =======================
export const simulateMST = async ({ source, dest, algorithm = "prim", max_states = 500 }) => {
  try {
    const params = new URLSearchParams({
      source: source.trim().toUpperCase(),
      dest: dest.trim().toUpperCase(),
      algorithm: algorithm.trim().toLowerCase(),
      max_states: max_states.toString(),
    });

    const url = `${API_BASE_URL}/api/graph/mst?${params.toString()}`;
    return await fetchJson(url);
  } catch (error) {
    console.error("Error simulating MST:", error);
    return {
      success: false,
      error: error?.message || "MST simulation failed",
    };
  }
};

// =======================
//  FETCH DASHBOARD STATS
// =======================
export const fetchDashboardStats = async () => {
  try {
    const url = `${API_BASE_URL}/api/flights/stats`;
    return await fetchJson(url);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      totalFlights: 0,
      activeRoutes: 0,
      averagePrice: 0,
    };
  }
};


