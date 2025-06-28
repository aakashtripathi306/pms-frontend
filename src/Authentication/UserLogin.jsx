import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaEye, FaEyeSlash, FaEnvelope } from 'react-icons/fa';

const UserLogin = () => {
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
      // Clear localStorage to prevent stale data
      localStorage.removeItem('employeeToken');
      localStorage.removeItem('employeeId');

      const res = await axios.post(`${BACKEND_URL}/api/employee/login`, form);
      const { token, id, adminId } = res.data;
      if (token && id && adminId) {
        localStorage.setItem('employeeToken', token);
        localStorage.setItem('employeeId', id);

        toast.success('Login successful');
        setTimeout(() => navigate('/user-dashboard'), 1000);
      } else {
        toast.error('Failed to log in, invalid response.');
      }
    } catch (err) {
      console.error('Login error:', {
        message: err.message,
        response: err.response?.data,
      });
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-green-100 px-4 sm:px-6 lg:px-8">
      {loading && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
          <div className="flex flex-col items-center">
            <svg
              className="animate-spin h-10 w-10 text-indigo-500"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 01 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="mt-2 text-white text-sm font-medium">Logging in...</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-md p-6 sm:p-8 bg-gradient-to-b from-white to-green-100 border border-gray-100 rounded-3xl shadow-md">
        <div className="flex justify-center mb-6">
          <img
            src="/task-management.png"
            alt="Project Management System Logo"
            className="h-12 w-auto"
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-indigo-800 text-center mb-8">
          🔐 Employee Login
        </h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                placeholder="employee@example.com"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-gray-200 pl-10 pr-4 py-3 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all duration-300"
                required
                aria-describedby="email-error"
                disabled={loading}
              />
              <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            </div>
          </div>
          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full border border-gray-200 pl-4 pr-10 py-3 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all duration-300"
                required
                aria-describedby="password-error"
                disabled={loading}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute cursor-pointer right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-indigo-600 focus:outline-none focus:ring rounded-md p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showPassword ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full cursor-pointer bg-gradient-to-r from-indigo-600 to-green-500 hover:from-indigo-700 hover:to-green-600 text-white font-medium py-3 rounded-xl text-sm transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={loading}
          >
            🚀 Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserLogin;