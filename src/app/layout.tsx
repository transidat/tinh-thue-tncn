import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Phần mềm Tính Thuế TNCN (VN_PIT)',
  description: 'Hệ thống tính thuế thu nhập cá nhân theo luật thuế Việt Nam dành cho Kế toán',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

