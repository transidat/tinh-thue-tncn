import Navbar from '@/components/layout/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          Phần mềm Tính Thuế Thu Nhập Cá Nhân (VN_PIT) &bull; Dành cho Nhân viên Kế toán &bull; Tuân thủ Luật Thuế Việt Nam
        </div>
      </footer>
    </div>
  );
}

