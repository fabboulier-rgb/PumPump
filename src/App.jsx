import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore';

// 1. INITIALISATION FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAQB5mhQJEoP_9Qdx5WfkObwjUxm6nczUo",
  authDomain: "pumpump-app.firebaseapp.com",
  projectId: "pumpump-app",
  storageBucket: "pumpump-app.firebasestorage.app",
  messagingSenderId: "150843577031",
  appId: "1:150843577031:web:c9b1d5f6dbeb7cce0de4e2",
  measurementId: "G-WE42ZVJJNV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. DICTIONNAIRE DE TRADUCTIONS (Enrichi pour le bébé)
const translations = {
  en: {
    titlePump: "🍼 PumPump", titleFeed: "👶 Baby Meals", subtitle: "Moms, we Love You! 💖",
    manualBtn: "✍️ Manual Entry", left: "Left", both: "Both", right: "Right", start: "START", stop: "STOP",
    chartTitle: "📊 Weekly Pumped (mL)", victories: "🏆 Pump History", noSession: "No session yet.",
    bravo: "Great job! 🎉", howMuch: "How much did you pump?", save: "Save", cancel: "Cancel",
    reminder: "🔔 Next reminder:", none: "None", manualDuration: "Manual", langBtn: "🇫🇷 FR",
    stopwatch: "⏱️ Stopwatch", timer: "⏳ Timer", min: "min", when: "🗓️ When was it?",
    loginTitle: "Welcome!", loginSub: "Enter family code", loginBtn: "Unlock", loginPlaceholder: "Ex: lu1", logout: "🔒",
    statusApproved: "Approved ✅", statusTemp: "Temporary ❗", statusModalTitle: "Code Status",
    statusModalAppr: "Data is securely backed up in the Cloud.", statusModalTemp: "Data saved locally ONLY. Might be lost.",
    stopMusic: "🔇 Stop music", deleteConfirm: "Delete this session?", themeBtn: "🌙",
    // Nouveaux textes pour les repas
    tabPump: "🍼 Pumping", tabFeed: "👶 Feeding",
    feedBreast: "🤱 Breast", feedPumped: "🍼 Pumped Milk", feedFormula: "🥛 Formula",
    feedHowMuch: "How much did baby drink?", feedHistory: "🍽️ Feeding History",
  },
  fr: {
    titlePump: "🍼 PumPump", titleFeed: "👶 Repas Bébé", subtitle: "Mamans, on vous aime ! 💖",
    manualBtn: "✍️ Saisie Manuelle", left: "Gauche", both: "Les deux", right: "Droite", start: "START", stop: "STOP",
    chartTitle: "📊 Résumé Tirage (mL)", victories: "🏆 Historique Tirages", noSession: "Aucune session.",
    bravo: "Bravo ! 🎉", howMuch: "Combien as-tu récolté ?", save: "Sauvegarder", cancel: "Annuler",
    reminder: "🔔 Rappel prochain :", none: "Non", manualDuration: "Manuel", langBtn: "🇬🇧 EN",
    stopwatch: "⏱️ Chrono", timer: "⏳ Timer", min: "min", when: "🗓️ Quand était-ce ?",
    loginTitle: "Bienvenue !", loginSub: "Entrez votre code familial", loginBtn: "Déverrouiller", loginPlaceholder: "Ex: lu1", logout: "🔒",
    statusApproved: "Approuvé ✅", statusTemp: "Temporaire ❗", statusModalTitle: "Statut du Code",
    statusModalAppr: "Données sauvegardées de manière sécurisée dans le Cloud.", statusModalTemp: "Données locales uniquement. Risque de perte.",
    stopMusic: "🔇 Arrêter la musique", deleteConfirm: "Supprimer définitivement ?", themeBtn: "☀️",
    // Nouveaux textes pour les repas
    tabPump: "🍼 Tirage", tabFeed: "👶 Repas",
    feedBreast: "🤱 Au sein", feedPumped: "🍼 Lait tiré", feedFormula: "🥛 Lait artificiel",
    feedHowMuch: "Combien a bu bébé ?", feedHistory: "🍽️ Historique des Repas",
  }
};

