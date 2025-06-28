import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';

const CompletedTasks = () => {
  const [groupedCompleted, setGroupedCompleted] = useState({});
  const [allCompletedTasks, setAllCompletedTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDateLocal());
  const [editTask, setEditTask] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const adminId = localStorage.getItem('id');

  function getTodayDateLocal() {
    const today = new Date();
    return today.toLocaleDateString('sv-SE');
  }

  function getLocalDateString(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sv-SE');
  }

  const formatDateDisplay = (dateStr) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : '';

  useEffect(() => {
    if (adminId) {
      fetchCompletedTasks();
    }
  }, [adminId]);

  const fetchCompletedTasks = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/tasks/assigned/${adminId}`);
      const completed = res.data.filter(t => t.status === 'Completed');
      setAllCompletedTasks(completed);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
      toast.error('Failed to fetch completed tasks');
    }
  };

  useEffect(() => {
    if (!selectedDate) return setGroupedCompleted({});

    const filtered = allCompletedTasks.filter(task => {
      return getLocalDateString(task.completion_date) === selectedDate;
    });

    const grouped = filtered.reduce((acc, task) => {
      const key = `${task.employee_id}-${task.first_name} ${task.last_name}`;
      acc[key] = acc[key] || [];
      acc[key].push(task);
      return acc;
    }, {});
    setGroupedCompleted(grouped);
  }, [selectedDate, allCompletedTasks]);

  const handleEdit = (task) => {
    setEditTask(task);
    setEditStatus(task.status);
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/tasks/${editTask.task_id}`, {
        ...editTask,
        status: editStatus,
        completion_date: editStatus === 'Completed' ? getTodayDateLocal() : null,
      });
      toast.success('Task updated successfully');
      setEditTask(null);
      await fetchCompletedTasks();
    } catch (error) {
      console.error("Update error:", error);
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${BACKEND_URL}/api/tasks/${editTask.task_id}`);
      toast.success('Task deleted successfully');
      setEditTask(null);
      setShowDeleteConfirm(false);
      await fetchCompletedTasks();
    } catch (error) {
      console.error('Error deleting task:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        toast.error('Task not found');
        await fetchCompletedTasks();
      } else {
        toast.error('Failed to delete task');
      }
    }
  };

  const closeEditModal = () => {
    setEditTask(null);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl">
      <h2 className="text-2xl sm:text-3xl font-bold text-indigo-900 text-center mb-6">
        ✅ Completed Tasks by Date
      </h2>

      <div className="max-w-xl mx-auto mb-6 flex justify-center">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full cursor-pointer max-w-xs border border-indigo-200 px-3 py-2 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
        />
      </div>

      {selectedDate && Object.keys(groupedCompleted).length > 0 ? (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
          {Object.keys(groupedCompleted).map(employeeKey => (
            <div
              key={employeeKey}
              className="bg-white border border-indigo-100 rounded-xl shadow-md p-4 sm:p-5 bg-gradient-to-r from-indigo-50/50 to-purple-50/50"
            >
              <h3 className="text-base sm:text-lg font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                👤 {employeeKey.split('-')[1]}
              </h3>
              <ul className="space-y-2 text-indigo-700 text-sm">
                {groupedCompleted[employeeKey].map(task => (
                  <li key={task.task_id} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-indigo-800">{task.title}</span>{' '}
                      <span className="text-indigo-500 cursor-pointer text-xs sm:text-sm">
                        (Completed: {formatDateDisplay(task.completion_date)})
                      </span>
                    </div>
                    <button
                      onClick={() => handleEdit(task)}
                      className="text-purple-600 cursor-pointer hover:text-purple-800 text-sm transition-all duration-200"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : selectedDate ? (
        <div className="text-center text-indigo-600 text-sm sm:text-base font-medium mt-6">
          No completed tasks found for {formatDateDisplay(selectedDate)}.
        </div>
      ) : (
        <div className="text-center text-indigo-600 text-sm sm:text-base font-medium mt-6">
          Please select a date to view completed tasks.
        </div>
      )}

      {editTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-xl p-4 sm:p-6 max-h-[85vh] overflow-y-auto bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
            {!showDeleteConfirm ? (
              <>
                <h3 className="text-lg sm:text-xl font-semibold text-indigo-900 mb-4">Edit Task Status</h3>
                <p className="text-indigo-700 text-sm font-medium mb-4">{editTask.title}</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-indigo-800 text-sm font-medium mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                    >
                      <option value="Completed">Completed</option>
                      <option value="Todo">Todo</option>
                    </select>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between gap-2 mt-4">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-purple-500 cursor-pointer hover:bg-purple-600 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                    >
                      <FaTrash className="text-xs" /> Delete
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdate}
                        className="bg-indigo-500 cursor-pointer hover:bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                      >
                        <span>✅ Save</span>
                      </button>
                      <button
                        onClick={closeEditModal}
                        className="bg-gray-400 cursor-pointer hover:bg-gray-500 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                      >
                        <span>❌ Cancel</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg sm:text-xl font-semibold text-indigo-900 mb-4">Confirm Deletion</h3>
                <p className="text-indigo-700 text-sm mb-4">
                  Are you sure you want to delete the task "<strong>{editTask.title}</strong>"? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleDelete}
                    className="bg-purple-500 cursor-pointer hover:bg-purple-600 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                  >
                    <FaTrash className="text-xs" /> Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-400 cursor-pointer hover:bg-gray-500 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                  >
                    <span>❌ Cancel</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedTasks;