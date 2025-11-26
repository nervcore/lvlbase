'use client';

import { ConnectWallet, Wallet } from '@coinbase/onchainkit/wallet';
import { useAccount, useSignMessage, useDisconnect, useWriteContract } from 'wagmi';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

// CONFIG
const NFT_CONTRACT_ADDRESS = "0x1b55a04b503ee09af6d953a0242f69b1e6cd6f97";
const ZORA_FEE = BigInt("777000000000000"); 

export default function Home() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  
  // NAVIGASI
  const [activeTab, setActiveTab] = useState<'home' | 'quest' | 'rank'>('home');
  
  const [playerData, setPlayerData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [quests, setQuests] = useState<any[]>([]);
  
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [isShareLinkOpened, setIsShareLinkOpened] = useState(false); 
  const [isLikeLinkOpened, setIsLikeLinkOpened] = useState(false);
  
  const [hasMintedWelcome, setHasMintedWelcome] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [canClaimWeekly, setCanClaimWeekly] = useState(false);
  
  const [showRankModal, setShowRankModal] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) localStorage.setItem('referrer', ref);
  }, [searchParams]);

  // --- DATA BADGES ---
  const BADGES = [
    { name: "PLANKTON 🦠", days: 0, color: "text-green-400", border: "border-green-500", desc: "Beginner", boost: "1x XP (Normal)" },
    { name: "SHRIMP 🦐", days: 14, color: "text-pink-400", border: "border-pink-500", desc: "14 Days Login", boost: "1.1x XP Boost" },
    { name: "DOLPHIN 🐬", days: 30, color: "text-cyan-400", border: "border-cyan-500", desc: "30 Days Login", boost: "1.25x XP Boost" },
    { name: "SHARK 🦈", days: 90, color: "text-blue-400", border: "border-blue-500", desc: "90 Days Login", boost: "1.5x XP Boost" },
    { name: "WHALE 🐋", days: 180, color: "text-purple-400", border: "border-purple-500", desc: "180 Days Login", boost: "2x XP (Double)" },
    { name: "KRAKEN 🦑", days: 365, color: "text-red-500", border: "border-red-500", desc: "1 Year Login", boost: "3x XP (Legend)" },
  ];

  const getBadgeRank = (days: number) => {
    for (let i = BADGES.length - 1; i >= 0; i--) {
        if (days >= BADGES[i].days) return BADGES[i];
    }
    return BADGES[0];
  };

  const currentBadge = getBadgeRank(playerData?.total_login_days || 0);

  // --- FETCH ---
  async function fetchPlayerData() {
    if (!address) return;
    const { data } = await supabase.from('users').select('*').eq('wallet_address', address).single();
    if (data) {
      setPlayerData(data);
      const now = new Date().toISOString().split('T')[0];
      if (data.last_checkin?.split('T')[0] === now) setHasCheckedIn(true);
      if (data.last_share_date?.split('T')[0] === now) setHasShared(true);
      if (data.last_daily_like?.split('T')[0] === now) setHasLiked(true);
      if (data.has_minted_welcome) setHasMintedWelcome(true);
      const lastClaim = data.last_weekly_claim ? new Date(data.last_weekly_claim).getTime() : 0;
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (data.current_streak >= 7 && (new Date().getTime() - lastClaim) > oneWeek) setCanClaimWeekly(true);
    }
  }

  async function fetchLeaderboard() {
    const res = await fetch('/api/leaderboard');
    const json = await res.json();
    if (json.success) setLeaderboard(json.data);
  }

  async function fetchQuests() {
    if (!address) return;
    const res = await fetch(`/api/quests?address=${address}`);
    const json = await res.json();
    if (json.success) setQuests(json.data);
  }

  useEffect(() => {
    if (isConnected && address) { fetchPlayerData(); setIsDropdownOpen(false); }
  }, [isConnected, address]);

  useEffect(() => {
    if (activeTab === 'rank') fetchLeaderboard();
    if (activeTab === 'quest') fetchQuests();
  }, [activeTab]);

  // --- ACTIONS ---
  const handleCheckIn = async () => {
    if (!address) return; setLoading(true); setStatusMsg("✍️ Signing...");
    try {
      const date = new Date().toISOString().split('T')[0];
      const message = `Check-in to LvLBASE: ${date}`;
      const signature = await signMessageAsync({ message });
      const referrer = localStorage.getItem('referrer');
      setStatusMsg("🚀 Sending...");
      const response = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, signature, message, referrer }), });
      const data = await response.json();
      if (data.success) { setStatusMsg("✅ Success!"); setPlayerData(data.user); setHasCheckedIn(true); localStorage.removeItem('referrer'); } 
      else { setStatusMsg(`⚠️ ${data.message}`); if(data.success===false) setHasCheckedIn(true); }
    } catch (err) { setStatusMsg("❌ Cancelled"); } finally { setLoading(false); }
  };

  const handleWeeklyClaim = async () => {
    if (!canClaimWeekly) return; setLoading(true);
    try {
      const res = await fetch('/api/weekly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }), });
      const data = await res.json(); if (data.success) { setStatusMsg("🎁 Reward Claimed!"); setPlayerData(data.user); setCanClaimWeekly(false); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (hasShared) return;
    if (!isShareLinkOpened) {
        const baseUrl = window.location.origin; 
        const refLink = `${baseUrl}/?ref=${address}`;
        // Generate Link Gambar (Nanti akan muncul otomatis di Vercel)
        const imageUrl = `${baseUrl}/api/og?level=${playerData?.level || 1}&streak=${playerData?.current_streak || 1}&xp=${playerData?.xp || 0}`;
        
        // TEKS BERSIH (Tanpa Link Mentah)
        const text = `I'm on a ${playerData?.current_streak || 1}-day streak on LvLBASE! 🚀\n\nJoin my squad & earn XP onchain! 👇`;
        
        // MASUKKAN LINK KE 'EMBEDS' (Agar jadi Card/Tombol)
        // Di Localhost ini cuma akan terlihat link biasa di bawah teks.
        // Di Vercel, ini akan jadi KOTAK PREVIEW GAMBAR + TOMBOL KLIK.
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(refLink)}`;
        
        window.open(url, '_blank'); 
        setIsShareLinkOpened(true); 
        setStatusMsg("👀 Post it, then click VERIFY!"); 
        return;
    }
    setStatusMsg("⏳ Checking...");
    setTimeout(async () => {
      const newXP = (playerData?.xp || 0) + 30;
      const { data } = await supabase.from('users').update({ xp: newXP, last_share_date: new Date().toISOString() }).eq('wallet_address', address).select().single();
      if (data) { setPlayerData(data); setHasShared(true); setIsShareLinkOpened(false); setStatusMsg("✅ Verified! +30 XP Claimed!"); }
    }, 1500);
  };

  const handleDailyLike = async () => {
    if (hasLiked) return;
    if (!isLikeLinkOpened) {
        const founderPost = "https://warpcast.com/rainssy"; 
        window.open(founderPost, '_blank'); setIsLikeLinkOpened(true); setStatusMsg("❤️ Like the post, then click VERIFY!"); return;
    }
    setStatusMsg("⏳ Checking...");
    setTimeout(async () => {
        const res = await fetch('/api/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, type: 'daily_like' }), });
        const json = await res.json(); if (json.success) { setHasLiked(true); setIsLikeLinkOpened(false); setStatusMsg("✅ Liked! +30 XP"); fetchPlayerData(); } else { setStatusMsg("⚠️ " + json.message); }
    }, 1500);
  };

  const handleQuestClick = async (quest: any) => {
    window.open(quest.link, '_blank');
    if (quest.is_completed) return;
    setStatusMsg(`⏳ Verifying ${quest.title}...`);
    setTimeout(async () => {
        const res = await fetch('/api/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, type: 'partner_quest', quest_id: quest.id }), });
        const json = await res.json(); if (json.success) { setStatusMsg(`✅ ${quest.title} Done!`); fetchQuests(); fetchPlayerData(); }
    }, 3000); 
  };

  const handleMintWelcome = async () => {
    if (hasMintedWelcome) return; 
    if (playerData?.has_minted_welcome) { const text = `I just collected my Starter Badge on LvLBASE!`; window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`, '_blank'); return; }
    setMinting(true); setStatusMsg("🦊 Confirm in Wallet...");
    try {
      await writeContractAsync({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: [{"inputs": [{"internalType": "address","name": "recipient","type": "address"},{"internalType": "uint256","name": "quantity","type": "uint256"},{"internalType": "string","name": "comment","type": "string"},{"internalType": "address","name": "mintReferral","type": "address"}],"name": "mintWithRewards","outputs": [{"internalType": "uint256","name": "","type": "uint256"}],"stateMutability": "payable","type": "function"}],
        functionName: 'mintWithRewards',
        args: [address as `0x${string}`, BigInt(1), "LvLBASE Starter", "0x0000000000000000000000000000000000000000"],
        value: ZORA_FEE,
      });
      setStatusMsg("⛓️ Minting...");
      if (!playerData?.has_claimed_mint_reward) {
          const newXP = (playerData?.xp || 0) + 500;
          const { data } = await supabase.from('users').update({ has_minted_welcome: true, has_claimed_mint_reward: true, xp: newXP }).eq('wallet_address', address).select().single();
          if(data) setPlayerData(data);
      }
      setHasMintedWelcome(true); setStatusMsg("✅ MINT SUCCESS! +500 XP");
    } catch (err: any) { setStatusMsg("❌ Mint Failed"); } finally { setMinting(false); }
  };

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const activeQuests = quests.filter(q => !q.is_completed);
  const completedQuests = quests.filter(q => q.is_completed);

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?ref=${address}`;
    navigator.clipboard.writeText(link);
    setStatusMsg("📋 Link Copied!");
    setTimeout(() => setStatusMsg(""), 2000);
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center pt-8 px-4 font-sans pb-28" onClick={() => { setIsDropdownOpen(false); setShowRankModal(false); }}>
      
      {/* HEADER */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 relative z-50">
        <h1 className="text-2xl font-bold text-blue-500 tracking-wider">LvLBASE</h1>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          {!isConnected ? (
            <Wallet><ConnectWallet className="bg-blue-600 text-white font-bold py-2 px-4 rounded-xl">Connect</ConnectWallet></Wallet>
          ) : (
            <div className="relative">
              <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 bg-gray-900 border border-gray-700 text-white py-2 px-3 rounded-xl">
                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500"></div>
                <span className="font-mono font-bold text-sm hidden sm:block">{shortAddress(address || '')}</span><span className="text-xs">▼</span>
              </button>
              {isDropdownOpen && (<div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl p-2 z-[100]"><button onClick={() => disconnect()} className="w-full text-left px-4 py-2 text-sm text-red-400">🚪 Disconnect</button></div>)}
            </div>
          )}
        </div>
      </div>

      {/* MODAL RANK IKAN (UPDATED DENGAN BOOST INFO) */}
      {showRankModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md relative shadow-2xl animate-in zoom-in-95">
                <button onClick={() => setShowRankModal(false)} className="absolute top-4 right-4 text-gray-400 text-2xl">&times;</button>
                <h3 className="text-xl font-bold text-center mb-6 text-blue-400">Ocean Hierarchy</h3>
                
                <div className="grid grid-cols-2 gap-3"> {/* Ubah jadi 2 kolom biar info muat */}
                    {BADGES.map((badge) => (
                        <div key={badge.name} className={`flex flex-col items-center p-3 rounded-xl border ${badge.days <= (playerData?.total_login_days || 0) ? 'bg-blue-900/20 border-blue-500' : 'bg-black/40 border-gray-800 opacity-50'}`}>
                            <div className="text-2xl mb-1">{badge.name.split(' ')[1]}</div>
                            <p className={`text-xs font-bold ${badge.color} text-center`}>{badge.name.split(' ')[0]}</p>
                            <p className="text-[10px] text-gray-400">{badge.desc}</p>
                            <div className="mt-1 px-2 py-0.5 bg-white/10 rounded text-[9px] text-white font-mono">{badge.boost}</div>
                        </div>
                    ))}
                </div>
                <p className="text-center text-[10px] text-gray-500 mt-4 italic">*Multiplier activated via smart contract soon</p>
            </div>
        </div>
      )}

      {isConnected ? (
        <div className="w-full max-w-md space-y-6 relative z-10">
          
          {/* --- TAB: HOME --- */}
          {activeTab === 'home' && (
            <>
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full"></div>
                
                {/* BADGE KLIKABLE */}
                <div className="flex justify-between items-center mb-4">
                    <button onClick={(e) => { e.stopPropagation(); setShowRankModal(true); }} className={`px-3 py-1 rounded-full border ${currentBadge.border} bg-black/50 backdrop-blur-md hover:scale-105 transition-transform`}>
                        <p className={`text-xs font-bold ${currentBadge.color} tracking-widest`}>{currentBadge.name} ℹ️</p>
                    </button>
                    <p className="text-gray-500 text-xs">Day {playerData?.total_login_days || 1}</p>
                </div>

                <div className="flex justify-between items-start relative z-10">
                  <div><p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Level</p><h2 className="text-5xl font-black text-white tracking-tighter">LVL {playerData?.level || 1}</h2></div>
                  <div className="text-right"><p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Total XP</p><h2 className="text-3xl font-bold text-blue-400 drop-shadow-glow">{playerData?.xp || 0} XP</h2></div>
                </div>
                <div className="mt-8">
                  <div className="flex justify-between items-end mb-2"><span className="text-orange-500 font-bold flex items-center gap-2 text-lg">🔥 {playerData?.current_streak || 0} Streak</span><span className="text-xs text-gray-500">Target: 7 Days</span></div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden"><div className="bg-gradient-to-r from-orange-500 to-red-600 h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((playerData?.current_streak || 0) / 7 * 100, 100)}%` }}></div></div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
                 <div><p className="text-purple-300 font-bold text-sm">Invite Friends</p><p className="text-xs text-gray-400">Invited: <span className="text-white font-bold">{playerData?.referral_count || 0}</span> • +50 XP</p></div>
                 <button onClick={copyInviteLink} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2 rounded-lg">📋 COPY</button>
              </div>

              <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-2xl p-5 flex items-center justify-between">
                 <div className="flex items-center gap-4"><div className="text-3xl">🛡️</div><div><p className="text-blue-300 font-bold text-sm">Starter Badge</p><p className="text-xs text-gray-400">+500 XP Boost!</p></div></div>
                 <button onClick={handleMintWelcome} disabled={minting} className={`px-4 py-2 rounded-lg text-xs font-bold shadow-lg ${hasMintedWelcome ? 'bg-cyan-600 text-white' : 'bg-white text-black animate-pulse'}`}>{minting ? '...' : hasMintedWelcome ? 'SHARE' : 'MINT'}</button>
              </div>

              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-500">🎁 Weekly Challenge</h3>
                <div className="bg-black/60 p-4 rounded-xl border border-yellow-900/30 flex items-center justify-between">
                  <div><p className="font-bold text-white">7-Day Streak</p><p className="text-xs text-gray-400">{playerData?.current_streak}/7 Days</p></div>
                  <button onClick={handleWeeklyClaim} disabled={!canClaimWeekly || loading} className={`px-4 py-2 rounded-lg text-xs font-bold ${canClaimWeekly ? 'bg-yellow-500 text-black hover:bg-yellow-400 animate-pulse' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>{playerData?.current_streak >= 7 && !canClaimWeekly ? 'CLAIMED' : 'CLAIM'}</button>
                </div>
              </div>

              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-200">📅 Daily Missions</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${hasCheckedIn ? 'bg-green-900/20 text-green-500' : 'bg-blue-900/20 text-blue-500'}`}>✍️</div><div><p className="font-bold text-white">Daily Sign</p><p className="text-xs text-gray-400">+20 XP</p></div></div>
                    <button onClick={handleCheckIn} disabled={loading || hasCheckedIn} className={`px-5 py-2 rounded-lg text-xs font-bold ${hasCheckedIn ? 'bg-green-600 text-white cursor-default' : 'bg-white text-black'}`}>{loading ? '...' : hasCheckedIn ? 'DONE' : 'CLAIM'}</button>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${hasLiked ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-500'}`}>❤️</div><div><p className="font-bold text-white">Like Post</p><p className="text-xs text-gray-400">+30 XP</p></div></div>
                    <button onClick={handleDailyLike} disabled={hasLiked} className={`px-5 py-2 rounded-lg text-xs font-bold ${hasLiked ? 'bg-green-600 text-white cursor-default' : isLikeLinkOpened ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-white'}`}>{hasLiked ? 'DONE' : isLikeLinkOpened ? 'VERIFY' : 'GO'}</button>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${hasShared ? 'bg-green-900/20 text-green-500' : 'bg-purple-900/20 text-purple-500'}`}>📢</div><div><p className="font-bold text-white">Share Streak</p><p className="text-xs text-gray-400">+30 XP</p></div></div>
                    <button onClick={handleShare} disabled={hasShared} className={`px-5 py-2 rounded-lg text-xs font-bold ${hasShared ? 'bg-green-600 text-white' : isShareLinkOpened ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-white'}`}>{hasShared ? 'DONE' : isShareLinkOpened ? 'VERIFY' : 'SHARE'}</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB QUEST */}
          {activeTab === 'quest' && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">📜 Ecosystem Quests</h3>
              <div className="space-y-3">
                {quests.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">Loading...</p> 
                ) : (
                  <>
                    {activeQuests.map((q) => (
                      <div key={q.id} className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{q.icon}</div>
                          <div><p className="font-bold text-white text-sm">{q.title}</p><p className="text-xs text-gray-400">+{q.xp_reward} XP</p></div>
                        </div>
                        <button onClick={() => handleQuestClick(q)} className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white">START</button>
                      </div>
                    ))}
                    
                    {completedQuests.length > 0 && activeQuests.length > 0 && (
                      <div className="py-4 flex items-center gap-4">
                        <div className="h-px bg-gray-800 flex-1"></div>
                        <span className="text-xs text-gray-600 font-bold uppercase">Completed</span>
                        <div className="h-px bg-gray-800 flex-1"></div>
                      </div>
                    )}

                    {completedQuests.map((q) => (
                      <div key={q.id} className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-gray-800/50 opacity-60">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl grayscale">{q.icon}</div>
                          <div><p className="font-bold text-gray-400 text-sm line-through">{q.title}</p><p className="text-xs text-gray-600">Completed</p></div>
                        </div>
                        <button onClick={() => window.open(q.link, '_blank')} className="px-4 py-2 rounded-lg text-xs font-bold bg-green-900/30 text-green-600 border border-green-900/50 cursor-pointer">DONE (VISIT)</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB RANK */}
          {activeTab === 'rank' && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-400">🏆 Top Grinders</h3>
              <div className="space-y-2">
                {leaderboard.map((user, index) => (
                  <div key={user.wallet_address} className={`flex items-center justify-between p-3 rounded-xl border ${user.wallet_address === address ? 'bg-blue-900/20 border-blue-500/50' : 'bg-black/40 border-gray-800'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`font-bold w-6 text-center ${index === 0 ? 'text-yellow-400 text-xl' : 'text-gray-500'}`}>{index + 1}</div>
                      <div><p className={`font-mono text-sm ${user.wallet_address === address ? 'text-blue-400 font-bold' : 'text-gray-300'}`}>{user.wallet_address === address ? 'YOU' : shortAddress(user.wallet_address)}</p><p className="text-xs text-gray-500">Lvl {user.level} • {user.current_streak} Day Streak</p></div>
                    </div>
                    <div className="font-bold text-white">{user.xp} XP</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {statusMsg && <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-gray-700 px-4 py-2 rounded-full shadow-2xl z-50"><p className="text-sm text-white animate-pulse">{statusMsg}</p></div>}
        </div>
      ) : (
        <div className="text-center mt-32 opacity-50"><p className="text-gray-400">Connect wallet to start</p></div>
      )}

      {/* BOTTOM NAVBAR */}
      {isConnected && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-full px-6 py-3 flex gap-8 shadow-2xl z-40">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-blue-500 scale-110' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-xl">🏠</span><span className="text-[10px] font-bold">HOME</span></button>
          <button onClick={() => setActiveTab('quest')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'quest' ? 'text-purple-500 scale-110' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-xl">📜</span><span className="text-[10px] font-bold">QUEST</span></button>
          <button onClick={() => setActiveTab('rank')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'rank' ? 'text-yellow-500 scale-110' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-xl">🏆</span><span className="text-[10px] font-bold">RANK</span></button>
        </div>
      )}
    </main>
  );
}