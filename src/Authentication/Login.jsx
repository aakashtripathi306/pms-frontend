import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaEye, FaEyeSlash, FaEnvelope } from 'react-icons/fa';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('id');

      const res = await axios.post(`${BACKEND_URL}/api/login`, form);
      const { token, user } = res.data;
      if (token && user.id) {
        localStorage.setItem('token', token);
        localStorage.setItem('id', user.id);

        toast.success('Login successful');
        setTimeout(() => navigate('/home'), 1000);
      } else {
        toast.error('Failed to log in, invalid response.');
      }
    } catch (err) {
      console.error('Login error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-200 via-purple-100 to-white px-4 sm:px-6 lg:px-8 font-sans">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-3xl shadow-lg border border-indigo-100/50">
        <div className="flex justify-center mb-6">
          <img
            src="/task-management.png"
            alt="Project Management System Logo"
            className="h-14 w-auto"
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-indigo-900 mb-8 tracking-tight">
          🔐 Admin Login
        </h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <label htmlFor="email" className="block text-sm font-medium text-indigo-800 mb-2">
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-indigo-200 pl-10 pr-4 py-3 rounded-xl bg-indigo-50/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all duration-300"
                required
                aria-describedby="email-error"
                disabled={loading}
              />
              <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-400 h-4 w-4" />
            </div>
          </div>
          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-indigo-800 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                className="w-full border border-indigo-200 pl-4 pr-10 py-3 rounded-xl bg-indigo-50/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all duration-300"
                required
                aria-describedby="password-error"
                disabled={loading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 cursor-pointer top-1/2 transform -translate-y-1/2 text-indigo-500 hover:text-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-md p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full cursor-pointer bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 rounded-xl text-sm transition-all duration-300 shadow-md hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Logging in...
              </div>
            ) : (
              '🚀 Login'
            )}
          </button>
        </form>
        <div className="mt-6 text-center">
          <p className="text-sm text-indigo-800">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-purple-600 hover:text-purple-700 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-md"
            >
              Signup
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;