// ==========================================
// COMPOSANT 1 : TIRE-LAIT (PumpingTracker)
// ==========================================
function PumpingTracker({ userCode, isApproved, lang, t, darkMode }) {
  const audioRef = useRef(null);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [isPumping, setIsPumping] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [side, setSide] = useState('both'); 
  const [mode, setMode] = useState('timer'); 
  const [timerTarget, setTimerTarget] = useState(20); 
  const [showModal, setShowModal] = useState(false);
  const [volume, setVolume] = useState(100);
  const [history, setHistory] = useState([]);
  const [reminderHours, setReminderHours] = useState(0);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      if (isApproved) {
        try {
          const q = query(collection(db, "users", userCode, "sessions"), orderBy("timestamp", "desc"));
          const snapshot = await getDocs(q);
          const sessions = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
          setHistory(sessions);
          localStorage.setItem(`pumpum_history_${userCode}`, JSON.stringify(sessions));
        } catch (e) {
          const saved = localStorage.getItem(`pumpum_history_${userCode}`);
          if (saved) setHistory(JSON.parse(saved));
        }
      } else {
        const saved = localStorage.getItem(`pumpum_history_${userCode}`);
        setHistory(saved ? JSON.parse(saved) : []);
      }
    };
    fetchHistory();
  }, [userCode, isApproved]);

  useEffect(() => {
    let interval;
    if (isPumping) {
      interval = setInterval(() => {
        setSeconds(p => {
          const next = p + 1;
          if (mode === 'timer' && next >= timerTarget * 60) {
            setIsPumping(false); setIsManualEntry(false); setShowModal(true);
            if (audioRef.current) { audioRef.current.play().catch(e=>console.log(e)); setIsPlayingMusic(true); }
            return next;
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPumping, mode, timerTarget]);

  const stopAudio = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; setIsPlayingMusic(false); } };
  const togglePump = () => { if (isPumping) { setIsPumping(false); setIsManualEntry(false); setShowModal(true); } else setIsPumping(true); };
  const openManual = () => { setIsPumping(false); setSeconds(0); setIsManualEntry(true); const d = new Date(); setManualDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); setManualTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`); setShowModal(true); };
  
  const saveSession = async () => {
    stopAudio();
    let sessionDate = (isManualEntry && manualDate && manualTime) ? new Date(`${manualDate}T${manualTime}`) : new Date();
    const durationSaved = seconds > 0 && !isManualEntry ? `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}` : t.manualDuration;
    const finalVolume = volume || 0;
    
    const newSession = {
      id: Date.now(), timestamp: sessionDate.getTime(),
      dateStr: sessionDate.toLocaleDateString(lang==='fr'?'fr-FR':'en-US', {day:'2-digit', month:'2-digit'}),
      timeStr: sessionDate.toLocaleTimeString(lang==='fr'?'fr-FR':'en-US', {hour:'2-digit', minute:'2-digit'}),
      duration: durationSaved, side, volume: finalVolume
    };
    
    const newHist = [newSession, ...history].sort((a,b)=>b.timestamp-a.timestamp);
    setHistory(newHist); localStorage.setItem(`pumpum_history_${userCode}`, JSON.stringify(newHist));
    
    if (isApproved) { try { await addDoc(collection(db, "users", userCode, "sessions"), newSession); } catch(e){} }
    setShowModal(false); setSeconds(0); setVolume(100); setReminderHours(0); setIsManualEntry(false);
  };

  const handleDelete = async (id, fId) => {
    if (window.confirm(t.deleteConfirm)) {
      const updated = history.filter(s => s.id !== id);
      setHistory(updated); localStorage.setItem(`pumpum_history_${userCode}`, JSON.stringify(updated));
      if (isApproved && fId) { try { await deleteDoc(doc(db, "users", userCode, "sessions", fId)); } catch(e){} }
    }
  };

  const formatT = (s, fUp=false) => { let ds = s; if (mode==='timer' && !fUp) ds = Math.max(0, (timerTarget*60)-s); return `${Math.floor(ds/60).toString().padStart(2,'0')}:${(ds%60).toString().padStart(2,'0')}`; };
  const chartData = useMemo(() => {
    const dt = {}; history.forEach(s => { if(s.dateStr && s.volume) dt[s.dateStr] = (dt[s.dateStr]||0) + s.volume; });
    const days = Object.keys(dt).sort((a,b)=>a.localeCompare(b)).slice(-7);
    const maxV = Math.max(...Object.values(dt), 100);
    return days.map(d => ({ day:d, total:dt[d], height:Math.round((dt[d]/maxV)*100) }));
  }, [history]);

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto pb-24">
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      <div className="text-center mb-6 mt-8"><h1 className="text-5xl font-extrabold text-teal-400 mb-2">{t.titlePump}</h1><p className="text-md font-medium text-slate-500 dark:text-slate-400">{t.subtitle}</p></div>

      <div className="flex gap-2 mb-4 bg-white dark:bg-slate-900 p-2 rounded-full shadow-sm w-full justify-between transition-colors">
        {['left', 'both', 'right'].map(s => <button key={s} onClick={()=>setSide(s)} className={`flex-1 py-3 rounded-full font-bold text-sm transition-all ${side===s ? 'bg-rose-300 text-white shadow-md' : 'text-slate-400 dark:text-slate-500'}`}>{t[s]}</button>)}
      </div>

      <button onClick={openManual} className="mb-8 w-full py-4 bg-white dark:bg-slate-900 text-rose-400 rounded-2xl font-extrabold text-lg shadow-sm">{t.manualBtn}</button>

      <div className="w-full flex flex-col items-center bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm mb-8">
        <div className="flex bg-orange-50 dark:bg-slate-800 rounded-full p-1 mb-6 w-full">
          <button onClick={()=>{if(!isPumping){setMode('stopwatch');setSeconds(0);}}} className={`flex-1 py-2 rounded-full font-bold text-sm ${mode==='stopwatch'?'bg-white dark:bg-slate-700 text-teal-500 shadow-sm':'text-slate-400'}`}>{t.stopwatch}</button>
          <button onClick={()=>{if(!isPumping){setMode('timer');setSeconds(0);}}} className={`flex-1 py-2 rounded-full font-bold text-sm ${mode==='timer'?'bg-white dark:bg-slate-700 text-teal-500 shadow-sm':'text-slate-400'}`}>{t.timer}</button>
        </div>
        {mode==='timer' && (
          <div className="flex items-center gap-4 mb-6">
            <button onClick={()=>setTimerTarget(p=>Math.max(1,p-1))} disabled={isPumping} className="w-12 h-12 rounded-full bg-rose-50 dark:bg-slate-800 text-rose-400 font-black text-xl flex items-center justify-center disabled:opacity-50">-</button>
            <div className="text-xl font-bold text-slate-600 dark:text-slate-300 w-24 text-center">{timerTarget} {t.min}</div>
            <button onClick={()=>setTimerTarget(p=>Math.max(1,p+1))} disabled={isPumping} className="w-12 h-12 rounded-full bg-rose-50 dark:bg-slate-800 text-rose-400 font-black text-xl flex items-center justify-center disabled:opacity-50">+</button>
          </div>
        )}
        <button onClick={togglePump} className={`w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-xl transition-all border-8 ${isPumping?'bg-rose-300 border-rose-200 text-white animate-pulse':'bg-orange-50 dark:bg-slate-800 border-rose-100 dark:border-slate-700 text-rose-400'}`}>
          <span className="text-7xl font-mono font-black mb-2">{formatT(seconds)}</span>
          <span className="text-xl font-bold opacity-80 uppercase tracking-widest">{isPumping?t.stop:t.start}</span>
        </button>
      </div>

      {chartData.length > 0 && (
        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-bold text-teal-400 mb-6 flex justify-center">{t.chartTitle}</h2>
          <div className="flex items-end justify-between h-32 gap-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1">{d.total}</span>
                <div className="w-full bg-orange-50 dark:bg-slate-800 rounded-t-md relative flex items-end" style={{height:'100px'}}><div className="w-full bg-teal-300 dark:bg-teal-500/80 rounded-t-md" style={{height:`${d.height}%`}}></div></div>
                <span className="text-[10px] font-bold text-slate-400 mt-2">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm mb-10">
        <h2 className="text-lg font-bold text-teal-400 mb-4">{t.victories}</h2>
        {history.length===0 ? <p className="text-slate-400 text-center text-sm">{t.noSession}</p> : (
          <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
            {history.map(s => (
              <div key={s.id} className="flex justify-between items-center bg-orange-50 dark:bg-slate-800 p-3 rounded-2xl">
                <div><p className="font-bold text-slate-700 dark:text-slate-200 text-lg">{s.volume} mL</p><p className="text-xs text-slate-400">{s.dateStr} - {s.timeStr} • {t[s.side]||s.side}</p></div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-rose-400 font-bold bg-white dark:bg-slate-700 px-3 py-1 rounded-full text-sm">{s.duration}</div>
                  <button onClick={()=>handleDelete(s.id, s.firebaseId)} className="p-2 text-slate-400 hover:text-rose-500">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl">
            <h2 className="text-3xl font-bold mb-2 text-teal-400">{t.bravo}</h2>
            {isPlayingMusic && <button onClick={stopAudio} className="mb-4 mx-auto flex items-center gap-2 bg-rose-100 text-rose-500 px-4 py-2 rounded-full text-sm font-bold animate-pulse">{t.stopMusic}</button>}
            
            {isManualEntry && (
              <div className="mb-6 bg-orange-50 dark:bg-slate-800 p-4 rounded-2xl">
                <p className="text-sm font-bold text-teal-400 mb-3">{t.when}</p>
                <div className="flex gap-2">
                  <input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} className="flex-1 bg-white dark:bg-slate-700 text-teal-600 p-3 rounded-xl text-sm color-scheme-dark"/>
                  <input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)} className="flex-1 bg-white dark:bg-slate-700 text-teal-600 p-3 rounded-xl text-sm color-scheme-dark"/>
                </div>
              </div>
            )}
            
            <p className="mb-4 text-slate-500">{t.howMuch}</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <input type="number" value={volume===0?'':volume} onChange={e=>setVolume(Number(e.target.value))} className="text-6xl font-black text-slate-700 dark:text-slate-200 bg-transparent w-32 text-center border-b-4 border-dashed border-rose-200 focus:outline-none" placeholder="0"/>
              <span className="text-2xl text-rose-300 font-bold mt-4">mL</span>
            </div>
            <input type="range" min="0" max="300" step="10" value={volume} onChange={e=>setVolume(Number(e.target.value))} className="w-full accent-rose-300 mb-6 h-3 bg-orange-50 rounded-lg cursor-pointer"/>
            
            <button onClick={saveSession} className="w-full bg-rose-300 text-white py-4 rounded-2xl font-bold text-xl mb-3">{t.save}</button>
            <button onClick={()=>{stopAudio();setShowModal(false);setSeconds(0);setIsManualEntry(false);}} className="text-slate-400 font-bold py-2 px-6 rounded-full hover:bg-slate-50">{t.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ==========================================
// COMPOSANT 2 : REPAS BÉBÉ (FeedingTracker)
// ==========================================
function FeedingTracker({ userCode, isApproved, lang, t, darkMode }) {
  const [feedType, setFeedType] = useState('breast'); // breast, pumped, formula
  const [feedHistory, setFeedHistory] = useState([]);
  
  // Breast States
  const [isFeeding, setIsFeeding] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [side, setSide] = useState('both');
  
  // Bottle States
  const [volume, setVolume] = useState(120);

  // Modal (For both saving breast or bottle)
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (isApproved) {
        try {
          const q = query(collection(db, "users", userCode, "feedings"), orderBy("timestamp", "desc"));
          const snapshot = await getDocs(q);
          const sessions = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
          setFeedHistory(sessions);
          localStorage.setItem(`pumpum_feed_${userCode}`, JSON.stringify(sessions));
        } catch (e) {
          const saved = localStorage.getItem(`pumpum_feed_${userCode}`);
          if (saved) setFeedHistory(JSON.parse(saved));
        }
      } else {
        const saved = localStorage.getItem(`pumpum_feed_${userCode}`);
        setFeedHistory(saved ? JSON.parse(saved) : []);
      }
    };
    fetchHistory();
  }, [userCode, isApproved]);

  useEffect(() => {
    let interval;
    if (isFeeding) interval = setInterval(() => setSeconds(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [isFeeding]);

  const toggleFeed = () => { if (isFeeding) { setIsFeeding(false); setShowModal(true); } else setIsFeeding(true); };
  
  const saveFeeding = async () => {
    const d = new Date();
    const isBreast = feedType === 'breast';
    const durationStr = isBreast ? `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}` : null;
    
    const newSession = {
      id: Date.now(), timestamp: d.getTime(),
      dateStr: d.toLocaleDateString(lang==='fr'?'fr-FR':'en-US', {day:'2-digit', month:'2-digit'}),
      timeStr: d.toLocaleTimeString(lang==='fr'?'fr-FR':'en-US', {hour:'2-digit', minute:'2-digit'}),
      type: feedType,
      duration: durationStr,
      side: isBreast ? side : null,
      volume: !isBreast ? volume : null
    };
    
    const newHist = [newSession, ...feedHistory].sort((a,b)=>b.timestamp-a.timestamp);
    setFeedHistory(newHist); localStorage.setItem(`pumpum_feed_${userCode}`, JSON.stringify(newHist));
    if (isApproved) { try { await addDoc(collection(db, "users", userCode, "feedings"), newSession); } catch(e){} }
    
    setShowModal(false); setSeconds(0);
  };

  const handleDelete = async (id, fId) => {
    if (window.confirm(t.deleteConfirm)) {
      const updated = feedHistory.filter(s => s.id !== id);
      setFeedHistory(updated); localStorage.setItem(`pumpum_feed_${userCode}`, JSON.stringify(updated));
      if (isApproved && fId) { try { await deleteDoc(doc(db, "users", userCode, "feedings", fId)); } catch(e){} }
    }
  };

  const formatT = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto pb-24">
      <div className="text-center mb-6 mt-8"><h1 className="text-5xl font-extrabold text-blue-400 mb-2">{t.titleFeed}</h1><p className="text-md font-medium text-slate-500">{t.subtitle}</p></div>

      {/* SÉLECTEUR DE TYPE DE REPAS */}
      <div className="flex gap-2 mb-8 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm w-full">
        <button onClick={()=>setFeedType('breast')} className={`flex-1 py-3 rounded-xl font-bold text-xs ${feedType==='breast'?'bg-blue-300 text-white shadow-md':'text-slate-400 dark:text-slate-500'}`}>{t.feedBreast}</button>
        <button onClick={()=>setFeedType('pumped')} className={`flex-1 py-3 rounded-xl font-bold text-xs ${feedType==='pumped'?'bg-blue-300 text-white shadow-md':'text-slate-400 dark:text-slate-500'}`}>{t.feedPumped}</button>
        <button onClick={()=>setFeedType('formula')} className={`flex-1 py-3 rounded-xl font-bold text-xs ${feedType==='formula'?'bg-blue-300 text-white shadow-md':'text-slate-400 dark:text-slate-500'}`}>{t.feedFormula}</button>
      </div>

      <div className="w-full flex flex-col items-center bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm mb-8 border-2 border-blue-50 dark:border-slate-800">
        
        {/* INTERFACE SEIN (CHRONO) */}
        {feedType === 'breast' && (
          <>
            <div className="flex gap-2 mb-6 bg-blue-50 dark:bg-slate-800 p-1 rounded-full w-full">
              {['left', 'both', 'right'].map(s => <button key={s} onClick={()=>setSide(s)} className={`flex-1 py-2 rounded-full font-bold text-sm ${side===s?'bg-white dark:bg-slate-700 text-blue-500 shadow-sm':'text-slate-400'}`}>{t[s]}</button>)}
            </div>
            <button onClick={toggleFeed} className={`w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-xl border-8 ${isFeeding?'bg-blue-300 border-blue-200 text-white animate-pulse':'bg-slate-50 dark:bg-slate-800 border-blue-100 dark:border-slate-700 text-blue-400'}`}>
              <span className="text-7xl font-mono font-black mb-2">{formatT(seconds)}</span>
              <span className="text-xl font-bold opacity-80 uppercase tracking-widest">{isFeeding?t.stop:t.start}</span>
            </button>
            {!isFeeding && seconds > 0 && <button onClick={()=>setShowModal(true)} className="mt-6 w-full py-4 bg-blue-300 text-white rounded-2xl font-bold shadow-md">{t.save}</button>}
          </>
        )}

        {/* INTERFACE BIBERON (VOLUME) */}
        {feedType !== 'breast' && (
          <div className="w-full text-center py-4">
            <p className="mb-4 text-slate-500 dark:text-slate-400 font-bold">{t.feedHowMuch}</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <input type="number" value={volume===0?'':volume} onChange={e=>setVolume(Number(e.target.value))} className="text-6xl font-black text-slate-700 dark:text-slate-200 bg-transparent w-32 text-center border-b-4 border-dashed border-blue-200 focus:outline-none"/>
              <span className="text-2xl text-blue-300 font-bold mt-4">mL</span>
            </div>
            <input type="range" min="0" max="300" step="10" value={volume} onChange={e=>setVolume(Number(e.target.value))} className="w-full accent-blue-300 mb-8 h-3 bg-slate-100 rounded-lg cursor-pointer"/>
            <button onClick={saveFeeding} className="w-full py-4 bg-blue-300 text-white rounded-2xl font-bold text-xl shadow-md">{t.save}</button>
          </div>
        )}
      </div>

      {/* HISTORIQUE DES REPAS */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm mb-10">
        <h2 className="text-lg font-bold text-blue-400 mb-4">{t.feedHistory}</h2>
        {feedHistory.length===0 ? <p className="text-slate-400 text-center text-sm">{t.noSession}</p> : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {feedHistory.map(s => (
              <div key={s.id} className="flex justify-between items-center bg-blue-50/50 dark:bg-slate-800 p-3 rounded-2xl">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200 text-md">
                    {s.type === 'breast' ? '🤱 ' + t.feedBreast : s.type === 'pumped' ? '🍼 ' + t.feedPumped : '🥛 ' + t.feedFormula}
                  </p>
                  <p className="text-xs text-slate-400 font-medium">{s.dateStr} - {s.timeStr} {s.type==='breast' && `• ${t[s.side]}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-blue-400 font-bold bg-white dark:bg-slate-700 px-3 py-1 rounded-full text-sm">
                    {s.type === 'breast' ? s.duration : `${s.volume} mL`}
                  </div>
                  <button onClick={()=>handleDelete(s.id, s.firebaseId)} className="p-2 text-slate-400 hover:text-rose-500">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALE D'ENREGISTREMENT AU SEIN */}
      {showModal && feedType === 'breast' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl">
             <h2 className="text-3xl font-bold mb-6 text-blue-400">{t.bravo}</h2>
             <button onClick={saveFeeding} className="w-full bg-blue-300 text-white py-4 rounded-2xl font-bold text-xl mb-3">{t.save}</button>
             <button onClick={()=>{setShowModal(false); setSeconds(0);}} className="text-slate-400 font-bold py-2 px-6 rounded-full hover:bg-slate-50">{t.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPOSANT 3 : L'APPLICATION PRINCIPALE
// ==========================================
export default function App() {
  const [lang, setLang] = useState('en');
  const t = translations[lang];
  const [darkMode, setDarkMode] = useState(false);
  
  const [userCode, setUserCode] = useState(localStorage.getItem('pumpum_user') || '');
  const [isLogged, setIsLogged] = useState(!!localStorage.getItem('pumpum_user'));
  const [isApproved, setIsApproved] = useState(false);
  const [tempCode, setTempCode] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  const [activeTab, setActiveTab] = useState('pump'); // 'pump' ou 'feed'

  useEffect(() => {
    const savedLang = localStorage.getItem('pumpum_lang'); if (savedLang) setLang(savedLang);
    const savedTheme = localStorage.getItem('pumpum_theme');
    if (savedTheme === 'dark') { setDarkMode(true); document.documentElement.classList.add('dark'); }
    
    const checkApproval = async () => {
      if (isLogged && userCode) {
        try {
          const docSnap = await getDoc(doc(db, "approved_families", userCode));
          setIsApproved(docSnap.exists());
        } catch (e) { setIsApproved(false); }
      }
    };
    checkApproval();
  }, [isLogged, userCode]);

  const toggleLang = () => { const nl = lang === 'en' ? 'fr' : 'en'; setLang(nl); localStorage.setItem('pumpum_lang', nl); };
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('pumpum_theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('pumpum_theme', 'light'); }
  };
  const handleLogin = (e) => { e.preventDefault(); if (tempCode.trim().length >= 2) { const c = tempCode.trim().toLowerCase(); setUserCode(c); setIsLogged(true); localStorage.setItem('pumpum_user', c); } };
  const handleLogout = () => { setIsLogged(false); setUserCode(''); setIsApproved(false); localStorage.removeItem('pumpum_user'); };

  if (!isLogged) {
    return (
      <div className="min-h-screen bg-orange-50 dark:bg-indigo-950 flex flex-col items-center justify-center p-6 transition-colors duration-500">
        <div className="absolute top-6 right-6"><button onClick={toggleLang} className="font-bold text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full">{t.langBtn}</button></div>
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl w-full max-w-sm text-center shadow-xl">
          <h1 className="text-4xl font-extrabold text-teal-400 mb-2">🍼 PumPump</h1>
          <h2 className="text-xl font-bold text-slate-600 dark:text-slate-300 mt-6 mb-2">{t.loginTitle}</h2>
          <p className="text-sm font-medium text-slate-400 mb-8">{t.loginSub}</p>
          <form onSubmit={handleLogin}>
            <input type="password" value={tempCode} onChange={(e) => setTempCode(e.target.value)} placeholder={t.loginPlaceholder} className="w-full bg-orange-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold p-4 rounded-2xl mb-6 text-center focus:outline-none"/>
            <button type="submit" className="w-full py-4 bg-rose-300 text-white rounded-2xl font-bold text-lg">{t.loginBtn}</button>
          </form>
          <div className="mt-8 flex justify-center w-full">
            <div className="flex bg-orange-50 dark:bg-slate-800 p-1 rounded-full"><button onClick={()=>{if(darkMode)toggleDarkMode()}} className={`px-4 py-2 rounded-full text-lg ${!darkMode?'bg-white':'opacity-40'}`}>☀️</button><button onClick={()=>{if(!darkMode)toggleDarkMode()}} className={`px-4 py-2 rounded-full text-lg ${darkMode?'bg-indigo-900':'opacity-40'}`}>🌙</button></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 dark:bg-indigo-950 flex flex-col font-sans text-slate-700 dark:text-slate-200 relative overflow-x-hidden transition-colors duration-500">
      
      {/* BARRE DU HAUT */}
      <div className="absolute top-6 left-4 z-10">
        <button onClick={() => setShowStatusModal(true)} className={`flex items-center gap-1 font-bold px-3 py-1 rounded-full shadow-sm text-xs ${isApproved ? 'bg-teal-50 text-teal-600' : 'bg-orange-100 text-orange-600'}`}>
          <span className="uppercase opacity-70 mr-1">{userCode}</span>{isApproved ? t.statusApproved : t.statusTemp}
        </button>
      </div>
      <div className="absolute top-6 right-4 flex gap-2 z-10">
        <button onClick={toggleDarkMode} className="text-lg bg-white dark:bg-slate-800 px-2 py-1 rounded-full">{t.themeBtn}</button>
        <button onClick={handleLogout} className="font-bold text-slate-400 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-sm">{t.logout}</button>
        <button onClick={toggleLang} className="font-bold text-slate-400 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-sm">{t.langBtn}</button>
      </div>

      {/* ZONE CENTRALE DYNAMIQUE */}
      <div className="pt-12 flex-1 overflow-y-auto w-full">
        {activeTab === 'pump' 
          ? <PumpingTracker userCode={userCode} isApproved={isApproved} lang={lang} t={t} darkMode={darkMode} />
          : <FeedingTracker userCode={userCode} isApproved={isApproved} lang={lang} t={t} darkMode={darkMode} />
        }
      </div>

      {/* BARRE DE NAVIGATION EN BAS (FIXE) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] rounded-t-3xl border-t border-slate-100 dark:border-slate-800 z-40 px-6 py-4 pb-8 flex justify-center gap-4">
        <button 
          onClick={() => setActiveTab('pump')}
          className={`flex-1 py-3 px-4 rounded-2xl font-bold text-lg flex items-center justify-center transition-all ${activeTab === 'pump' ? 'bg-rose-100 text-rose-500 shadow-inner' : 'bg-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          {t.tabPump}
        </button>
        <button 
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-3 px-4 rounded-2xl font-bold text-lg flex items-center justify-center transition-all ${activeTab === 'feed' ? 'bg-blue-100 text-blue-500 shadow-inner' : 'bg-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          {t.tabFeed}
        </button>
      </div>

      {/* MODALE STATUT CODE */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowStatusModal(false)}>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-teal-500">{t.statusModalTitle}</h3>
            <div className={`p-4 rounded-2xl mb-6 ${isApproved ? 'bg-teal-50 text-teal-700' : 'bg-orange-50 text-orange-700'}`}>
              <span className="text-3xl block mb-2">{isApproved ? '✅' : '❗'}</span><p className="font-medium text-sm">{isApproved ? t.statusModalAppr : t.statusModalTemp}</p>
            </div>
            <button onClick={() => setShowStatusModal(false)} className="w-full bg-slate-100 dark:bg-slate-800 py-3 rounded-xl font-bold">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
