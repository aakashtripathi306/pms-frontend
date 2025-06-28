import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  FaEye, FaMale, FaFemale, FaPowerOff, FaUsers,
  FaTasks, FaCheck, FaSpinner
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Tooltip } from "react-tooltip";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement, CategoryScale, LinearScale, BarElement,
  Tooltip as ChartTooltip, Legend
} from "chart.js";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const ViewMembers = () => {
  const [allEmployees, setAllEmployees] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  const navigate = useNavigate();
  const adminId = localStorage.getItem("id");
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const fetchData = useCallback(async () => {
    if (!adminId || !BACKEND_URL) {
      toast.error("Missing admin ID or backend URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [empRes, taskRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/employee/${adminId}`),
        axios.get(`${BACKEND_URL}/api/tasks/assigned/${adminId}`)
      ]);
      setAllEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      setAllTasks(Array.isArray(taskRes.data) ? taskRes.data : []);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch data. Check console for details.");
    } finally {
      setLoading(false);
    }
  }, [adminId, BACKEND_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEmployeeClick = (employee) => {
    navigate(`/employee/${employee.id}`, { state: { employee } });
  };

  const handleStatusToggle = async (e, employee) => {
    e.stopPropagation();
    const newStatus = employee.status === 1 ? 0 : 1;
    const originalStatus = employee.status;
    // Optimistic update
    setAllEmployees(prev =>
      prev.map(emp =>
        emp.id === employee.id ? { ...emp, status: newStatus } : emp
      )
    );
    try {
      await axios.put(`${BACKEND_URL}/api/employee/status/${employee.id}`, {
        status: newStatus,
      });
      toast.success(`Employee ${newStatus === 1 ? "activated" : "deactivated"} successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } catch (err) {
      console.error("Status toggle error:", err);
      // Revert optimistic update
      setAllEmployees(prev =>
        prev.map(emp =>
          emp.id === employee.id ? { ...emp, status: originalStatus } : emp
        )
      );
      toast.error("Failed to update employee status.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    }
  };

  const filteredEmployees = allEmployees.filter(emp =>
    activeTab === "active" ? emp.status === 1 : emp.status === 0
  );

  const totalEmployees = allEmployees.length;
  const totalCompleted = allTasks.filter(task => task.status === "Completed").length;
  const totalTasks = allTasks.length;
  const inProgressTasks = totalTasks - totalCompleted;

  const doughnutData = {
    labels: ["Completed", "In Progress"],
    datasets: [
      {
        data: [totalCompleted, inProgressTasks],
        backgroundColor: ["#22c55e", "#facc15"],
        borderWidth: 2,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "white",
          font: {
            size: 14,
            weight: "normal",
            family: "'Inter', sans-serif",
          },
          padding: 8,
          boxWidth: 16,
          usePointStyle: true,
        },
      },
      tooltip: {
        bodyFont: {
          size: 12,
        },
      },
    },
    cutout: "60%",
    layout: {
      padding: {
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
      },
    },
  };

  const taskCountsByEmployee = allTasks.reduce((acc, task) => {
    if (task.employee_id) {
      acc[task.employee_id] = (acc[task.employee_id] || 0) + 1;
    }
    return acc;
  }, {});

  const topEmployees = Object.entries(taskCountsByEmployee)
    .map(([id, count]) => {
      const emp = allEmployees.find((e) => e.id === parseInt(id));
      if (!emp) return null;
      return { name: `${emp.first_name} ${emp.last_name}`, count };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const barData = {
    labels: topEmployees.map((e) => e.name),
    datasets: [
      {
        label: "Tasks Assigned",
        data: topEmployees.map((e) => e.count),
        backgroundColor: "#6366f1",
        borderRadius: 5,
        barThickness: 18,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      tooltip: {
        bodyFont: {
          size: 12,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: "white",
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          maxRotation: 0,
          autoSkip: true,
        },
        grid: { color: "#444" },
      },
      y: {
        ticks: {
          color: "white",
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          autoSkip: true,
          maxRotation: 30,
          minRotation: 0,
        },
        grid: { color: "#444" },
      },
    },
    layout: {
      padding: {
        top: 8,
        bottom: 8,
        left: 8,
        right: 8,
      },
    },
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-[100vw] mx-auto text-white bg-gray-900 min-h-screen overflow-x-hidden">
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
        toastClassName="text-sm sm:text-base"
      />
      {loading && (
        <div className="flex items-center justify-center py-4">
          <FaSpinner className="animate-spin text-3xl sm:text-4xl text-indigo-500" />
        </div>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Employees", value: totalEmployees, icon: <FaUsers />, color: "bg-blue-600" },
          { label: "Total Tasks", value: totalTasks, icon: <FaTasks />, color: "bg-indigo-600" },
          { label: "Completed", value: totalCompleted, icon: <FaCheck />, color: "bg-green-600" },
          { label: "In Progress", value: inProgressTasks, icon: <FaSpinner />, color: "bg-yellow-600" },
        ].map((item, idx) => (
          <div key={idx} className={`p-3 sm:p-4 rounded-lg sm:rounded-xl flex items-center gap-2 sm:gap-3 shadow-md ${item.color}`}>
            <div className="text-xl sm:text-2xl lg:text-3xl">{item.icon}</div>
            <div>
              <p className="text-xs sm:text-sm font-medium">{item.label}</p>
              <p className="text-base sm:text-lg lg:text-2xl font-bold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-800 p-3 sm:p-4 rounded-lg shadow h-auto min-h-[180px] sm:min-h-[240px] md:min-h-[300px] flex flex-col">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3 text-center md:text-left">Task Completion Ratio</h3>
          <div className="flex-1 relative">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>
        <div className="bg-gray-800 p-3 sm:p-4 rounded-lg shadow h-auto min-h-[180px] sm:min-h-[240px] md:min-h-[300px] flex flex-col">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold mb-2 sm:mb-3 text-center md:text-left">Top 5 Employees by Task Count</h3>
          <div className="flex-1 relative">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-3 sm:gap-4 mt-3 sm:mt-4 flex-wrap">
        {["active", "inactive"].map((tab) => (
          <button
            key={tab}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-semibold transition text-xs sm:text-sm md:text-base ${
              activeTab === tab
                ? "bg-indigo-500 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            } min-w-[120px] sm:min-w-[140px] md:min-w-[160px]`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "active" ? "Active Employees" : "Inactive Employees"}
          </button>
        ))}
      </div>

      {/* Employee Cards */}
      <div className="relative mt-3 sm:mt-4 max-h-[70vh] sm:max-h-[60vh] md:max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 overscroll-contain">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredEmployees.length > 0 ? filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="bg-gray-800 p-3 sm:p-4 rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition cursor-pointer"
              onClick={() => handleEmployeeClick(employee)}
            >
              <p className="text-sm sm:text-base md:text-lg font-semibold mb-1.5 sm:mb-2 truncate">
                {employee.first_name} {employee.last_name}
              </p>
              <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-base sm:text-lg md:text-xl">
                {employee.gender === "female" ? (
                  <FaFemale className="text-pink-400" />
                ) : (
                  <FaMale className="text-blue-400" />
                )}
                <button
                  onClick={(e) => handleStatusToggle(e, employee)}
                  className={`p-1.5 sm:p-2 rounded-full shadow ${
                    employee.status === 1 ? "bg-rose-600" : "bg-green-600"
                  } text-white`}
                  disabled={loading}
                >
                  <FaPowerOff />
                </button>
                <FaEye className="text-indigo-400 hover:text-indigo-200" />
              </div>
            </div>
          )) : (
            <p className="col-span-full text-center text-gray-400 py-4 sm:py-6 text-xs sm:text-sm md:text-base">
              No {activeTab === "active" ? "active" : "inactive"} employees found.
            </p>
          )}
        </div>
      </div>

      <Tooltip id="employee-tooltip" />
    </div>
  );
};

export default ViewMembers;