import React, { useState, useEffect } from 'react';
import { FaChevronDown, FaChevronUp, FaCheck } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';

const ActiveTasks = ({ tasks }) => {
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const token = localStorage.getItem('employeeToken');
  const employeeId = localStorage.getItem('employeeId');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleDetails = (taskId) => {
    setExpandedTaskId((prevId) => (prevId === taskId ? null : taskId));
  };

  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';

  const handleMarkComplete = async (taskId) => {
    setUpdatingTaskId(taskId);
    try {
      const currentDate = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD
      const response = await axios.put(
        `${BACKEND_URL}/api/tasks/${taskId}`,
        {
          status: 'Completed',
          completion_date: currentDate,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success(`Task "${response.data.title}" marked as completed!`);
    } catch (error) {
      console.error('Error marking task as completed:', error);
      toast.error('Failed to mark task as completed');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="relative flex flex-col gap-4 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {loading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
          <div className="relative">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-t-4 border-indigo-600 border-r-purple-500 border-b-indigo-600 border-l-purple-500 animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 animate-pulse opacity-30"></div>
          </div>
          <p className="mt-3 text-sm sm:text-base font-medium text-indigo-800 animate-pulse">
            Loading Tasks...
          </p>
        </div>
      )}
      {tasks.map((task) => (
        <div
          key={task.task_id}
          className={`relative bg-white rounded-xl p-4 sm:p-5 shadow-md transition-all duration-300 hover:shadow-lg ${
            expandedTaskId === task.task_id
              ? 'ring-2 ring-purple-400 ring-opacity-50'
              : 'border border-indigo-100'
          } bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 ${
            loading ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => handleToggleDetails(task.task_id)}
          >
            <h3 className="text-base sm:text-lg font-semibold text-indigo-900 truncate">
              {task.title}
            </h3>
            <div className="flex items-center gap-2">
              {task.status?.toLowerCase() !== 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent toggle when clicking button
                    handleMarkComplete(task.task_id);
                  }}
                  disabled={updatingTaskId === task.task_id}
                  className={`p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-all duration-200 ${
                    updatingTaskId === task.task_id ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <FaCheck />
                </button>
              )}
              {expandedTaskId === task.task_id ? (
                <FaChevronUp className="text-purple-600 text-sm sm:text-base" />
              ) : (
                <FaChevronDown className="text-purple-600 text-sm sm:text-base" />
              )}
            </div>
          </div>

          <div
            className={`overflow-hidden transition-all duration-300 ${
              expandedTaskId === task.task_id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            {expandedTaskId === task.task_id && (
              <div className="mt-3 text-xs sm:text-sm text-indigo-700 space-y-2">
                <p>
                  <strong className="font-semibold">Description:</strong>{' '}
                  {task.description || 'No description'}
                </p>
                <p>
                  <strong className="font-semibold">Start Date:</strong>{' '}
                  {formatDate(task.start_date)}
                </p>
                <p>
                  <strong className="font-semibold">Due Date:</strong>{' '}
                  {formatDate(task.due_date)}
                </p>
                <p>
                  <strong className="font-semibold">Priority:</strong>{' '}
                  {task.priority || 'N/A'}
                </p>
                <p>
                  <strong className="font-semibold">Status:</strong>{' '}
                  {task.status}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActiveTasks;