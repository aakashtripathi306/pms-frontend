import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

// ...imports remain the same

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const EmployeeDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const employee = location.state?.employee || {};
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const adminId = localStorage.getItem('id');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/tasks/assigned/${adminId}`);
      const filtered = res.data.filter(t => t.employee_id == id);
      setTasks(filtered);
    } catch (err) {
      console.error("Failed to fetch employee tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();
  const assigned = tasks.filter(t => t.status !== 'Completed');
  const completed = tasks.filter(t => t.status === 'Completed');

  const chartData = {
    labels: ['Total Tasks', 'Completed', 'Assigned'],
    datasets: [
      {
        label: 'Tasks Overview',
        data: [tasks.length, completed.length, assigned.length],
        backgroundColor: ['#0ea5e9', '#10b981', '#f59e0b'], // Blue, Green, Amber
        borderRadius: 8,
        barThickness: 40,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f9fafb',
        bodyColor: '#f9fafb',
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: '#6b7280', font: { size: 12 } },
        grid: { color: '#d1d5db' },
      },
      x: {
        ticks: { color: '#6b7280', font: { size: 12 } },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-100 rounded-2xl shadow-lg space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-bold text-sky-900">
          {employee.first_name} {employee.last_name} - Project Dashboard
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors duration-200 text-sm sm:text-base"
        >
          ← Back
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-sky-800">📊 Task Summary</h3>
        <div className="h-64 sm:h-80">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-sky-50 p-4 rounded-lg text-center">
          <p className="text-sm font-semibold text-sky-800">Total Tasks</p>
          <p className="text-2xl sm:text-3xl font-bold text-sky-900">{tasks.length}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-lg text-center">
          <p className="text-sm font-semibold text-emerald-800">Completed</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-900">{completed.length}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-lg text-center">
          <p className="text-sm font-semibold text-amber-800">Assigned</p>
          <p className="text-2xl sm:text-3xl font-bold text-amber-900">{assigned.length}</p>
        </div>
      </div>

      {/* Task Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Assigned */}
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-sky-800 mb-3">📝 Assigned Tasks</h3>
          {assigned.length ? (
            <ul className="space-y-3">
              {assigned.map(task => (
                <li key={task.task_id} className="p-4 bg-sky-50 border border-sky-200 rounded-lg shadow-sm">
                  <p className="font-semibold text-sky-900">{task.title}</p>
                  <p className="text-sm text-gray-600">Due: {formatDate(task.due_date)}</p>
                  <p className="text-sm text-gray-600">Status: {task.status}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">No active tasks assigned.</p>
          )}
        </div>

        {/* Completed */}
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-emerald-800 mb-3">✅ Completed Tasks</h3>
          {completed.length ? (
            <ul className="space-y-3">
              {completed.map(task => (
                <li key={task.task_id} className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm">
                  <p className="font-semibold text-emerald-900">{task.title}</p>
                  <p className="text-sm text-gray-600">Completed on: {formatDate(task.completion_date)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 italic">No completed tasks.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetails;
