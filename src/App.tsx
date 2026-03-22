import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { Home, Bot as BotIcon, Users, Sparkles, UserCircle } from 'lucide-react';

const firebaseConfig = { apiKey: "AIzaSyBSbd5alr6W1mnyQbTsahRLrVO9EvmMh8s", authDomain: "sixes-f521d.firebaseapp.com", projectId: "sixes-f521d", storageBucket: "sixes-f521d.firebasestorage.app", messagingSenderId: "1063787610225", appId: "1:1063787610225:web:fc3592beaa89398ab75bd0" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'sixes-v-final-production-v75'; 

const safeGetLocal = (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch(e) { return d; } };
const safeSetLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch(e) {} };

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [roomState, setRoomState] = useState<any>(null);
  const [roomId, setRoomId] = useState(safeGetLocal('currentRoomId', ''));
  const [view, setView] = useState('main_lobby'); 
  const [localPeek, setLocalPeek] = useState(false);
  const [namePrompt, setNamePrompt] = useState<{isOpen: boolean, defaultName: string, resolve: (v: string|null)=>void} | null>(null);

  useEffect(() => {
    signInAnonymously(auth);
    onAuthStateChanged(auth, u => {
      setUser(u);
      const r = new URLSearchParams(window.location.search).get('room');
      if (r && u && !roomId) handleJoinRoom(r.toUpperCase());
    });
  }, []);

  useEffect(() => {
    if (!user || !roomId) return;
    return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      
      // צליל כניסת חבר חדש
      if (roomState && data.players.length > roomState.players.length) {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
      }

      setRoomState(data);
      safeSetLocal('currentRoomId', roomId); // שמירת החדר למקרה של רענון
      
      if (data.status === 'playing') setView('game');
      else if (data.status === 'waiting') setView('waiting');
      else if (data.status === 'finished') setView('summary');
    });
  }, [roomId, user]);

  const requestName = async (defaultName: string): Promise<string | null> => {
    return new Promise((resolve) => { setNamePrompt({ isOpen: true, defaultName, resolve }); });
  };

  const updateRoom = async (updates: any) => { if (roomId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId), updates); };

  const getPlayerName = async () => {
    let name = safeGetLocal('playerName', "");
    if (!name) {
      const input = await requestName("");
      name = input?.trim() || "שחקן";
      safeSetLocal('playerName', name);
    }
    return name;
  };

  const handleCreateRoom = async (gameType: string, numBots: number, friends: number) => {
    const playerName = await getPlayerName();
    const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const status = friends > 0 ? 'waiting' : 'playing';
    
    let deck = gameType === 'sixes' ? createSixesDeck() : createWhistDeck();
    let players = [{ id: user.uid, name: playerName, cards: deck.splice(0, gameType === 'sixes' ? 6 : 13), isBot: false, totalScore: 0 }];
    for(let i=0; i<numBots; i++) players.push({ id: `bot-${i}`, name: `בוט ${i+1}`, isBot: true, cards: deck.splice(0, gameType === 'sixes' ? 6 : 13), totalScore: 0 });

    const init = {
      id: newId, hostId: user.uid, gameType, status, turn: 0, round: 1, players, deck, 
      discardPile: gameType === 'sixes' ? [deck.shift()] : [], phase: gameType === 'sixes' ? 'playing' : 'bidding', drawnCard: null
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newId), init);
    setRoomId(newId);
  };

  const handleJoinRoom = async (id: string) => {
    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', id));
    if (snap.exists()) { setRoomId(id); setView(snap.data().status); }
  };

  const createSixesDeck = () => {
    const suits = ['♥', '♦', '♣', '♠'], ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let deck: any[] = [];
    for (let s of suits) for (let r of ranks) deck.push({ id: Math.random(), rank: r, suit: s });
    return deck.sort(() => Math.random() - 0.5);
  };

  const createWhistDeck = () => {
    const suits = ['♣', '♦', '♥', '♠'], ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck: any[] = [];
    for (let s of suits) for (let r of ranks) deck.push({ id: Math.random(), rank: r, suit: s });
    return deck.sort(() => Math.random() - 0.5);
  };

  const renderCard = (card: any, hidden: boolean, onClick?: any) => (
    <div onClick={onClick} className={`w-12 h-18 sm:w-16 sm:h-24 rounded-xl border-2 flex flex-col justify-between p-2 transition-all cursor-pointer shadow-lg ${hidden ? 'bg-gradient-to-br from-slate-800 to-black border-slate-700' : 'bg-white border-slate-100 text-black'}`}>
       {!hidden && card ? <><span className="text-xs font-black">{card.rank}</span><span className="text-2xl self-center">{card.suit}</span></> : <BotIcon size={20} className="m-auto opacity-20 text-blue-400"/>}
    </div>
  );

  const renderDialogs = () => (
    <>
      {namePrompt?.isOpen && (
        <div className="fixed inset-0 bg-black/95 z-[10000] flex items-center justify-center p-6" dir="rtl">
          <div className="bg-slate-900 p-8 rounded-[3rem] border border-white/10 w-full max-w-sm flex flex-col gap-6">
             <h3 className="text-3xl font-black text-white text-center italic">איך קוראים לך?</h3>
             <input autoFocus type="text" value={namePrompt.defaultName} onChange={e => setNamePrompt({ ...namePrompt, defaultName: e.target.value })} className="bg-black/50 border-2 border-blue-500/30 rounded-2xl p-4 text-white text-center font-black text-xl" />
             <button onClick={() => { namePrompt.resolve(namePrompt.defaultName); setNamePrompt(null); }} className="bg-blue-600 py-4 rounded-2xl font-black text-xl text-white shadow-lg shadow-blue-900/40">המשך למשחק</button>
          </div>
        </div>
      )}
    </>
  );

  const me = roomState?.players?.find((p:any)=>p.id===user?.uid);
  const isTurn = roomState?.players?.[roomState.turn]?.id === user?.uid;

  // לוגיקת סיום סבב (וויסט)
  if (roomState?.gameType === 'whist' && roomState.round > 13 && roomState.status !== 'finished') {
    updateRoom({ status: 'finished' });
  }

  if (view === 'main_lobby') return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white" dir="rtl">
        <h1 className="text-6xl font-black mb-12 italic tracking-tighter">ARCADE CARDS</h1>
        <div className="mb-8 flex items-center gap-2 bg-white/5 px-6 py-3 rounded-full cursor-pointer border border-white/5 hover:bg-white/10" onClick={async () => {const n = await requestName(safeGetLocal('playerName', "")); if(n) safeSetLocal('playerName', n);}}>
            <UserCircle size={20} className="text-blue-400" />
            <span className="font-bold">שלום, {safeGetLocal('playerName', 'שחקן')} (שנה שם)</span>
        </div>
        <div className="grid gap-6 w-full max-w-sm">
            <button onClick={()=>setView('sixes_lobby')} className="bg-emerald-600/20 border-2 border-emerald-500/30 p-8 rounded-[3rem] flex justify-between items-center group transition-all">
                <div className="text-right"><h2 className="text-3xl font-black">שישיות</h2><p className="text-xs opacity-50 uppercase tracking-widest">Memory & Luck</p></div>
                <BotIcon size={44} className="text-emerald-400 group-hover:rotate-12 transition-transform"/>
            </button>
            <button onClick={()=>setView('whist_lobby')} className="bg-blue-600/20 border-2 border-blue-500/30 p-8 rounded-[3rem] flex justify-between items-center group transition-all">
                <div className="text-right"><h2 className="text-3xl font-black">וויסט</h2><p className="text-xs opacity-50 uppercase tracking-widest">Strategy Master</p></div>
                <Users size={44} className="text-blue-400 group-hover:-rotate-12 transition-transform"/>
            </button>
        </div>
        {renderDialogs()}
    </div>
  );

  if (!roomState || !me) return <div className="h-screen bg-black text-white flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div><p className="font-black italic">LOADING ARENA...</p></div>;

  return (
    <div className={`h-screen flex flex-col ${roomState.gameType==='sixes'?'bg-[#052619]':'bg-[#063b20]'} text-white overflow-hidden`} dir="rtl">
        <div className="p-5 flex justify-between items-center bg-black/50 border-b border-white/5">
            <button onClick={()=>{setView('main_lobby'); safeSetLocal('currentRoomId', '');}}><Home size={22}/></button>
            <div className="flex flex-col items-center">
              <span className="font-black text-emerald-400 tracking-widest">{roomState.gameType==='sixes'?'SIXES':'WHIST'}</span>
              <span className="text-[10px] font-bold opacity-50">ROUND {roomState.round}/13</span>
            </div>
            <div className="text-[10px] opacity-30">ID: {roomId}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-12">
            <div className="flex gap-16 bg-black/30 p-12 rounded-[5rem] border-2 border-white/5 relative shadow-2xl">
                {/* קופה */}
                <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black opacity-40">DECK</span>
                    <div onClick={() => isTurn && !roomState.drawnCard && updateRoom({drawnCard: roomState.deck[0], deck: roomState.deck.slice(1)})}>
                        {renderCard(null, true)}
                    </div>
                </div>

                {/* קלף שנמשך */}
                {roomState.drawnCard && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-4 animate-bounce">
                    {renderCard(roomState.drawnCard, false)}
                  </div>
                )}

                {/* זריקה */}
                <div className="flex flex-col items-center gap-4">
                    <span className="text-[10px] font-black text-emerald-400">DISCARD</span>
                    {renderCard(roomState.discardPile?.[roomState.discardPile.length-1], false)}
                </div>
            </div>
        </div>

        <div className="mt-auto p-8 bg-black/70 rounded-t-[4rem] border-t-4 border-white/5">
            <div className="grid grid-cols-3 gap-4 justify-items-center mb-8 max-w-md mx-auto">
                {me?.cards?.map((c:any, i:number) => (
                    <div key={i} className="hover:-translate-y-2 transition-transform">
                      {renderCard(c, (i < 3 && !localPeek))}
                    </div>
                ))}
            </div>
            <div className="flex gap-4 max-w-sm mx-auto">
                <button onClick={()=>setLocalPeek(!localPeek)} className="flex-1 py-5 bg-white/5 border border-white/10 rounded-3xl font-black text-sm">{localPeek?'הסתר קלפים':'הצץ (3 קלפים)'}</button>
                {isTurn && <button className="flex-1 py-5 bg-red-600 rounded-3xl font-black text-sm shadow-xl shadow-red-900/20 animate-pulse">STOP!</button>}
            </div>
        </div>
        {renderDialogs()}
    </div>
  );
}