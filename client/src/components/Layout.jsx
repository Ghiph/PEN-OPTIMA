import Sidebar from './Sidebar.jsx';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-navy-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
