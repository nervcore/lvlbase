import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';

// Cache data selama 60 detik biar database gak jebol kalau viral
export const revalidate = 60; 

export async function GET() {
  try {
    // Ambil data: wallet, xp, streak, level
    // Urutkan XP dari terbesar ke terkecil
    // Ambil cuma 50 orang teratas
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address, xp, level, current_streak')
      .order('xp', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}