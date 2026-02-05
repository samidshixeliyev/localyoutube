export const authService = {
  // Set token manually
  setToken: (token) => {
    localStorage.setItem('jwt_token', token);
  },

  // Logout
  logout: () => {
    localStorage.removeItem('jwt_token');
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('jwt_token');
  },

  // Get token
  getToken: () => {
    return localStorage.getItem('jwt_token');
  }
};