import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import FormLayout from './components/FormLayout';
import Step1 from './components/Step1';
import Step2 from './components/Step2';
import Step3 from './components/Step3';
import Step4 from './components/Step4';
import Confirmation from './components/Confirmation';
import AdminLogin from './components/admin/Login';
import AdminDashboard from './components/admin/Dashboard';
import AdminSubmissionDetail from './components/admin/SubmissionDetail';
import AdminLayout from './components/admin/AdminLayout';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  return token ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public form routes */}
        <Route path="/" element={<Navigate to="/form/step1" replace />} />
        <Route path="/form" element={<FormLayout />}>
          <Route path="step1" element={<Step1 />} />
          <Route path="step2/:id" element={<Step2 />} />
          <Route path="step3/:id" element={<Step3 />} />
          <Route path="step4/:id" element={<Step4 />} />
        </Route>
        <Route path="/confirmation/:id" element={<Confirmation />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="submissions/:id" element={<AdminSubmissionDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
