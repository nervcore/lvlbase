import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';

export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    // 1. Cek Umpan
    const { data: user } = await supabase.from('users').select('bait, xp').eq('wallet_address', address).single();
    
    if (!user || user.bait < 1) {
      return NextResponse.json({ success: false, message: 'No bait left! Claim more.' });
    }

    // 2. Kurangi Umpan
    await supabase.from('users').update({ bait: user.bait - 1 }).eq('wallet_address', address);

    // 3. RNG (Gacha Logic)
    const roll = Math.random() * 100;
    let rarity = 'common';
    if (roll < 1) rarity = 'legendary';      // 1%
    else if (roll < 5) rarity = 'epic';      // 4%
    else if (roll < 20) rarity = 'rare';     // 15%
    else if (roll < 50) rarity = 'uncommon'; // 30%
    
    // 4. Ambil Ikan Random sesuai Rarity
    const { data: fishes } = await supabase.from('fishes').select('*').eq('rarity', rarity);
    
    if (!fishes || fishes.length === 0) throw new Error("No fish found in DB");
    
    const caughtFish = fishes[Math.floor(Math.random() * fishes.length)];

    // 5. Masukkan ke Inventory User
    const { data: existingFish } = await supabase
      .from('user_fishes')
      .select('*')
      .match({ wallet_address: address, fish_id: caughtFish.id })
      .single();

    if (existingFish) {
      // Kalau sudah punya, tambah quantity
      await supabase.from('user_fishes').update({ quantity: existingFish.quantity + 1 }).eq('id', existingFish.id);
    } else {
      // Kalau belum, insert baru
      await supabase.from('user_fishes').insert([{ wallet_address: address, fish_id: caughtFish.id }]);
    }

    // 6. Tambah XP User
    const newXP = user.xp + caughtFish.xp_value;
    await supabase.from('users').update({ xp: newXP }).eq('wallet_address', address);

    return NextResponse.json({ 
      success: true, 
      fish: caughtFish,
      new_xp: newXP,
      new_bait: user.bait - 1
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET Inventory
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  if (!address) return NextResponse.json({ data: [] });

  const { data } = await supabase
    .from('user_fishes')
    .select('quantity, fishes(*)') // Join table fishes
    .eq('wallet_address', address);

  return NextResponse.json({ success: true, data });
}