import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaUserAlt, FaUserTie, FaUser, FaBars, FaTasks } from 'react-icons/fa';
import io from 'socket.io-client';
import ActiveTasks from '../Layouts/ActiveTasks';
import UserCompletedTasks from '../Layouts/UserCompletedTasks';
import UserHome from '../Layouts/UserHome';

const JoinMeeting = ({ socket }) => {
  const [meetingId, setMeetingId] = useState('');
  const [joined, setJoined] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);

  const joinMeeting = () => {
    if (!meetingId) return;
    socket.emit('joinMeeting', meetingId);
    setJoined(true);
  };

  useEffect(() => {
    if (!joined || !socket) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('ice-candidate', e.candidate, meetingId);
      }
    };

    pc.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    });

    socket.on('offer', async (offer) => {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', answer, meetingId);
    });

    socket.on('ice-candidate', async (candidate) => {
      await pc.addIceCandidate(candidate);
    });

    return () => {
      socket.off('offer');
      socket.off('ice-candidate');
      pc.close();
    };
  }, [joined, socket, meetingId]);

  return (
    <div className="space-y-4">
      {!joined ? (
        <>
          <input
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            className="border px-4 py-2 rounded w-full"
            placeholder="Enter Meeting ID"
          />
          <button
            onClick={joinMeeting}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Join Meeting
          </button>
        </>
      ) : (
        <div className="flex gap-4 mt-6 flex-wrap">
          <div>
            <h4 className="text-sm font-medium text-indigo-700">Your Video</h4>
            <video ref={localVideoRef} autoPlay muted playsInline className="w-72 h-48 bg-black rounded-md" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-indigo-700">Remote Video</h4>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-72 h-48 bg-black rounded-md" />
          </div>
        </div>
      )}
    </div>
  );
};

const UserDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [employee, setEmployee] = useState({});
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [socketInstance, setSocketInstance] = useState(null);

  const navigate = useNavigate();
  const employeeId = localStorage.getItem('employeeId');
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

    setSocketInstance(socket);

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

  const handleLogoutConfirm = () => {
    localStorage.clear();
    const socket = io.connect(BACKEND_URL, {
      auth: { token: localStorage.getItem('employeeToken') },
    });
    socket.disconnect();
    toast.success('Logged out successfully');
    navigate('/user-login', { replace: true });
  };

  const getGenderIcon = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return <FaUserTie className="inline-block text-purple-600 mr-2" />;
      case 'female':
        return <FaUserAlt className="inline-block text-indigo-500 mr-2" />;
      default:
        return <FaUser className="inline-block text-gray-600 mr-2" />;
    }
  };

  return (
    <div className="w-full min-h-screen flex bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className={`w-64 bg-gray-900 text-white p-6 shadow-lg ${isSidebarOpen ? 'block' : 'hidden'} sm:block`}>
        <h3 className="text-xl font-bold mb-6">Project Management</h3>
        <nav className="space-y-4">
           <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-3 text-base py-2 px-4 rounded-md w-full hover:bg-indigo-700 ${
              activeTab === 'home' ? 'bg-indigo-700' : ''
            }`}
          >
            <FaTasks /> Home
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-3 text-base py-2 px-4 rounded-md w-full hover:bg-indigo-700 ${
              activeTab === 'active' ? 'bg-indigo-700' : ''
            }`}
          >
            <FaSignOutAlt /> Active Tasks
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-3 text-base py-2 px-4 rounded-md w-full hover:bg-indigo-700 ${
              activeTab === 'completed' ? 'bg-indigo-700' : ''
            }`}
          >
            <FaUserAlt /> Completed Tasks
          </button>
          <button
            onClick={() => setActiveTab('meeting')}
            className={`flex items-center gap-3 text-base py-2 px-4 rounded-md w-full hover:bg-indigo-700 ${
              activeTab === 'meeting' ? 'bg-indigo-700' : ''
            }`}
          >
            📹 Join Meeting
          </button>
        </nav>
      </div>

      <div className="flex-1 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-indigo-900 flex items-center">
              📋 {getGenderIcon(employee.gender)} {employee.first_name} {employee.last_name}'s Tasks
            </h2>
            <p className="text-sm text-indigo-600 mt-1">{employee.designation || ''} | {employee.gender || ''}</p>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">

            <button
              onClick={() => setShowLogoutModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-purple-700"
            >
              <FaSignOutAlt /> Logout
            </button>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="sm:hidden text-white bg-indigo-800 p-2 rounded-md hover:bg-indigo-900"
            >
              <FaBars />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          {loading && activeTab !== 'meeting' ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )   : activeTab === 'home' ? (
            <UserHome employeeId={employeeId} />
          )
          
          : activeTab === 'active' ? (
            activeTasks.length === 0 ? (
              <p className="text-center text-indigo-600">No active tasks assigned.</p>
            ) : (
              <ActiveTasks tasks={activeTasks} />
            )
          ) : activeTab === 'completed' ? (
            completedTasks.length === 0 ? (
              <p className="text-center text-indigo-600">No completed tasks.</p>
            ) : (
              <UserCompletedTasks tasks={completedTasks} setSelectedDate={setSelectedDate} />
            )
          ) : (
            <JoinMeeting socket={socketInstance} />
          )}
        </div>
      </div>

      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-11/12 max-w-sm p-6">
            <h2 className="text-lg font-semibold text-indigo-900 mb-2">Confirm Logout</h2>
            <p className="text-sm text-indigo-600 mb-4">Are you sure you want to logout?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-1.5 rounded-md bg-indigo-200 text-indigo-900 hover:bg-indigo-300"
              >
                Cancel
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="px-4 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
