import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children, role }) => {
  const adminToken = localStorage.getItem('token');
  const employeeToken = localStorage.getItem('employeeToken');

  if (role === 'admin' && adminToken) {
    return children;
  }
  if (role === 'user' && employeeToken) {
    return children;
  }

  return <Navigate to={role === 'admin' ? '/login' : '/user-login'} />;
};

export default PrivateRoute;