
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { extractVehicleData } from '../services/geminiService';
import { VehicleInfo, AppSettings, ScanType } from '../types';
import { Button } from './Button';

const LOADING_MESSAGES = [
  "Initialisation de l'IA...",
  "Analyse de l'image...",
  "Lecture du numéro de châssis...",
  "Identification du modèle...",
  "Vérification des données...",
  "Finalisation du scan..."
];

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [vehicleData, setVehicleData] = useState<Partial<VehicleInfo>>({});
  const [history, setHistory] = useState<VehicleInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLocation, setActiveLocation] = useState<string>('');
  const [isLocationLocked, setIsLocationLocked] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentScanMode, setCurrentScanMode] = useState<ScanType>('vin');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [newLocationInput, setNewLocationInput] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'STOCK AUTO MAROC',
    allowedLocations: ['RECEPTION', 'SHOWROOM', 'DEPOT', 'LIVRAISON'],
    strictLocationMode: false,
    businessType: 'VO'
  });
  
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 1500);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('vin_scan_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedSettings = localStorage.getItem('vin_scan_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => {
    localStorage.setItem('vin_scan_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('vin_scan_settings', JSON.stringify(settings));
  }, [settings]);

  const filteredHistory = useMemo(() => {
    const term = searchTerm.toUpperCase().trim();
    if (!term) return history;
    return history.filter(item => 
      item.vin.includes(term) || 
      (item.plate && item.plate.includes(term)) ||
      item.make.toUpperCase().includes(term) ||
      item.model.toUpperCase().includes(term) ||
      item.location.toUpperCase().includes(term)
    );
  }, [history, searchTerm]);

  const vibrate = (type: 'success' | 'warning' | 'error' = 'success') => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      const patterns = { success: [10, 30, 10], warning: [100, 50, 100], error: [200, 50, 200] };
      window.navigator.vibrate(patterns[type]);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(text);
      vibrate('success');
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  const handleScan = (mode: ScanType) => {
    if (!activeLocation) {
      setError("⚠️ CHOISISSEZ UNE ZONE EN HAUT AVANT DE SCANNER");
      vibrate('warning');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentScanMode(mode);
    setError(null);
    cameraRef.current?.click();
  };

  const compressImage = (file: File): Promise<{base64: string, mimeType: string, dataUrl: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 1200; 
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, mimeType: 'image/jpeg', dataUrl });
        };
      };
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { base64, mimeType, dataUrl } = await compressImage(file);
      setPreviewImage(dataUrl);
      const result = await extractVehicleData(base64, currentScanMode, settings.businessType, mimeType);
      if (result.error) {
        setError(result.error);
        vibrate('error');
      } else {
        const detectedVin = (result.vin || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        setVehicleData({ 
          vin: detectedVin, 
          plate: (result.plate || '').toUpperCase(),
          make: (result.make || '').toUpperCase(),
          model: (result.model || '').toUpperCase(),
          year: result.year || '',
        });
        vibrate('success');
        setIsLocationLocked(true);
      }
    } catch (err: any) {
      setError(err.message || "Erreur de connexion.");
      vibrate('error');
    } finally {
      setLoading(false);
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const saveToHistory = () => {
    if (!vehicleData.vin || !activeLocation) return;
    const now = new Date();
    const newEntry: VehicleInfo = {
      ...vehicleData as VehicleInfo,
      location: activeLocation,
      fullDate: now.toLocaleDateString('fr-FR'), 
      timestamp: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    setHistory([newEntry, ...history]);
    setVehicleData({}); 
    setPreviewImage(null);
    vibrate('success');
  };

  const exportToCSV = () => {
    if (history.length === 0) return;
    const headers = ['VIN', 'IMMAT', 'MARQUE', 'MODELE', 'ANNEE', 'DATE', 'HEURE', 'ZONE'];
    const rows = history.map(item => [
      item.vin,
      item.plate || '',
      item.make,
      item.model,
      item.year,
      item.fullDate,
      item.timestamp,
      item.location
    ]);
    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventaire_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareOnWhatsApp = (item: VehicleInfo) => {
    const text = `📦 *INVENTAIRE STOCK*\n\n📍 Zone: ${item.location}\n🚗 Véhicule: ${item.make} ${item.model}\n🔢 VIN: ${item.vin}\n🆔 Plaque: ${item.plate || 'N/A'}\n📅 Date: ${item.fullDate} à ${item.timestamp}`;
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-slate-50 font-sans pb-12">
      <header className="bg-gradient-to-br from-blue-700 to-indigo-900 text-white p-6 pb-20 rounded-b-[3.5rem] shadow-2xl relative">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">{settings.companyName}</h1>
            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase mt-2 inline-block ${settings.businessType === 'VN' ? 'bg-emerald-400 text-emerald-950' : 'bg-orange-400 text-orange-950'}`}>
              FLOTTE {settings.businessType}
            </span>
          </div>
          <button onClick={() => setShowSettings(true)} className="w-12 h-12 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 -mt-12 space-y-6 z-10">
        <section className={`bg-white p-6 rounded-[2.5rem] shadow-xl border-2 transition-all ${!isLocationLocked ? 'border-blue-500 scale-[1.02]' : 'border-transparent opacity-95'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">📍 ZONE DE TRAVAIL</h2>
            {isLocationLocked && <button onClick={() => setIsLocationLocked(false)} className="text-blue-600 font-black text-[10px] uppercase underline underline-offset-4">Changer</button>}
          </div>
          {!isLocationLocked ? (
            <select value={activeLocation} onChange={e => {setActiveLocation(e.target.value); setError(null);}} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-blue-300 transition-colors">
              <option value="">CHOISIR UNE ZONE...</option>
              {settings.allowedLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          ) : (
            <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-blue-200">!</div>
              <p className="font-black text-blue-900 uppercase text-lg">{activeLocation}</p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex gap-3">
            <button 
              onClick={() => handleScan('vin')} 
              className={`flex-1 py-8 rounded-[2.5rem] text-white flex flex-col items-center gap-3 shadow-xl transition-all active:scale-95 ${!activeLocation ? 'bg-slate-300 grayscale cursor-not-allowed' : 'bg-blue-600 shadow-blue-200'} ${settings.businessType === 'VO' ? 'flex-[2]' : 'w-full'}`}
            >
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">📸</div>
              <span className="text-[10px] font-black uppercase tracking-widest">Scanner NIV</span>
            </button>
            
            {settings.businessType === 'VO' && (
              <button 
                onClick={() => handleScan('carte_grise')} 
                className={`flex-1 py-8 rounded-[2.5rem] text-white flex flex-col items-center gap-3 shadow-xl transition-all active:scale-95 ${!activeLocation ? 'bg-slate-300 grayscale cursor-not-allowed' : 'bg-slate-900 shadow-slate-300'}`}
              >
                <div className="text-3xl">📄</div>
                <span className="text-[9px] font-black uppercase tracking-widest text-center">Carte Grise</span>
              </button>
            )}
            
            <input type="file" accept="image/*" className="hidden" ref={cameraRef} onChange={handleImageUpload} />
          </div>

          {(vehicleData.vin || error || loading || previewImage) && (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl space-y-4 animate-in zoom-in duration-300 border border-slate-50">
              {previewImage && !loading && (
                <div className="relative w-full h-32 bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-50">
                   <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                   <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center text-xs">✕</button>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Numéro de Châssis (VIN)</label>
                <input value={vehicleData.vin || ''} onChange={e => setVehicleData({...vehicleData, vin: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-5 text-2xl font-black font-mono text-blue-700 outline-none focus:border-blue-400 transition-all" placeholder="VIN..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Marque</label>
                  <input value={vehicleData.make || ''} onChange={e => setVehicleData({...vehicleData, make: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:border-blue-200" placeholder="EX: MG" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Modèle</label>
                  <input value={vehicleData.model || ''} onChange={e => setVehicleData({...vehicleData, model: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold uppercase outline-none focus:border-blue-200" placeholder="EX: MG4" />
                </div>
              </div>
              {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100">{error}</div>}
              <Button onClick={saveToHistory} disabled={!vehicleData.vin} className="w-full py-5 bg-emerald-600 shadow-emerald-200">VALIDER LE STOCK</Button>
            </div>
          )}
        </section>

        <div className="space-y-4 pt-4">
          <div className="relative">
            <input type="text" placeholder="RECHERCHER DANS LE STOCK..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white shadow-xl rounded-[2rem] px-8 py-5 text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300">🔍</span>
          </div>
          <div className="flex justify-between items-center px-4">
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Inventaire ({filteredHistory.length})</h3>
            <button onClick={exportToCSV} className="text-[10px] font-black text-blue-600 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100 active:scale-95">EXPORTER CSV</button>
          </div>
          <div className="space-y-4 pb-12">
            {filteredHistory.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-[2.5rem] shadow-md flex justify-between items-start border border-slate-100 animate-in slide-in-from-right duration-300">
                <div className="flex-1 truncate">
                  <p className="font-black text-slate-900 text-sm uppercase truncate tracking-tight">{item.make} {item.model}</p>
                  <p className="text-[12px] font-mono font-black text-blue-600 mt-2 bg-blue-50/50 inline-block px-2 py-1 rounded-lg">{item.vin}</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/50">📍 {item.location}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  <button onClick={() => shareOnWhatsApp(item)} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm border border-emerald-100 active:scale-90 transition-all">📲</button>
                  <button onClick={() => {if(window.confirm("Supprimer ce véhicule du stock ?")){ const n=[...history]; n.splice(idx,1); setHistory(n); vibrate('warning'); }}} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shadow-sm border border-red-100 active:scale-90 transition-all">🗑️</button>
                </div>
              </div>
            ))}
            {filteredHistory.length === 0 && (
              <div className="py-20 text-center opacity-30 grayscale flex flex-col items-center">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em]">Aucun résultat</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/98 backdrop-blur-xl z-[100] p-6 flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-8 space-y-8 shadow-2xl border border-white/20 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Config</h2>
              <button onClick={() => setShowSettings(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black active:scale-90 transition-all">✕</button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type de Flotte</label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/50">
                  <button 
                    onClick={() => setSettings({...settings, businessType: 'VN'})} 
                    className={`py-3.5 rounded-xl text-[10px] font-black transition-all ${settings.businessType === 'VN' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    VN (NEUF)
                  </button>
                  <button 
                    onClick={() => setSettings({...settings, businessType: 'VO'})} 
                    className={`py-3.5 rounded-xl text-[10px] font-black transition-all ${settings.businessType === 'VO' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    VO (OCCASION)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Société / Parc</label>
                <input 
                  value={settings.companyName} 
                  onChange={e => setSettings({...settings, companyName: e.target.value.toUpperCase()})} 
                  className="w-full bg-slate-50 p-5 rounded-2xl font-black text-sm uppercase outline-none border-2 border-slate-100 focus:border-blue-400 transition-all" 
                  placeholder="NOM DE LA SOCIÉTÉ"
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Zones de Stockage</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {settings.allowedLocations.map((l, i) => (
                    <span key={i} className="bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-black text-blue-700 flex items-center gap-2 border border-slate-100 shadow-sm">
                      {l}
                      <button onClick={() => setSettings({...settings, allowedLocations: settings.allowedLocations.filter((_, idx) => idx !== i)})} className="text-red-400 font-black">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    value={newLocationInput} 
                    onChange={e => setNewLocationInput(e.target.value.toUpperCase())} 
                    className="flex-1 bg-slate-50 p-4 rounded-xl text-xs font-bold border border-slate-200" 
                    placeholder="NOUVELLE ZONE..." 
                  />
                  <button 
                    onClick={() => { if(newLocationInput){ setSettings({...settings, allowedLocations: [...settings.allowedLocations, newLocationInput]}); setNewLocationInput(''); vibrate('success'); } }} 
                    className="bg-slate-900 text-white w-14 h-14 rounded-2xl font-black text-xl active:scale-95 shadow-lg shadow-slate-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={() => { if(window.confirm("⚠️ ATTENTION : Cela va supprimer TOUT l'historique local. Continuer ?")) { setHistory([]); setShowSettings(false); vibrate('error'); } }} 
                  className="w-full py-4 text-[9px] font-black text-red-500 uppercase border-2 border-red-50 rounded-2xl hover:bg-red-50 active:bg-red-100 transition-all"
                >
                  🗑️ Vider le stock complet
                </button>
              </div>
            </div>

            <Button onClick={() => setShowSettings(false)} className="w-full py-5 shadow-blue-500/20">ENREGISTRER</Button>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-2xl z-[200] flex flex-col items-center justify-center text-white p-10 animate-in fade-in duration-500">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-t-white border-white/20 rounded-full animate-spin shadow-2xl"></div>
            <div className="absolute inset-0 flex items-center justify-center font-black italic text-xl">IA</div>
          </div>
          <h3 className="font-black uppercase tracking-[0.3em] mt-10 text-center text-lg italic leading-tight">{LOADING_MESSAGES[loadingMsgIdx]}</h3>
          <p className="text-blue-300 text-[9px] font-bold uppercase mt-4 tracking-widest opacity-60">Technologie Gemini 2.5 Active</p>
        </div>
      )}
    </div>
  );
};

export default App;
