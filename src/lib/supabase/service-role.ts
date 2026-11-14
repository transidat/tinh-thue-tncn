import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client sử dụng Service Role Key.
 * CHỈ SỬ DỤNG PHÍA SERVER (Server Actions, Route Handlers).
 * TUYỆT ĐỐI KHÔNG import hoặc gọi file này ở Client Components.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    throw new Error('Thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY trên server');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
