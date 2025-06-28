import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaMale, FaFemale, FaEdit, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ViewAssignedTasks = ({ socket }) => {
  const [groupedTasks, setGroupedTasks] = useState({});
  const [filteredTasks, setFilteredTasks] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [editTask, setEditTask] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addTask, setAddTask] = useState(null);
  const [addForm, setAddForm] = useState({
    title: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0], // Default to current date
    due_date: '',
    priority: '',
    status: '',
    position: 0,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [eventQueue, setEventQueue] = useState([]);
  const adminId = localStorage.getItem('id');
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    if (!adminId || !socket) return;

    if (socket.connected) {
      socket.emit('join', adminId);
    } else {
      socket.on('connect', () => {
        socket.emit('join', adminId);
        fetchTasks();
      });
    }

    socket.on('connect_error', (error) => {
      toast.error('Failed to connect to real-time updates');
    });

    socket.on('error', (error) => {});

    fetchTasks();

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('newTask');
      socket.off('updateTask');
      socket.off('deleteTask');
    };
  }, [adminId, socket]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const employeeRes = await axios.get(`${BACKEND_URL}/api/employee/${adminId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const employees = employeeRes.data;

      const taskRes = await axios.get(`${BACKEND_URL}/api/tasks/assigned/${adminId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const activeTasks = taskRes.data.filter((task) => task.status !== 'Completed' && task.task_id);

      const grouped = employees.reduce((acc, emp) => {
        acc[emp.id] = {
          employeeName: `${emp.first_name} ${emp.last_name}`,
          gender: emp.gender,
          tasks: [],
        };
        return acc;
      }, {});

      activeTasks.forEach((task) => {
        const key = task.employee_id;
        if (grouped[key]) {
          grouped[key].tasks.push(task);
        }
      });

      Object.values(grouped).forEach((employee) => {
        employee.tasks.sort((a, b) => (a.position || 0) - (b.position || 0));
      });

      setGroupedTasks(grouped);
      setFilteredTasks(applySearchFilter(grouped, searchQuery));
      setIsInitialized(true);
    } catch (error) {
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!socket || !isInitialized) {
      if (socket) {
        socket.on('newTask', (newTask) => {
          setEventQueue((prev) => [...prev, { type: 'newTask', data: newTask }]);
        });
        socket.on('updateTask', (updatedTask) => {
          setEventQueue((prev) => [...prev, { type: 'updateTask', data: updatedTask }]);
        });
        socket.on('deleteTask', (data) => {
          setEventQueue((prev) => [...prev, { type: 'deleteTask', data }]);
        });
      }
      return;
    }

    eventQueue.forEach(({ type, data }) => {
      if (type === 'newTask') handleNewTask(data);
      else if (type === 'updateTask') handleUpdateTask(data);
      else if (type === 'deleteTask') handleDeleteTask(data);
    });
    setEventQueue([]);

    socket.on('newTask', (newTask) => {
      handleNewTask(newTask);
    });
    socket.on('updateTask', (updatedTask) => {
      handleUpdateTask(updatedTask);
    });
    socket.on('deleteTask', (data) => {
      handleDeleteTask(data);
    });

    return () => {
      socket.off('newTask');
      socket.off('updateTask');
      socket.off('deleteTask');
    };
  }, [isInitialized, socket]);

  const handleNewTask = (newTask) => {
    if (!newTask.task_id) {
      toast.error('Received invalid task data');
      return;
    }
    setGroupedTasks((prev) => {
      const newGrouped = { ...prev };
      newTask.employee_ids?.forEach((empId) => {
        const employeeId = empId.toString();
        if (!newGrouped[employeeId]) {
          const employee = newTask.employees?.find((e) => e.id === empId);
          if (employee) {
            newGrouped[employeeId] = {
              employeeName: `${employee.first_name} ${employee.last_name}`,
              gender: employee.gender,
              tasks: [],
            };
          } else {
            return;
          }
        }
        newGrouped[employeeId].tasks = [
          ...newGrouped[employeeId].tasks.filter((t) => t.task_id !== newTask.task_id),
          { ...newTask, task_id: newTask.task_id, employee_id: empId },
        ].sort((a, b) => (a.position || 0) - (b.position || 0));
      });
      setFilteredTasks(applySearchFilter(newGrouped, searchQuery));
      return newGrouped;
    });
    // toast.success('New task added via real-time update');
  };

  const handleUpdateTask = (updatedTask) => {
    if (!updatedTask.task_id) {
      toast.error('Invalid task update data');
      return;
    }
    setGroupedTasks((prev) => {
      const newGrouped = structuredClone(prev);
      const employeeIds = updatedTask.employee_ids || (updatedTask.employee_id ? [updatedTask.employee_id] : []);
      if (!employeeIds.length) {
        toast.warn('Cannot update task: no employee IDs');
        return newGrouped;
      }
      let updated = false;
      employeeIds.forEach((empId) => {
        const employeeId = empId.toString();
        if (!newGrouped[employeeId]) {
          return;
        }
        const taskIndex = newGrouped[employeeId].tasks.findIndex(
          (task) => task.task_id === updatedTask.task_id
        );
        if (taskIndex === -1) {
          return;
        }
        if (updatedTask.status === 'Completed') {
          newGrouped[employeeId].tasks.splice(taskIndex, 1);
          updated = true;
        } else {
          newGrouped[employeeId].tasks[taskIndex] = {
            ...newGrouped[employeeId].tasks[taskIndex],
            ...updatedTask,
            employee_id: empId,
          };
          newGrouped[employeeId].tasks.sort((a, b) => (a.position || 0) - (b.position || 0));
          updated = true;
        }
      });
      if (updated) {
        setFilteredTasks(applySearchFilter(newGrouped, searchQuery));
      }
      return newGrouped;
    });
    // toast.success('Task updated in real-time');
  };

  const handleDeleteTask = ({ task_id }) => {
    if (!task_id) {
      toast.error('Invalid task deletion data');
      return;
    }
    setGroupedTasks((prev) => {
      const newGrouped = { ...prev };
      Object.keys(newGrouped).forEach((employeeId) => {
        newGrouped[employeeId].tasks = newGrouped[employeeId].tasks.filter(
          (task) => task.task_id !== task_id
        );
      });
      setFilteredTasks(applySearchFilter(newGrouped, searchQuery));
      return newGrouped;
    });
    // toast.success('Task deleted');
  };

  const applySearchFilter = (tasks, query) => {
    if (!query.trim()) return tasks;

    const lowerQuery = query.toLowerCase();
    return Object.entries(tasks).reduce((acc, [employeeId, employee]) => {
      const matchesEmployee = employee.employeeName.toLowerCase().includes(lowerQuery);
      const matchingTasks = employee.tasks.filter(
        (task) => task.task_id && task.title.toLowerCase().includes(lowerQuery)
      );

      if (matchesEmployee || matchingTasks.length > 0) {
        acc[employeeId] = {
          ...employee,
          tasks: matchesEmployee ? employee.tasks.filter((task) => task.task_id) : matchingTasks,
        };
      }
      return acc;
    }, {});
  };

  useEffect(() => {
    setFilteredTasks(applySearchFilter(groupedTasks, searchQuery));
  }, [searchQuery, groupedTasks]);

  const handleEditClick = (task) => {
    setEditTask(task);
    setEditForm({
      ...task,
      completion_date: task.completion_date ? formatDate(task.completion_date) : '',
    });
  };

  const handleChange = (e, formType) => {
    const { name, value } = e.target;
    if (formType === 'edit') {
      setEditForm((prev) => ({ ...prev, [name]: value }));
    } else {
      setAddForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const formatDate = (dateStr) =>
    dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

  const getMinDueDate = () => {
    if (!addForm.start_date) return new Date().toISOString().split('T')[0];
    const startDate = new Date(addForm.start_date);
    startDate.setDate(startDate.getDate());
    return startDate.toISOString().split('T')[0];
  };

  const getMinCompletionDate = () => {
    if (!editForm.start_date) return new Date().toISOString().split('T')[0];
    const startDate = new Date(editForm.start_date);
    startDate.setDate(startDate.getDate());
    return startDate.toISOString().split('T')[0];
  };

  const handleUpdate = async () => {
    if (!editForm.title) {
      toast.error('Please fill in the Title.');
      return;
    }
    if (!editForm.start_date) {
      toast.error('Please select a Start Date.');
      return;
    }
    if (!editForm.due_date) {
      toast.error('Please select a Due Date.');
      return;
    }
    if (editForm.start_date && editForm.due_date) {
      const startDate = new Date(editForm.start_date);
      const dueDate = new Date(editForm.due_date);
      if (startDate > dueDate) {
        toast.error('Start date cannot be after due date.');
        return;
      }
    }
    if (editForm.status === 'Completed' && editForm.completion_date && editForm.start_date) {
      const completionDate = new Date(editForm.completion_date);
      const startDate = new Date(editForm.start_date);
      if (completionDate < startDate) {
        toast.error('Completion date cannot be before start date.');
        return;
      }
    }

    setLoading(true);
    const updatedForm = {
      ...editForm,
      completion_date:
        editForm.status === 'Completed'
          ? editForm.completion_date || formatDate(new Date())
          : null,
    };

    try {
      const response = await axios.put(`${BACKEND_URL}/api/tasks/${editTask.task_id}`, updatedForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      const updatedTask = response.data;
      if (!updatedTask.task_id) {
        throw new Error('Updated task missing task_id');
      }
      setGroupedTasks((prev) => {
        const newGrouped = { ...prev };
        updatedTask.employee_ids?.forEach((empId) => {
          const employeeId = empId.toString();
          if (newGrouped[employeeId]) {
            newGrouped[employeeId].tasks = newGrouped[employeeId].tasks
              .map((task) =>
                task.task_id === updatedTask.task_id
                  ? { ...task, ...updatedTask, employee_id: empId }
                  : task
              )
              .filter((task) => task.status !== 'Completed' && task.task_id)
              .sort((a, b) => (a.position || 0) - (b.position || 0));
          }
        });
        setFilteredTasks(applySearchFilter(newGrouped, searchQuery));
        return newGrouped;
      });
      toast.success('Task updated successfully');
      setEditTask(null);
    } catch (error) {
      toast.error('Failed to update task');
      await fetchTasks();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await axios.delete(`${BACKEND_URL}/api/tasks/${editTask.task_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setGroupedTasks((prev) => {
        const newGrouped = { ...prev };
        Object.keys(newGrouped).forEach((employeeId) => {
          newGrouped[employeeId].tasks = newGrouped[employeeId].tasks.filter(
            (task) => task.task_id !== editTask.task_id
          );
        });
        setFilteredTasks(applySearchFilter(newGrouped, searchQuery));
        return newGrouped;
      });
      toast.success('Task deleted successfully');
      setEditTask(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Task not found');
        setGroupedTasks((prev) => {
          const newGrouped = { ...prev };
          Object.keys(newGrouped).forEach((employeeId) => {
            newGrouped[employeeId].tasks = newGrouped[employeeId].tasks.filter(
              (task) => task.task_id !== editTask.task_id
            );
          });
          setFilteredTasks(applySearchFilter(newGrouped, searchQuery));
          return newGrouped;
        });
      } else {
        toast.error('Failed to delete task');
        await fetchTasks();
      }
    } finally {
      setLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditTask(null);
    setEditForm({});
    setShowDeleteConfirm(false);
  };

  const handleAddClick = (employeeId) => {
    setAddTask({ employeeId });
    setAddForm({
      title: '',
      description: '',
      start_date: new Date().toISOString().split('T')[0], // Default to current date
      due_date: '',
      priority: '',
      status: '',
      position: groupedTasks[employeeId]?.tasks.length || 0,
    });
  };

  const closeAddModal = () => {
    setAddTask(null);
    setAddForm({
      title: '',
      description: '',
      start_date: new Date().toISOString().split('T')[0], // Default to current date
      due_date: '',
      priority: '',
      status: '',
      position: 0,
    });
  };

  const handleAddTask = async () => {
    if (!addForm.title) {
      toast.error('Please fill in the Title.');
      return;
    }
    if (!addForm.start_date) {
      toast.error('Please select a Start Date.');
      return;
    }
    if (!addForm.due_date) {
      toast.error('Please select a Due Date.');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (addForm.start_date && addForm.start_date < today) {
      toast.error('Start date cannot be before today.');
      return;
    }
    if (addForm.start_date && addForm.due_date) {
      const startDate = new Date(addForm.start_date);
      const dueDate = new Date(addForm.due_date);
      if (startDate > dueDate) {
        toast.error('Start date cannot be after due date.');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/tasks/create-task`,
        {
          ...addForm,
          admin_id: adminId,
          assignedEmployees: [addTask.employeeId],
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      if (response.data.message === 'Task created and employees assigned') {
        const newTask = {
          ...addForm,
          task_id: response.data.task_id,
          employee_id: addTask.employeeId,
          employee_ids: [addTask.employeeId],
          position: addForm.position || 0,
        };

        setGroupedTasks((prev) => {
          const newGrouped = { ...prev };
          const employeeId = addTask.employeeId.toString();
          if (!newGrouped[employeeId]) {
            return prev;
          }
          newGrouped[employeeId].tasks = [
            ...newGrouped[employeeId].tasks.filter((t) => t.task_id !== newTask.task_id),
            newTask,
          ].sort((a, b) => (a.position || 0) - (b.position || 0));
          setFilteredTasks(applySearchFilter(newGrouped, searchQuery));
          return newGrouped;
        });

        toast.success('Task assigned successfully');
        closeAddModal();
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (error) {
      toast.error('Failed to assign task');
      await fetchTasks();
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination || (source.index === destination.index && source.droppableId === destination.droppableId)) {
      return;
    }

    setLoading(true);
    const employeeId = source.droppableId;
    const newGroupedTasks = { ...groupedTasks };
    const tasks = [...newGroupedTasks[employeeId].tasks];

    const [reorderedTask] = tasks.splice(source.index, 1);
    tasks.splice(destination.index, 0, reorderedTask);

    const updatedTasks = tasks.map((task, index) => ({
      ...task,
      position: index,
    }));

    newGroupedTasks[employeeId].tasks = updatedTasks;
    setGroupedTasks(newGroupedTasks);
    setFilteredTasks(applySearchFilter(newGroupedTasks, searchQuery));

    try {
      const updatePromises = updatedTasks.map((task) =>
        axios.put(
          `${BACKEND_URL}/api/tasks/${task.task_id}`,
          { position: task.position },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        )
      );
      await Promise.all(updatePromises);
    } catch (error) {
      toast.error('Failed to update task order');
      await fetchTasks();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 py-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl">
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
            <p className="mt-2 text-white text-sm font-medium">Loading...</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-indigo-900 text-center sm:text-left">
          📋 Assigned Tasks
        </h2>
        <div className="mt-3 sm:mt-0 sm:ml-4 flex items-center w-full sm:w-64">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
              disabled={loading}
            />
            <FaSearch className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-indigo-400 text-sm" />
          </div>
        </div>
      </div>

      {Object.keys(filteredTasks).length === 0 ? (
        <p className="text-center text-indigo-600 text-sm sm:text-base font-medium">
          {searchQuery ? 'No matching tasks found.' : 'No employees found.'}
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {Object.entries(filteredTasks).map(([employeeId, { employeeName, gender, tasks }]) => (
              <div
                key={employeeId}
                className="bg-white border border-indigo-100 rounded-xl shadow-md p-4 sm:p-5 mb-4 break-inside-avoid bg-gradient-to-r from-indigo-50/50 to-purple-50/50"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-indigo-900 flex items-center gap-1.5 mb-2 sm:mb-0">
                    {gender === 'female' ? (
                      <FaFemale className="text-indigo-500 text-lg" />
                    ) : (
                      <FaMale className="text-purple-500 text-lg" />
                    )}
                    <span className="truncate max-w-[150px] sm:max-w-[200px]">{employeeName}</span>
                    <span className="text-indigo-500 text-xs sm:text-sm ml-1">
                      ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
                    </span>
                  </h3>
                  <button
                    onClick={() => handleAddClick(employeeId)}
                    className="bg-indigo-500 cursor-pointer hover:bg-indigo-600 text-white px-2 py-1 rounded-md text-xs sm:text-sm flex items-center gap-1 transition-all duration-200"
                    disabled={loading}
                  >
                    <FaPlus className="text-lg" />
                  </button>
                </div>

                <Droppable droppableId={employeeId}>
                  {(provided) => (
                    <ul
                      className="space-y-2"
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {tasks.length === 0 ? (
                        <li className="text-center text-indigo-600 text-xs sm:text-sm py-3 font-medium">
                          No active tasks.
                        </li>
                      ) : (
                        tasks
                          .filter((task) => task.task_id)
                          .map((task, index) => (
                            <Draggable
                              key={task.task_id}
                              draggableId={task.task_id.toString()}
                              index={index}
                            >
                              {(provided) => (
                                <li
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="bg-indigo-50/50 border border-indigo-200 rounded-md p-2 flex items-center justify-between"
                                >
                                  <span className="text-indigo-800 text-xs sm:text-sm font-medium truncate flex-1 mr-2">
                                    {task.title}
                                  </span>
                                  <button
                                    onClick={() => handleEditClick(task)}
                                    className="text-purple-600 hover:text-purple-800 transition-all duration-200"
                                    disabled={loading}
                                  >
                                    <FaEdit className="text-lg" />
                                  </button>
                                </li>
                              )}
                            </Draggable>
                          ))
                      )}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {editTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-xl p-4 sm:p-6 max-h-[85vh] overflow-y-auto bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
            {!showDeleteConfirm ? (
              <>
                <h3 className="text-lg sm:text-xl font-semibold text-indigo-900 mb-4">Edit Task</h3>
                <div className="grid grid-cols-1 gap-3">
                  {['title', 'description'].map((field) => (
                    <div key={field}>
                      <label className="block text-indigo-800 text-sm font-medium capitalize mb-1">
                        {field} {field === 'title' && <span className="text-purple-500">*</span>}
                      </label>
                      {field === 'description' ? (
                        <textarea
                          name={field}
                          value={editForm[field] || ''}
                          onChange={(e) => handleChange(e, 'edit')}
                          placeholder={field}
                          className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200 resize-none"
                          rows="3"
                          disabled={loading}
                        />
                      ) : (
                        <input
                          name={field}
                          value={editForm[field] || ''}
                          onChange={(e) => handleChange(e, 'edit')}
                          placeholder={field}
                          className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                          required={field === 'title'}
                          disabled={loading}
                        />
                      )}
                    </div>
                  ))}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-indigo-800 text-sm font-medium mb-1">
                        Start Date <span className="text-purple-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="start_date"
                        value={formatDate(editForm.start_date)}
                        onChange={(e) => handleChange(e, 'edit')}
                        max={editForm.due_date || undefined}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                        required
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-indigo-800 text-sm font-medium mb-1">
                        Due Date <span className="text-purple-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="due_date"
                        value={formatDate(editForm.due_date)}
                        onChange={(e) => handleChange(e, 'edit')}
                        min={getMinDueDate()}
                        className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-indigo-800 text-sm font-medium mb-1">Priority</label>
                    <select
                      name="priority"
                      value={editForm.priority || ''}
                      onChange={(e) => handleChange(e, 'edit')}
                      className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                      disabled={loading}
                    >
                      <option value="">Select Priority</option>
                      <option>Low</option>
                      <option>Medium</option>
                      <option>High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-indigo-800 text-sm font-medium mb-1">Status</label>
                    <select
                      name="status"
                      value={editForm.status || ''}
                      onChange={(e) => handleChange(e, 'edit')}
                      className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                      disabled={loading}
                    >
                      <option value="">Select Status</option>
                      <option>Todo</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </div>
                  {editForm.status === 'Completed' && (
                    <div>
                      <label className="block text-indigo-800 text-sm font-medium mb-1">Completion Date</label>
                      <input
                        type="date"
                        name="completion_date"
                        value={editForm.completion_date}
                        onChange={(e) => handleChange(e, 'edit')}
                        min={getMinCompletionDate()}
                        className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row justify-between gap-2 mt-4">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="bg-purple-500 cursor-pointer hover:bg-purple-600 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                      disabled={loading}
                    >
                      <FaTrash className="text-xs" /> Delete
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdate}
                        className="bg-indigo-500 cursor-pointer hover:bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                        disabled={loading}
                      >
                        <span>✅ Save</span>
                      </button>
                      <button
                        onClick={closeEditModal}
                        className="bg-gray-400 cursor-pointer hover:bg-gray-500 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                        disabled={loading}
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
                  Are you sure you want to delete the task "<strong>{editForm.title}</strong>"? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleDelete}
                    className="bg-purple-500 cursor-pointer hover:bg-purple-600 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                    disabled={loading}
                  >
                    <FaTrash className="text-xs" />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-500 cursor-pointer hover:bg-gray-600 text-white px-4 py-1.5 rounded-md text-sm flex items-center gap-1 transition-all duration-200"
                    disabled={loading}
                  >
                    <span>❌ Cancel</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {addTask && (
        <div className="fixed inset-0 bg-black/50 z-[50] flex items-center justify-center px-4">
          <div className="bg-white w-full max-w-md rounded-xl p-4 sm:p-6 max-h-[85vh] overflow-y-auto bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
            <h3 className=" text-xl font-semibold text-indigo-700 mb-4">Add New Task</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-indigo-600 text-sm font-semibold mb-1">
                  Title <span className="text-purple-500">*</span>
                </label>
                <input
                  name="title"
                  value={addForm.title}
                  onChange={(e) => handleChange(e, 'add')}
                  placeholder="Enter task title"
                  className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-indigo-600 text-sm font-semibold mb-1">Description</label>
                <textarea
                  name="description"
                  value={addForm.description}
                  onChange={(e) => handleChange(e, 'add')}
                  placeholder="Enter task description"
                  className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200 resize-none"
                  rows="3"
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-indigo-600 text-sm font-semibold mb-1">
                    Start Date <span className="text-purple-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={addForm.start_date}
                    onChange={(e) => handleChange(e, 'add')}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-indigo-600 text-sm font-semibold mb-1">
                    Due Date <span className="text-purple-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={addForm.due_date}
                    onChange={(e) => handleChange(e, 'add')}
                    min={getMinDueDate()}
                    className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-indigo-600 text-sm font-semibold mb-1">Priority</label>
                <select
                  name="priority"
                  value={addForm.priority}
                  onChange={(e) => handleChange(e, 'add')}
                  className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm transition-all duration-200"
                  disabled={loading}
                >
                  <option value="">Select Priority</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div>
                <label className="block text-indigo-600 text-sm font-semibold mb-1">Status</label>
                <select
                  name="status"
                  value={addForm.status}
                  onChange={(e) => handleChange(e, 'add')}
                  className="w-full border border-indigo-200 px-3 py-1.5 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all duration-200"
                  disabled={loading}
                >
                  <option value="">Select Status</option>
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  onClick={handleAddTask}
                  className="bg-indigo-600 cursor-pointer hover:bg-indigo-700 text-white px-6 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                  disabled={loading}
                >
                  <FaPlus className="text-sm" /> Add Task
                </button>
                <button
                  onClick={closeAddModal}
                  className="bg-gray-500 cursor-pointer hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-all duration-200"
                  disabled={loading}
                >
                  <span>❌ Cancel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  ); 
};

export default ViewAssignedTasks;