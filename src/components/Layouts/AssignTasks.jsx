import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaSpinner } from 'react-icons/fa';

const AssignTasks = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    due_date: '',
    priority: '',
    status: '',
    position: 0,
  });
  const [loading, setLoading] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const adminId = localStorage.getItem('id');

  useEffect(() => {
    if (adminId) {
      setLoading(true);
      axios
        .get(`${BACKEND_URL}/api/employee/${adminId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
        })
        .then((res) => {
          const formatted = res.data.map((emp) => ({
            value: emp.id,
            label: `${emp.first_name} ${emp.last_name}`,
          }));
          setEmployees(formatted);
        })
        .catch((err) => {
          console.error('Error fetching employees:', err);
          toast.error('Failed to fetch employees');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [adminId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title || selectedEmployees.length === 0) {
      toast.error('Please fill in the Title and assign at least one employee.');
      return;
    }

    const assignedEmployees = selectedEmployees.map((emp) => emp.value);

    setLoading(true);
    toast.promise(
      axios.post(
        `${BACKEND_URL}/api/tasks/create-task`,
        {
          ...form,
          admin_id: adminId,
          assignedEmployees,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
        }
      ),
      {
        pending: 'Assigning task...',
        success: '✅ Task assigned successfully',
        error: '❌ Failed to assign task',
      }
    )
      .then(() => {
        setForm({
          title: '',
          description: '',
          start_date: '',
          due_date: '',
          priority: '',
          status: '',
          position: 0,
        });
        setSelectedEmployees([]);
      })
      .catch((err) => {
        console.error('Error creating task:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getMinDueDate = () => {
    if (!form.start_date) return null;
    const startDate = new Date(form.start_date);
    startDate.setDate(startDate.getDate());
    return startDate.toISOString().split('T')[0];
  };

  const getMaxStartDate = () => {
    if (!form.due_date) return null;
    const dueDate = new Date(form.due_date);
    dueDate.setDate(dueDate.getDate());
    return dueDate.toISOString().split('T')[0];
  };

  const selectStyles = {
    control: (provided) => ({
      ...provided,
      backgroundColor: '#374151',
      borderColor: '#4B5563',
      color: '#ffffff',
      boxShadow: 'none',
      '&:hover': {
        borderColor: '#6366F1',
      },
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: '#374151',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#6366F1' : '#374151',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#4B5563',
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: '#6366F1',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: '#ffffff',
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#7F9CF5',
        color: '#ffffff',
      },
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#9CA3AF',
    }),
    input: (provided) => ({
      ...provided,
      color: '#ffffff',
    }),
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 sm:p-8 bg-gray-900 rounded-xl shadow-lg min-h-screen text-white">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        style={{ zIndex: 9999 }}
      />
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="flex flex-col items-center">
            <FaSpinner className="animate-spin h-10 w-10 text-indigo-500" />
            <p className="mt-2 text-white text-sm font-medium">Loading...</p>
          </div>
        </div>
      )}

      <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-6">Assign New Task</h2>
      <div className="space-y-6">
        <div>
          <label className="block text-gray-300 font-medium text-sm mb-1">
            Title<span className="text-indigo-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all duration-200"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-gray-300 font-medium text-sm mb-1">Description</label>
          <textarea
            name="description"
            rows="3"
            value={form.description}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all duration-200 resize-none"
            disabled={loading}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <div className="w-full sm:w-1/2">
            <label className="block text-gray-300 font-medium text-sm mb-1">Start Date</label>
            <input
              type="date"
              name="start_date"
              value={form.start_date}
              onChange={handleChange}
              max={getMaxStartDate()}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all duration-200"
              disabled={loading}
            />
          </div>
          <div className="w-full sm:w-1/2">
            <label className="block text-gray-300 font-medium text-sm mb-1">Due Date</label>
            <input
              type="date"
              id="due_date"
              name="due_date"
              value={form.due_date}
              onChange={handleChange}
              min={getMinDueDate()}
              className="w-full px-3 py-2 border border-gray-600 rounded代码
-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all duration-200"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <div className="w-full sm:w-1/2">
            <label className="block text-gray-300 font-medium text-sm mb-1">Priority</label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all duration-200"
              disabled={loading}
            >
              <option value="">Select Priority</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <div className="w-full sm:w-1/2">
            <label className="block text-gray-300 font-medium text-sm mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all duration-200"
              disabled={loading}
            >
              <option value="">Select Status</option>
              <option>Todo</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-gray-300 font-medium text-sm mb-1">
            Assign to Employees<span className="text-indigo-500">*</span>
          </label>
          <div className="bg-gray-700 border border-gray-600 rounded-lg">
            <Select
              options={employees}
              isMulti
              value={selectedEmployees}
              onChange={setSelectedEmployees}
              class className="react-select-container"
              classNamePrefix="react-select"
              styles={selectStyles}
              isDisabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          onClick={handleSubmit}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 rounded-full text-sm transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={loading}
        >
          ✅ Assign Task
        </button>
      </div>
    </div>
  );
};

export default AssignTasks;