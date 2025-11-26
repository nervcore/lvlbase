import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';

// GET: Ambil daftar quest & status user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  try {
    // 1. Ambil semua quest aktif
    const { data: quests, error } = await supabase
      .from('quests')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error) throw error;

    // 2. Jika ada address, cari mana yang sudah dikerjakan
    let completedQuestIds: number[] = [];
    if (address) {
      const { data: completed } = await supabase
        .from('user_quests')
        .select('quest_id')
        .eq('wallet_address', address);
      
      if (completed) {
        completedQuestIds = completed.map((q: any) => q.quest_id);
      }
    }

    // 3. Gabungkan data
    const finalQuests = quests.map((q) => ({
      ...q,
      is_completed: completedQuestIds.includes(q.id)
    }));

    return NextResponse.json({ success: true, data: finalQuests });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Klaim Quest & Daily Like
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, type, quest_id } = body;

    // --- A. LOGIKA DAILY LIKE ---
    if (type === 'daily_like') {
        const { data: user } = await supabase.from('users').select('xp, last_daily_like').eq('wallet_address', address).single();
        
        // Cek apakah hari ini sudah like
        const now = new Date();
        const lastLike = user?.last_daily_like ? new Date(user.last_daily_like).toISOString().split('T')[0] : null;
        if (lastLike === now.toISOString().split('T')[0]) {
            return NextResponse.json({ success: false, message: 'Already liked today!' });
        }

        // Update User (+30 XP)
        await supabase.from('users').update({
            xp: (user?.xp || 0) + 30,
            last_daily_like: now.toISOString()
        }).eq('wallet_address', address);

        return NextResponse.json({ success: true, message: 'Daily Like claimed! +30 XP' });
    }

    // --- B. LOGIKA PARTNER QUEST (One Time) ---
    if (type === 'partner_quest' && quest_id) {
        // Cek apakah sudah pernah
        const { data: existing } = await supabase.from('user_quests').select('*').match({ wallet_address: address, quest_id }).single();
        if (existing) return NextResponse.json({ success: false, message: 'Quest already done!' });

        // Ambil info quest untuk tau rewardnya
        const { data: quest } = await supabase.from('quests').select('xp_reward').eq('id', quest_id).single();
        
        if (!quest) return NextResponse.json({ success: false, message: 'Quest not found' });

        // Catat "Sudah Dikerjakan"
        await supabase.from('user_quests').insert([{ wallet_address: address, quest_id }]);

        // Tambah XP User
        const { data: user } = await supabase.from('users').select('xp').eq('wallet_address', address).single();
        await supabase.from('users').update({ xp: (user?.xp || 0) + quest.xp_reward }).eq('wallet_address', address);

        return NextResponse.json({ success: true, message: `Quest Complete! +${quest.xp_reward} XP` });
    }

    return NextResponse.json({ success: false, message: 'Invalid Request' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}