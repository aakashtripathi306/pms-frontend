import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaTasks, FaCheckCircle, FaClock } from 'react-icons/fa';
import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import io from 'socket.io-client';

// Register Chart.js components
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const UserHome = ({ employeeId }) => {
  const [tasks, setTasks] = useState([]);
  const [employee, setEmployee] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const token = localStorage.getItem('employeeToken');
    if (!employeeId || !token) {
      localStorage.clear();
      navigate('/user-login', { replace: true });
      return;
    }

    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('join', employeeId);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket error:', error.message);
      if (error.message.includes('Authentication error')) {
        localStorage.clear();
        toast.error('Session expired. Please log in again.');
        navigate('/user-login', { replace: true });
      }
    });

    socket.on('newTask', (newTask) => {
      const employeeIds = newTask.employee_ids.map(Number);
      if (employeeIds.includes(Number(employeeId))) {
        setTasks((prev) =>
          [...prev, { ...newTask, status: newTask.status || 'Todo' }].sort((a, b) => (a.position || 0) - (b.position || 0))
        );
        toast.success(`New task assigned: ${newTask.title}`);
      }
    });

    socket.on('updateTask', (updatedTask) => {
      const employeeIds = updatedTask.employee_ids.map(Number);
      if (employeeIds.includes(Number(employeeId))) {
        setTasks((prev) =>
          prev
            .map((task) => (task.task_id === updatedTask.task_id ? { ...task, ...updatedTask } : task))
            .sort((a, b) => (a.position || 0) - (b.position || 0))
        );
        toast.info(`Task updated: ${updatedTask.title}`);
      }
    });

    socket.on('deleteTask', ({ task_id }) => {
      setTasks((prev) => prev.filter((task) => task.task_id !== task_id));
      toast.warn('Task deleted');
    });

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${BACKEND_URL}/api/tasks/employee/${employeeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTasks(response.data.tasks || []);
        setEmployee(response.data.employee || {});
      } catch (error) {
        console.error('Error fetching tasks:', error);
        if (error.response?.status === 401) {
          localStorage.clear();
          navigate('/user-login', { replace: true });
        } else {
          toast.error('Failed to fetch tasks');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

    return () => {
      socket.disconnect();
    };
  }, [employeeId, navigate]);

  const activeTasks = tasks.filter((task) => !task.status || task.status.toLowerCase() !== 'completed');
  const completedTasks = tasks.filter((task) => task.status?.toLowerCase() === 'completed');

  // Data for Pie Chart (Task Status Distribution)
  const pieChartData = {
    labels: ['Active Tasks', 'Completed Tasks'],
    datasets: [
      {
        data: [activeTasks.length, completedTasks.length],
        backgroundColor: ['#4F46E5', '#10B981'],
        hoverBackgroundColor: ['#4338CA', '#059669'],
      },
    ],
  };

  // Data for Bar Chart (Task Overview)
  const barChartData = {
    labels: ['Total Tasks', 'Active Tasks', 'Completed Tasks'],
    datasets: [
      {
        label: 'Task Count',
        data: [tasks.length, activeTasks.length, completedTasks.length],
        backgroundColor: ['#8B5CF6', '#4F46E5', '#10B981'],
        borderColor: ['#7C3AED', '#4338CA', '#059669'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="space-y-8">
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Task Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-indigo-100 p-4 rounded-lg shadow flex items-center gap-3">
              <FaTasks className="text-indigo-600 text-2xl" />
              <div>
                <h3 className="text-lg font-semibold text-indigo-900">Total Tasks</h3>
                <p className="text-2xl font-bold text-indigo-600">{tasks.length}</p>
              </div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg shadow flex items-center gap-3">
              <FaClock className="text-purple-600 text-2xl" />
              <div>
                <h3 className="text-lg font-semibold text-purple-900">Active Tasks</h3>
                <p className="text-2xl font-bold text-purple-600">{activeTasks.length}</p>
              </div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg shadow flex items-center gap-3">
              <FaCheckCircle className="text-green-600 text-2xl" />
              <div>
                <h3 className="text-lg font-semibold text-green-900">Completed Tasks</h3>
                <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-indigo-900 mb-4">Task Status Distribution</h3>
              <div className="w-full max-w-xs mx-auto">
                <Pie
                  data={pieChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'bottom' },
                      tooltip: { backgroundColor: '#4F46E5' },
                    },
                  }}
                />
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold text-indigo-900 mb-4">Task Overview</h3>
              <div className="w-full">
                <Bar
                  data={barChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: '#4F46E5' },
                    },
                    scales: {
                      y: { beginAtZero: true },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserHome;