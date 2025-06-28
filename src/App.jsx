import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './Authentication/Login';
import Signup from './Authentication/SignUp';
import UserLogin from './Authentication/UserLogin';
import Home from './components/Pages/Home';
import UserDashboard from './components/Pages/UserDashboard';
import PrivateRoute from './components/PrivateRoute/PrivateRoute';
import { FaBars, FaTimes } from 'react-icons/fa';
import EmployeeDetails from './components/Layouts/EmployeeDetails';

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const showNavBar = ['/login', '/user-login'].includes(location.pathname);
  const token = localStorage.getItem("token");
  const employeeToken = localStorage.getItem("employeeToken");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === "/") {
      if (token) {
        navigate('/home');
      } else if (employeeToken) {
        navigate("/user-dashboard");
      }
    }
  }, [navigate, token, employeeToken, location.pathname]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {showNavBar && (
        <nav className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg py-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              {/* Logo and Branding */}
              <div className="flex items-center gap-3">
                <img
                  src="/task-management.png"
                  alt="Project Management System Logo"
                  className="h-10 w-auto"
                />
                <span className="text-xl font-bold text-white tracking-tight">
                  PROJECT MANAGEMENT
                </span>
              </div>

              {/* Desktop Links */}
              <div className="hidden lg:flex items-center gap-6">
                <Link
                  to="/login"
                  className={`relative px-6 py-2 text-sm font-medium text-white rounded-full transition-all duration-300 ${
                    location.pathname === '/login'
                      ? 'bg-white/20 backdrop-blur-sm'
                      : 'hover:bg-white/10 hover:scale-105'
                  } focus:outline-none focus:ring-2 focus:ring-white/50`}
                >
                  Admin Login
                  {location.pathname === '/login' && (
                    <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                  )}
                </Link>
                <Link
                  to="/user-login"
                  className={`relative px-6 py-2 text-sm font-medium text-white rounded-full transition-all duration-300 ${
                    location.pathname === '/user-login'
                      ? 'bg-white/20 backdrop-blur-sm'
                      : 'hover:bg-white/10 hover:scale-105'
                  } focus:outline-none focus:ring-2 focus:ring-white/50`}
                >
                  Employee Login
                  {location.pathname === '/user-login' && (
                    <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                  )}
                </Link>
              </div>

              {/* Mobile Menu Button */}
              <div className="lg:hidden">
                <button
                  onClick={toggleMobileMenu}
                  className="text-white hover:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/50 p-2 rounded-md"
                  aria-label="Toggle mobile menu"
                >
                  {isMobileMenuOpen ? (
                    <FaTimes className="h-6 w-6" />
                  ) : (
                    <FaBars className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
              <div className="lg:hidden mt-4 flex flex-col gap-3 bg-white/10 backdrop-blur-md rounded-lg p-4">
                <Link
                  to="/login"
                  onClick={toggleMobileMenu}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-all duration-200 ${
                    location.pathname === '/login'
                      ? 'bg-indigo-500'
                      : 'hover:bg-indigo-500/50'
                  }`}
                >
                  Admin Login
                </Link>
                <Link
                  to="/user-login"
                  onClick={toggleMobileMenu}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-all duration-200 ${
                    location.pathname === '/user-login'
                      ? 'bg-indigo-500'
                      : 'hover:bg-indigo-500/50'
                  }`}
                >
                  Employee Login
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/user-login" element={<UserLogin />} />
        <Route
          path="/home"
          element={
            <PrivateRoute role="admin">
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/user-dashboard"
          element={
            <PrivateRoute role="user">
              <UserDashboard />
            </PrivateRoute>
          }
        />
        <Route path="/employee/:id" element={<EmployeeDetails />} />
      </Routes>
    </>
  );
};

export default App;