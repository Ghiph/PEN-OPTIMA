import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DataCenter from './pages/DataCenter.jsx';
import WellLogs from './pages/WellLogs.jsx';
import Volumetrics from './pages/Volumetrics.jsx';
import ZoneSegment from './pages/ZoneSegment.jsx';
import VariogramAssistant from './pages/VariogramAssistant.jsx';
import FieldMap from './pages/FieldMap.jsx';
import DevelopmentPlan from './pages/DevelopmentPlan.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/data-center" element={<DataCenter />} />
        <Route path="/well-logs" element={<WellLogs />} />
        <Route path="/volumetrics" element={<Volumetrics />} />
        <Route path="/zone-segment" element={<ZoneSegment />} />
        <Route path="/variogram" element={<VariogramAssistant />} />
        <Route path="/field-map" element={<FieldMap />} />
        <Route path="/development-plan" element={<DevelopmentPlan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
