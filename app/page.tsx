'use client';

import { ConnectWallet, Wallet } from '@coinbase/onchainkit/wallet';
import { useAccount, useSignMessage, useDisconnect, useWriteContract, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';
import { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from './lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

// CONFIG
const NFT_CONTRACT_ADDRESS = "0x1b55a04b503ee09af6d953a0242f69b1e6cd6f97";
const ZORA_FEE = BigInt("777000000000000"); 
const DEV_WALLET = "0x09fa94d76E8d974cdd2B12ba1E3959CFd5447EfA"; 
const NFT_IMAGE_URL = "https://scontent-iad4-1.choicecdn.com/-/rs:fill:2000:2000/g:ce/f:webp/aHR0cHM6Ly9zY29udGVudC1pYWQ0LTEuY2hvaWNlY2RuLmNvbS8tL3JzOmZpdDoyNDAwOjI0MDAvZjpiZXN0L2FIUjBjSE02THk5dFlXZHBZeTVrWldObGJuUnlZV3hwZW1Wa0xXTnZiblJsYm5RdVkyOXRMMmx3Wm5NdlltRm1lV0psYVdWa1oyWnZjMkprYjJKdFpta3lhSFZ6ZVdJMmIyZHJkamRvWTNSNGNXWndkelV6YVRKbGMyRmlhbmMwWjJreWRYVndZM0U9";

// --- KOMPONEN ISOLASI: FISHING BAR ---
const FishingBar = ({ onCatch, onMiss }: { onCatch: () => void, onMiss: () => void }) => {
  const [barPos, setBarPos] = useState(0);
  const barPosRef = useRef(0); 
  const directionRef = useRef(1); 
  const reqRef = useRef<number>(0);
  const [target, setTarget] = useState({ start: 30, width: 25 }); 

  useEffect(() => {
    const start = Math.floor(Math.random() * 50) + 20;
    setTarget({ start, width: 25 });

    const animate = () => {
      setBarPos(prev => {
        let next = prev + (1.5 * directionRef.current);
        if (next >= 100) { next = 100; directionRef.current = -1; }
        if (next <= 0) { next = 0; directionRef.current = 1; }
        barPosRef.current = next;
        return next;
      });
      reqRef.current = requestAnimationFrame(animate);
    };
    reqRef.current = requestAnimationFrame(animate);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, []);

  const handleAttempt = () => {
    const pos = barPosRef.current;
    const isHit = pos >= target.start && pos <= (target.start + target.width);
    if (isHit) onCatch(); else onMiss();
  };

  return (
    <div className="w-full">
        <div className="h-8 w-full bg-gray-800 rounded-full relative border-2 border-gray-600 overflow-hidden mb-4">
            <div className="absolute top-0 h-full bg-green-500/60 border-x-2 border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]" style={{ left: `${target.start}%`, width: `${target.width}%` }}></div>
            <div className="absolute top-0 w-2 h-full bg-red-500 shadow-[0_0_10px_red] z-10" style={{ left: `${barPos}%`, transition: 'none' }}></div>
        </div>
        <button onClick={handleAttempt} className="w-full py-4 rounded-xl font-black text-xl shadow-lg bg-green-500 hover:bg-green-400 text-black scale-105 transition-transform border-b-4 border-green-700 active:border-b-0 active:translate-y-1">🎣 CATCH NOW!</button>
    </div>
  );
};

// --- KOMPONEN UTAMA ---
function MainAppContent() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FUNGSI HELPER: TOAST OTOMATIS HILANG (3 Detik)
  const triggerToast = (msg: string, duration = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setStatusMsg(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setStatusMsg("");
      toastTimeoutRef.current = null;
    }, duration);
  };
  
  const [activeTab, setActiveTab] = useState<'home' | 'quest' | 'game' | 'rank' | 'profile'>('home');
  const [gameSubTab, setGameSubTab] = useState<'play' | 'shop' | 'inventory' | 'claim'>('play');
  const [inventoryTab, setInventoryTab] = useState<'fish' | 'bait' | 'rod'>('fish');
  
  const [playerData, setPlayerData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [quests, setQuests] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  
  const [gameState, setGameState] = useState<'IDLE' | 'CASTING' | 'FIGHTING' | 'CAUGHT' | 'MISSED'>('IDLE');
  const [isFishing, setIsFishing] = useState(false);
  const [caughtFish, setCaughtFish] = useState<any>(null);

  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [isShareLinkOpened, setIsShareLinkOpened] = useState(false); 
  const [isLikeLinkOpened, setIsLikeLinkOpened] = useState(false);
  const [hasMintedWelcome, setHasMintedWelcome] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [canClaimWeekly, setCanClaimWeekly] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [canClaimSupply, setCanClaimSupply] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) localStorage.setItem('referrer', ref);
  }, [searchParams]);

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
  const dynamicLevel = Math.floor((playerData?.xp || 0) / 500) + 1;

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

      const lastSupply = data.last_claim_supply ? data.last_claim_supply.split('T')[0] : null;
      if (lastSupply !== now) { setCanClaimSupply(true); } else { setCanClaimSupply(false); }
    }
  }

  async function fetchInventory() {
    if (!address) return;
    const res = await fetch(`/api/game/fish?address=${address}`, { method: 'GET' });
    const json = await res.json();
    
    if (json.success && json.data) {
        const rarityOrder: any = { 'legendary': 4, 'epic': 3, 'rare': 2, 'uncommon': 1, 'common': 0 };
        const sorted = json.data.sort((a: any, b: any) => {
            const rankA = a.fishes ? rarityOrder[a.fishes.rarity] : -1;
            const rankB = b.fishes ? rarityOrder[b.fishes.rarity] : -1;
            return rankB - rankA;
        });
        setInventory(sorted);
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
    if (activeTab === 'game' || activeTab === 'profile') fetchInventory();
  }, [activeTab]);

  const startFishing = () => {
    if (playerData?.bait < 1) { triggerToast("❌ No Bait!"); return; }
    setGameState('CASTING');
    setIsFishing(true);
    setStatusMsg("🎣 Casting line...");
    setPlayerData((prev: any) => ({ ...prev, bait: Math.max(0, (prev.bait || 0) - 1) }));
    setTimeout(() => { setGameState('FIGHTING'); setStatusMsg("⚠️ TAP WHEN GREEN!"); }, 2000);
  };

  const handleCatchSuccess = async () => {
    setGameState('CAUGHT');
    setStatusMsg("🎉 GOTCHA! Pulling...");
    try {
        const res = await fetch('/api/game/fish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }), });
        const json = await res.json();
        if (json.success) {
            setCaughtFish(json.fish);
            setPlayerData((prev: any) => ({ ...prev, xp: json.new_xp, bait: json.new_bait }));
            fetchInventory();
            triggerToast(`🐟 You caught a ${json.fish.name}!`); 
        } else {
            setGameState('MISSED'); triggerToast("❌ Error: " + json.message);
        }
    } catch (e) { setGameState('MISSED'); }
  };

  const handleCatchMiss = () => {
    setGameState('MISSED');
    triggerToast("❌ MISSED! Fish escaped.");
    setTimeout(() => { setGameState('IDLE'); setIsFishing(false); }, 2000);
  };

  const resetGame = () => { setGameState('IDLE'); setIsFishing(false); setCaughtFish(null); setStatusMsg(""); };

  const handleExchangeFish = async (fish: any) => {
    let cost = 0;
    let rewardBait = 0;
    const rarity = fish.fishes.rarity;
    const qty = fish.quantity;

    if (rarity === 'common') { if (qty < 5) { triggerToast("⚠️ Need 5 Common fish!"); return; } cost = 5; rewardBait = 1; } 
    else if (rarity === 'uncommon') { if (qty < 2) { triggerToast("⚠️ Need 2 Uncommon fish!"); return; } cost = 2; rewardBait = 1; } 
    else if (rarity === 'rare') { cost = 1; rewardBait = 2; } 
    else if (rarity === 'epic') { cost = 1; rewardBait = 10; } 
    else if (rarity === 'legendary') { cost = 1; rewardBait = 50; }

    if (!confirm(`Trade ${cost} ${fish.fishes.name} for ${rewardBait} Bait?`)) return;

    setStatusMsg("♻️ Exchanging...");
    // Disini idealnya panggil API backend, tapi untuk MVP kita update client side dulu
    // (Note: Di production harus ada API /api/game/exchange untuk validasi)
    setPlayerData((prev: any) => ({ ...prev, bait: (prev.bait || 0) + rewardBait }));
    
    setInventory(prev => prev.map(item => {
        if(item.id === fish.id) return { ...item, quantity: item.quantity - cost };
        return item;
    }).filter(item => item.quantity > 0));

    triggerToast(`✅ Traded! +${rewardBait} Bait`);
  };

  const isCastDisabled = isFishing || (playerData?.bait || 0) < 1 || gameState === 'CAUGHT';
  let castButtonClass = 'bg-red-900/50 text-red-400 border border-red-900 cursor-not-allowed';
  if (isFishing && gameState !== 'FIGHTING') castButtonClass = 'bg-gray-700 text-gray-500 cursor-not-allowed';
  else if ((playerData?.bait || 0) > 0) castButtonClass = 'bg-cyan-600 hover:bg-cyan-500 text-white hover:scale-105';
  let castButtonText = 'NO BAIT!';
  if (isFishing && gameState !== 'FIGHTING') castButtonText = '...';
  else if ((playerData?.bait || 0) > 0) castButtonText = 'CAST ROD';

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
      if (data.success) { 
        triggerToast("✅ Success! +20 XP & +3 Bait"); 
        setPlayerData((prev:any) => ({...prev, xp: (prev.xp||0)+20, bait: (prev.bait||0)+3, current_streak: (prev.current_streak||0)+1}));
        setHasCheckedIn(true); localStorage.removeItem('referrer'); 
      } 
      else { triggerToast(`⚠️ ${data.message}`); if(data.success===false) setHasCheckedIn(true); }
    } catch (err) { triggerToast("❌ Cancelled"); } finally { setLoading(false); }
  };

  const handleWeeklyClaim = async () => {
    if (!canClaimWeekly) return; setLoading(true);
    try {
      const res = await fetch('/api/weekly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }), });
      const data = await res.json(); 
      if (data.success) { 
        triggerToast("🎁 Reward Claimed! +100 XP +10 Bait"); 
        setPlayerData((prev:any) => ({...prev, xp: (prev.xp||0)+100, bait: (prev.bait||0)+10})); 
        setCanClaimWeekly(false); 
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (hasShared) return;
    if (!isShareLinkOpened) {
        const baseUrl = window.location.origin; 
        const refLink = `${baseUrl}/?ref=${address}`;
        const imageUrl = `${baseUrl}/api/og?level=${dynamicLevel}&streak=${playerData?.current_streak}&xp=${playerData?.xp}`;
        const text = `I'm on a ${playerData?.current_streak || 1}-day streak on LvLBASE! 🚀 \n\nJoin my squad: ${refLink}`;
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(imageUrl)}`;
        window.open(url, '_blank'); setIsShareLinkOpened(true); triggerToast("👀 Post it, then click VERIFY!"); return;
    }
    setStatusMsg("⏳ Checking...");
    setTimeout(async () => {
      const newXP = (playerData?.xp || 0) + 30;
      const { data } = await supabase.from('users').update({ xp: newXP, last_share_date: new Date().toISOString(), bait: (playerData.bait||0)+1 }).eq('wallet_address', address).select().single();
      if (data) { setPlayerData(data); setHasShared(true); setIsShareLinkOpened(false); triggerToast("✅ Verified! +30 XP & +1 Bait"); }
    }, 1500);
  };

  const handleDailyLike = async () => {
    if (hasLiked) return;
    if (!isLikeLinkOpened) {
        const founderPost = "https://warpcast.com/rainssy"; 
        window.open(founderPost, '_blank'); setIsLikeLinkOpened(true); triggerToast("❤️ Like the post, then click VERIFY!"); return;
    }
    setStatusMsg("⏳ Checking...");
    setTimeout(async () => {
        const res = await fetch('/api/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, type: 'daily_like' }), });
        const json = await res.json(); 
        if (json.success) { 
            setHasLiked(true); setIsLikeLinkOpened(false); 
            triggerToast("✅ Liked! +30 XP & +1 Bait"); 
            setPlayerData((prev:any) => ({...prev, xp: (prev.xp||0)+30, bait: (prev.bait||0)+1}));
        } else { triggerToast("⚠️ " + json.message); }
    }, 1500);
  };

  const handleQuestClick = async (quest: any) => {
    window.open(quest.link, '_blank');
    if (quest.is_completed) return;
    setStatusMsg(`⏳ Verifying ${quest.title}...`);
    setTimeout(async () => {
        const res = await fetch('/api/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, type: 'partner_quest', quest_id: quest.id }), });
        const json = await res.json(); 
        if (json.success) { 
            triggerToast(`✅ ${quest.title} Done! +5 Bait`); 
            setPlayerData((prev:any) => ({...prev, bait: (prev.bait||0)+5}));
            fetchQuests(); 
        }
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
          const newBait = (playerData?.bait || 0) + 50;
          const { data } = await supabase.from('users').update({ 
              has_minted_welcome: true, 
              has_claimed_mint_reward: true, 
              xp: newXP,
              bait: newBait 
          }).eq('wallet_address', address).select().single();
          if(data) setPlayerData(data);
      }
      setHasMintedWelcome(true); triggerToast("✅ MINT SUCCESS! +500 XP & +50 BAIT");
    } catch (err: any) { triggerToast("❌ Mint Failed"); } finally { setMinting(false); }
  };

  const handleClaimSupply = async () => {
    if (!canClaimSupply) {
        triggerToast("❌ Daily limit reached! Come back tomorrow.");
        return;
    }
    setLoading(true); setStatusMsg("⛽ Confirm 0 ETH Tx...");
    try {
        const hash = await sendTransactionAsync({ to: DEV_WALLET as `0x${string}`, value: parseEther('0') });
        setStatusMsg("⛓️ Verifying Onchain...");
        const res = await fetch('/api/shop/claim-bait', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, txHash: hash }), });
        const data = await res.json();
        if (data.success) { 
            triggerToast("✅ +10 Bait Added!"); 
            setPlayerData((prev:any) => ({...prev, bait: (prev.bait||0)+10}));
            setCanClaimSupply(false); 
            fetchPlayerData();
        } 
        else { triggerToast(`⚠️ ${data.message}`); }
    } catch (err) { triggerToast("❌ Cancelled"); } finally { setLoading(false); }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?ref=${address}`;
    navigator.clipboard.writeText(link);
    triggerToast("📋 Link Copied!");
  };

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const activeQuests = quests.filter(q => !q.is_completed);
  const completedQuests = quests.filter(q => q.is_completed);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center pt-8 px-4 font-sans pb-32" onClick={() => { setIsDropdownOpen(false); setShowRankModal(false); }}>
      
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

      {showRankModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md relative shadow-2xl animate-in zoom-in-95">
                <button onClick={() => setShowRankModal(false)} className="absolute top-4 right-4 text-gray-400 text-2xl">&times;</button>
                <h3 className="text-xl font-bold text-center mb-6 text-blue-400">Ocean Hierarchy</h3>
                <div className="grid grid-cols-2 gap-3">
                    {BADGES.map((badge) => (
                        <div key={badge.name} className={`flex flex-col items-center p-3 rounded-xl border ${badge.days <= (playerData?.total_login_days || 0) ? 'bg-blue-900/20 border-blue-500' : 'bg-black/40 border-gray-800 opacity-50'}`}>
                            <div className="text-2xl mb-1">{badge.name.split(' ')[1]}</div>
                            <p className={`text-xs font-bold ${badge.color} text-center`}>{badge.name.split(' ')[0]}</p>
                            <p className="text-[10px] text-gray-400">{badge.desc}</p>
                            <div className="mt-1 px-2 py-0.5 bg-white/10 rounded text-[9px] text-white font-mono">{badge.boost}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {isConnected ? (
        <div className="w-full max-w-md space-y-6 relative z-10">
          
          {/* TAB HOME */}
          {activeTab === 'home' && (
            <>
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full"></div>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={(e) => { e.stopPropagation(); setShowRankModal(true); }} className={`px-3 py-1 rounded-full border ${currentBadge.border} bg-black/50 backdrop-blur-md hover:scale-105 transition-transform`}>
                        <p className={`text-xs font-bold ${currentBadge.color} tracking-widest`}>{currentBadge.name} ℹ️</p>
                    </button>
                    <p className="text-gray-500 text-xs">Day {playerData?.total_login_days || 1}</p>
                </div>
                <div className="flex justify-between items-start relative z-10">
                  <div><p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Level</p><h2 className="text-5xl font-black text-white tracking-tighter">LVL {dynamicLevel}</h2></div>
                  <div className="text-right"><p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Total XP</p><h2 className="text-3xl font-bold text-blue-400 drop-shadow-glow">{playerData?.xp || 0} XP</h2></div>
                </div>
                <div className="mt-8">
                  <div className="flex justify-between items-end mb-2"><span className="text-orange-500 font-bold flex items-center gap-2 text-lg">🔥 {playerData?.current_streak || 0} Streak</span><span className="text-xs text-gray-500">Target: 7 Days</span></div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden"><div className="bg-gradient-to-r from-orange-500 to-red-600 h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((playerData?.current_streak || 0) / 7 * 100, 100)}%` }}></div></div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
                 <div><p className="text-purple-300 font-bold text-sm">Invite Friends</p><p className="text-xs text-gray-400">Get <span className="text-white font-bold">+50 XP & +2 Bait</span> per invite</p></div>
                 <button onClick={copyInviteLink} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2 rounded-lg">📋 COPY</button>
              </div>

              <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-2xl p-5 flex items-center justify-between">
                 <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full border-2 border-blue-400 overflow-hidden">
                    <img src={NFT_IMAGE_URL} alt="Starter Badge" className="w-full h-full object-cover" />
                 </div><div><p className="text-blue-300 font-bold text-sm">Starter Badge</p><p className="text-xs text-gray-400">Holders get +500 XP & Something Special!</p></div></div>
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
                    <div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${hasCheckedIn ? 'bg-green-900/20 text-green-500' : 'bg-blue-900/20 text-blue-500'}`}>✍️</div><div><p className="font-bold text-white">Daily Sign</p><p className="text-xs text-gray-400">+20 XP + 3 Bait</p></div></div>
                    <button onClick={handleCheckIn} disabled={loading || hasCheckedIn} className={`px-5 py-2 rounded-lg text-xs font-bold ${hasCheckedIn ? 'bg-green-600 text-white cursor-default' : 'bg-white text-black'}`}>{loading ? '...' : hasCheckedIn ? 'DONE' : 'CLAIM'}</button>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${hasLiked ? 'bg-green-900/20 text-green-500' : 'bg-red-900/20 text-red-500'}`}>❤️</div><div><p className="font-bold text-white">Like Post</p><p className="text-xs text-gray-400">+30 XP + 1 Bait</p></div></div>
                    <button onClick={handleDailyLike} disabled={hasLiked} className={`px-5 py-2 rounded-lg text-xs font-bold ${hasLiked ? 'bg-green-600 text-white cursor-default' : isLikeLinkOpened ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-white'}`}>{hasLiked ? 'DONE' : isLikeLinkOpened ? 'VERIFY' : 'GO'}</button>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-4"><div className={`p-3 rounded-lg ${hasShared ? 'bg-green-900/20 text-green-500' : 'bg-purple-900/20 text-purple-500'}`}>📢</div><div><p className="font-bold text-white">Share Streak</p><p className="text-xs text-gray-400">+30 XP + 1 Bait</p></div></div>
                    <button onClick={handleShare} disabled={hasShared} className={`px-5 py-2 rounded-lg text-xs font-bold ${hasShared ? 'bg-green-600 text-white' : isShareLinkOpened ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-white'}`}>{hasShared ? 'DONE' : isShareLinkOpened ? 'VERIFY' : 'SHARE'}</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB GAME (FISHING) */}
          {activeTab === 'game' && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm relative flex flex-col min-h-[550px]">
              
              {gameSubTab === 'play' ? (
                <>
                  <div className="flex justify-between items-center mb-4">
                       <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2">🎣 Mystic Pond</h3>
                       <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => setGameSubTab('claim')}>
                          <span className="text-lg">🪱</span>
                          <span className="text-yellow-400 font-bold text-lg">{playerData?.bait || 0}</span>
                          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-black font-bold ml-1">+</div>
                       </div>
                  </div>

                  <div className="w-full flex-1 bg-gradient-to-b from-cyan-500/20 to-blue-900/40 rounded-2xl mb-4 flex flex-col items-center justify-center border border-cyan-500/30 relative overflow-hidden shadow-inner">
                      <div className="absolute bottom-0 w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-pulse"></div>
                      
                      {(playerData?.bait || 0) < 1 && !isFishing && !caughtFish && (
                          <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center p-4 text-center">
                              <p className="text-red-400 font-bold text-lg mb-4">NO BAIT!</p>
                              <button 
                                onClick={() => setGameSubTab('claim')} 
                                className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg animate-pulse"
                              >
                                CLAIM FREE BAIT 🪱
                              </button>
                          </div>
                      )}

                      {gameState === 'CAUGHT' && caughtFish ? (
                          <div className="text-center animate-bounce z-10">
                              <div className="text-6xl mb-2 filter drop-shadow-lg">{caughtFish.image}</div>
                              <p className="text-yellow-400 font-bold text-lg uppercase tracking-widest">{caughtFish.name}</p>
                              <div className="text-xs text-black bg-yellow-400 px-2 py-1 rounded-full font-bold mt-1">+{caughtFish.xp_value} XP</div>
                              <button onClick={resetGame} className="mt-4 bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:scale-105 transition-transform">CATCH AGAIN</button>
                          </div>
                      ) : gameState === 'FIGHTING' ? (
                           <div className="w-full px-8 z-10">
                              <FishingBar onCatch={handleCatchSuccess} onMiss={handleCatchMiss} />
                              <p className="text-center text-xs text-green-400 mt-2 font-bold animate-pulse">CLICK "CATCH" NOW!</p>
                           </div>
                      ) : gameState === 'MISSED' ? (
                          <div className="text-center z-10">
                              <div className="text-4xl mb-2">💨</div>
                              <p className="text-red-400 font-bold">ESCAPED!</p>
                              <button onClick={resetGame} className="mt-2 text-xs text-gray-400 underline">Try Again</button>
                          </div>
                      ) : (
                          <div className="text-center z-10">
                              {gameState === 'CASTING' ? (
                                  <div className="text-4xl mb-2 animate-ping">🪝</div>
                              ) : (
                                  <div className="text-4xl mb-2 animate-bounce">🐟</div>
                              )}
                              <p className="text-xs text-cyan-300">{gameState === 'CASTING' ? 'Waiting for bite...' : 'Tap CAST to start'}</p>
                          </div>
                      )}
                  </div>

                  <div className="flex justify-center mb-6 min-h-[60px]">
                      {gameState === 'FIGHTING' ? null : (
                          <button 
                             onClick={startFishing} 
                             disabled={isCastDisabled} 
                             className={`w-full py-3 rounded-xl font-bold text-lg shadow-lg transition-all ${castButtonClass}`}
                          >
                            {castButtonText}
                          </button>
                      )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                       <button onClick={() => setGameSubTab('inventory')} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-2 rounded-xl flex flex-col items-center justify-center transition-all">
                          <span className="text-2xl mb-1">🎒</span>
                          <span className="text-[10px] font-bold text-gray-400">BAG</span>
                       </button>
                       <button onClick={() => setGameSubTab('shop')} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-2 rounded-xl flex flex-col items-center justify-center transition-all">
                          <span className="text-2xl mb-1">🛒</span>
                          <span className="text-[10px] font-bold text-gray-400">SHOP</span>
                       </button>
                       <button onClick={() => setGameSubTab('claim')} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-2 rounded-xl flex flex-col items-center justify-center transition-all relative">
                          <div className="absolute top-0 right-0 bg-red-600 text-[8px] px-1.5 rounded-bl-lg text-white font-bold">FREE</div>
                          <span className="text-2xl mb-1">🎁</span>
                          <span className="text-[10px] font-bold text-gray-400">CLAIM</span>
                       </button>
                  </div>
                </>
              ) : gameSubTab === 'inventory' ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                       <button onClick={() => setGameSubTab('play')} className="text-gray-400 hover:text-white text-sm bg-black/40 px-3 py-1 rounded-lg border border-gray-700">← Back</button>
                       <h3 className="text-lg font-bold text-blue-400">🎒 Inventory</h3>
                       <div className="w-8"></div>
                  </div>

                   <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar justify-center">
                      <button onClick={() => setInventoryTab('fish')} className={`px-3 py-1 rounded-full text-[10px] font-bold border ${inventoryTab === 'fish' ? 'bg-blue-900/50 border-blue-500 text-blue-300' : 'bg-black/40 border-gray-700 text-gray-500'}`}>FISH 🐟</button>
                      <button onClick={() => setInventoryTab('bait')} className={`px-3 py-1 rounded-full text-[10px] font-bold border ${inventoryTab === 'bait' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-300' : 'bg-black/40 border-gray-700 text-gray-500'}`}>BAIT 🪱</button>
                      <button onClick={() => setInventoryTab('rod')} className={`px-3 py-1 rounded-full text-[10px] font-bold border ${inventoryTab === 'rod' ? 'bg-red-900/50 border-red-500 text-red-300' : 'bg-black/40 border-gray-700 text-gray-500'}`}>RODS 🎣</button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1">
                      {inventoryTab === 'fish' && (
                          <div className="grid grid-cols-3 gap-2">
                              {inventory.length === 0 ? <p className="col-span-3 text-center text-xs text-gray-600 py-10">No fish caught yet.</p> : 
                              inventory.map((item:any) => (
                                  <div key={item.id} className={`bg-black/40 border rounded-lg p-2 flex flex-col items-center relative ${item.fishes?.rarity === 'legendary' ? 'border-yellow-500 shadow-[0_0_5px_gold]' : item.fishes?.rarity === 'epic' ? 'border-purple-500' : item.fishes?.rarity === 'rare' ? 'border-blue-500' : 'border-gray-800'}`}>
                                      <div className="text-2xl filter drop-shadow-md mb-1">{item.fishes?.image}</div>
                                      <p className="text-[9px] text-gray-300 font-bold leading-tight text-center">{item.fishes?.name}</p>
                                      <div className="absolute top-0 right-0 bg-blue-900 text-[8px] px-1.5 rounded-bl-lg text-white font-bold">x{item.quantity}</div>
                                      
                                      {/* TOMBOL EXCHANGE DIHAPUS DULU SEMENTARA */}
                                  </div>
                              ))}
                          </div>
                      )}
                      {inventoryTab === 'bait' && (
                          <div className="text-center py-10 text-gray-500 text-xs">
                              <div className="text-6xl mb-4">🪱</div>
                              <p className="text-lg">Total Bait: <span className="text-white font-bold">{playerData?.bait || 0}</span></p>
                          </div>
                      )}
                      {inventoryTab === 'rod' && (
                          <div className="text-center py-10 text-gray-500 text-xs">
                              <div className="text-6xl mb-4">🎋</div>
                              <p className="text-lg">Equipped: <span className="text-white font-bold">Bamboo Stick</span></p>
                          </div>
                      )}
                  </div>
                </>
              ) : gameSubTab === 'shop' ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                       <button onClick={() => setGameSubTab('play')} className="text-gray-400 hover:text-white text-sm bg-black/40 px-3 py-1 rounded-lg border border-gray-700">← Back</button>
                       <h3 className="text-lg font-bold text-pink-400">🛒 Shop</h3>
                       <div className="w-8"></div>
                  </div>
                  <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                      <div className="text-6xl mb-4 grayscale opacity-50">🏪</div>
                      <h3 className="text-xl font-bold text-gray-500 mb-2">Marketplace</h3>
                      <p className="text-gray-600 text-xs">Buy rods, bait, and trade fish.</p>
                      <div className="mt-6 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg inline-block text-gray-400 text-xs font-bold">COMING SOON</div>
                  </div>
                </>
              ) : (
                // CLAIM SUB-TAB
                <>
                  <div className="flex items-center justify-between mb-4">
                       <button onClick={() => setGameSubTab('play')} className="text-gray-400 hover:text-white text-sm bg-black/40 px-3 py-1 rounded-lg border border-gray-700">← Back</button>
                       <h3 className="text-lg font-bold text-yellow-400">🎁 Free Supply</h3>
                       <div className="w-8"></div>
                  </div>
                  <div className="flex flex-col items-center justify-center h-full py-10">
                      <div className="w-24 h-24 bg-yellow-900/20 rounded-full flex items-center justify-center mb-6 border-2 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                          <span className="text-5xl">🪱</span>
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-1">+10 Free Bait</h2>
                      <p className="text-gray-400 text-xs mb-8 text-center px-10">Claim your daily supply to catch more fish! <br/>Requires minimal gas fee (Base Chain).</p>
                      
                      <button 
                          onClick={handleClaimSupply} 
                          disabled={loading || !canClaimSupply} 
                          className={`w-full max-w-[200px] font-bold py-4 rounded-xl shadow-lg transform transition-all active:scale-95 flex flex-col items-center ${
                            canClaimSupply 
                            ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white' 
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          }`}
                      >
                          <span className="text-lg">{canClaimSupply ? 'CLAIM NOW' : 'COME BACK TOMORROW'}</span>
                          {canClaimSupply && <span className="text-[10px] opacity-80 font-mono">0 ETH Transaction</span>}
                      </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'quest' && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-400">📜 Ecosystem Quests</h3>
              {quests.length === 0 ? <p className="text-center text-gray-500 py-4">Loading...</p> : activeQuests.map((q) => (<div key={q.id} className="flex items-center justify-between bg-black/60 p-4 rounded-xl border border-gray-800 mb-2"><div className="flex items-center gap-3"><div className="text-2xl">{q.icon}</div><div><p className="font-bold text-white text-sm">{q.title}</p><p className="text-xs text-gray-400">+{q.xp_reward} XP & +5 Bait</p></div></div><button onClick={() => handleQuestClick(q)} className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white">START</button></div>))}
              {completedQuests.map((q) => (<div key={q.id} className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-gray-800/50 opacity-60 mb-2"><div className="flex items-center gap-3"><div className="text-2xl grayscale">{q.icon}</div><div><p className="font-bold text-gray-400 text-sm line-through">{q.title}</p><p className="text-xs text-gray-600">Completed</p></div></div><button onClick={() => window.open(q.link, '_blank')} className="px-4 py-2 rounded-lg text-xs font-bold bg-green-900/30 text-green-600 border border-green-900/50">DONE (VISIT)</button></div>))}
            </div>
          )}

          {activeTab === 'rank' && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-400">🏆 Top Grinders</h3>
              <div className="space-y-2">{leaderboard.map((user, index) => (<div key={user.wallet_address} className={`flex items-center justify-between p-3 rounded-xl border ${user.wallet_address === address ? 'bg-blue-900/20 border-blue-500/50' : 'bg-black/40 border-gray-800'}`}><div className="flex items-center gap-3"><div className={`font-bold w-6 text-center ${index === 0 ? 'text-yellow-400 text-xl' : 'text-gray-500'}`}>{index + 1}</div><div><p className={`font-mono text-sm ${user.wallet_address === address ? 'text-blue-400 font-bold' : 'text-gray-300'}`}>{user.wallet_address === address ? 'YOU' : shortAddress(user.wallet_address)}</p><p className="text-xs text-gray-500">Lvl {user.level} • {user.current_streak} Day Streak</p></div></div><div className="font-bold text-white">{user.xp} XP</div></div>))}</div>
            </div>
          )}

          {/* TAB PROFILE */}
          {activeTab === 'profile' && (
            <div className="w-full space-y-4">
                <div className="flex flex-col items-center p-6 bg-gradient-to-b from-gray-900 to-black border border-gray-800 rounded-2xl">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 mb-4 p-1"><div className="w-full h-full bg-black rounded-full flex items-center justify-center text-2xl">👤</div></div>
                    <h2 className="text-xl font-bold text-white">{shortAddress(address || '')}</h2>
                    <div className={`mt-2 px-3 py-1 rounded-full border ${currentBadge.border} bg-black/50`}><p className={`text-xs font-bold ${currentBadge.color}`}>{currentBadge.name}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center"><p className="text-gray-400 text-xs uppercase">Total XP</p><p className="text-2xl font-bold text-white">{playerData?.xp || 0}</p></div>
                    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center"><p className="text-gray-400 text-xs uppercase">Days Login</p><p className="text-2xl font-bold text-white">{playerData?.total_login_days || 0}</p></div>
                    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center"><p className="text-gray-400 text-xs uppercase">Fish Caught</p><p className="text-2xl font-bold text-white">{inventory.reduce((acc, item) => acc + item.quantity, 0)}</p></div>
                    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center"><p className="text-gray-400 text-xs uppercase">Referrals</p><p className="text-2xl font-bold text-white">{playerData?.referral_count || 0}</p></div>
                </div>
                {/* LIST IKAN DI PROFIL (SCROLLABLE KE BAWAH - FIX) */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">My Best Catches</h3>
                    {/* GANTI GRID DISINI AGAR SCROLL KE BAWAH DAN HIDDEN SCROLLBAR */}
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {inventory.length === 0 ? <p className="col-span-3 text-center text-xs text-gray-600 py-4">No fish yet.</p> : 
                         inventory.map((item:any) => (
                            <div key={item.id} className={`aspect-square bg-black/40 border rounded-lg flex flex-col items-center justify-center relative ${
                                item.fishes?.rarity === 'legendary' ? 'border-yellow-500 shadow-[0_0_5px_gold]' : 
                                item.fishes?.rarity === 'epic' ? 'border-purple-500' : 
                                item.fishes?.rarity === 'rare' ? 'border-blue-500' : 'border-gray-800'
                            }`}>
                                <div className="text-2xl mb-1">{item.fishes?.image}</div>
                                <div className="absolute bottom-1 right-1 text-[9px] text-gray-500 font-bold">x{item.quantity}</div>
                            </div>
                         ))
                        }
                    </div>
                </div>
            </div>
          )}

          {statusMsg && <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-gray-700 px-4 py-2 rounded-full shadow-2xl z-50"><p className="text-sm text-white animate-pulse">{statusMsg}</p></div>}
        </div>
      ) : (
        <div className="text-center mt-32 opacity-50"><p className="text-gray-400">Connect wallet to start</p></div>
      )}

      {isConnected && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
            <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-2xl px-6 py-3 flex items-center gap-6 shadow-2xl">
                <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-blue-500 scale-110' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-xl">🏠</span></button>
                <button onClick={() => setActiveTab('quest')} className={`flex flex-col items-center gap-1 transition-all mr-2 ${activeTab === 'quest' ? 'text-purple-500 scale-110' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-xl">📜</span></button>
                <div className="w-8"></div>
                <button onClick={() => setActiveTab('rank')} className={`flex flex-col items-center gap-1 transition-all ml-2 ${activeTab === 'rank' ? 'text-yellow-500 scale-110' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-xl">🏆</span></button>
                <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-green-500 scale-110' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-xl">👤</span></button>
            </div>
            <button onClick={() => setActiveTab('game')} className={`absolute left-1/2 transform -translate-x-1/2 -top-6 w-16 h-16 rounded-full border-4 border-black flex items-center justify-center shadow-lg transition-all hover:scale-110 ${activeTab === 'game' ? 'bg-cyan-500 text-black' : 'bg-gray-800 text-cyan-500'}`}><span className="text-3xl">🎣</span></button>
        </div>
      )}
    </main>
  );
}

// WRAPPER UTAMA
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading LvLBASE...</div>}>
      <MainAppContent />
    </Suspense>
  );
}