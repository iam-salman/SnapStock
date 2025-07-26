"use client";

import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback, FC, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
// This is the corrected line
import { Html5QrcodeScanner, type QrcodeSuccessCallback, type Html5QrcodeResult } from "html5-qrcode";
import {
  Power, QrCode, Share2, X, MapPin, ChevronDown, BatteryFull, CheckCircle, Copy, AlertTriangle, Info, Sun, Moon, User, Save, History, LayoutGrid, ChevronsRight, Target, BatteryCharging, Calendar, Clock
} from "lucide-react";

// --- CONFIGURATION & CONSTANTS ---
const APP_NAME = "SnapStock";
const FONT_URL = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap";
const STATIONS_DATA = [
  { id: "De963991", name: "Hallo Majra" },
  { id: "De425627", name: "Raipur khurd" },
  { id: "De988915", name: "Sector 42" },
  { id: "De316535", name: "Malloya" },
  { id: "De337282", name: "Daria" },
  { id: "De258797", name: "Sector 20" },
  { id: "De455892", name: "Sector 35" },
  { id: "De297974", name: "Sector 26" },
];

// --- TYPE DEFINITIONS ---
type Theme = "light" | "dark";
type ActiveView = 'main' | 'history' | 'profile';
type ToastType = "success" | "error" | "info";
type Profile = { stationId: string; stationName: string; };
type BatteryEntry = { batteryId: string; timestamp: string };
type ScanSession = { date: string; timestamp: string; chargers: number; entries: BatteryEntry[]; };
type ScannedData = { [stationId: string]: ScanSession[] };
interface ToastItem { id: number; message: string; type: ToastType }
type SharePayload = ScanSession | null;


// --- REACT CONTEXT SETUP ---
interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  profile: Profile;
  updateProfile: (newProfile: Profile) => void;
  showToast: (message: string, type?: ToastType) => void;
  scannedData: ScannedData;
  commitSessionToHistory: (session: ScanSession) => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  triggerShare: (payload: SharePayload) => void;
}

const AppContext = createContext<AppContextType | null>(null);
const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within an AppProvider");
  return context;
};

// --- GLOBAL STYLES & HELPER FUNCTIONS ---
const GlobalStyles: FC = () => (
  <style jsx global>{`
    :root {
      --font-primary: 'Outfit', sans-serif;
      --radius: 0.75rem;
      
      --c-bg: #F4F7FE;
      --c-bg-alt: #FFFFFF;
      --c-text: #0D111C;
      --c-text-alt: #5C677D;
      --c-border: #E5E9F2;
      --c-accent: #4F46E5;
      --c-accent-glow: rgba(79, 70, 229, 0.2);
      --c-accent-text: #FFFFFF;
      --c-danger: #e54646;
      --c-success: #22c55e;
      
      --shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.06);
    }
    html.dark {
      --c-bg: #0D1117;
      --c-bg-alt: #161B22;
      --c-text: #E6EDF3;
      --c-text-alt: #8D96A0;
      --c-border: #30363D;
      --c-accent: #58A6FF;
      --c-accent-glow: rgba(88, 166, 255, 0.15);
      --c-accent-text: #0D1117;
      --c-danger: #f87171;
      --c-success: #4ade80;
    }
    body {
      font-family: var(--font-primary);
      background-color: var(--c-bg);
      color: var(--c-text);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .transition-all { transition: all 0.2s ease-in-out; }
  `}</style>
);

const formatDateHeader = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return `Today, ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`;
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// --- REUSABLE UI COMPONENTS ---
const Card: FC<{ children: ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-[var(--c-bg-alt)] rounded-[var(--radius)] shadow-[var(--shadow)] transition-all ${className}`}>{children}</div>
);

const Modal: FC<{ isOpen: boolean; onClose: () => void; title: string; children: ReactNode }> = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="bg-[var(--c-bg)] rounded-xl shadow-[var(--shadow-lg)] w-full max-w-sm border border-[var(--c-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--c-border)]">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--c-border)] text-[var(--c-text-alt)]">
              <X size={20} />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const ToastContainer: FC<{ toasts: ToastItem[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
    const Toast: FC<ToastItem & { onDismiss: (id: number) => void }> = ({ id, message, type, onDismiss }) => {
        useEffect(() => { const timer = setTimeout(() => onDismiss(id), 4000); return () => clearTimeout(timer); }, [id, onDismiss]);
        const typeInfo = {
            success: { icon: CheckCircle, color: 'var(--c-success)' },
            error: { icon: AlertTriangle, color: 'var(--c-danger)' },
            info: { icon: Info, color: 'var(--c-accent)' },
        };
        const Icon = typeInfo[type].icon;
        return (
            <motion.div
                layout initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 30, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex items-center bg-[var(--c-bg-alt)] text-[var(--c-text)] py-3 px-4 rounded-lg shadow-[var(--shadow-lg)] border border-[var(--c-border)] min-w-[320px]"
            >
                <Icon size={20} className="mr-3 shrink-0" style={{ color: typeInfo[type].color }} />
                <span className="flex-grow text-sm font-medium">{message}</span>
                <button onClick={() => onDismiss(id)} className="ml-2 p-1 rounded-full hover:bg-[var(--c-border)] text-[var(--c-text-alt)]"> <X size={16} /> </button>
            </motion.div>
        );
    };
    return (
        <div className="fixed top-5 right-5 z-[1001] space-y-2">
            <AnimatePresence initial={false}>
                {toasts.map((toast) => <Toast key={toast.id} {...toast} onDismiss={onDismiss} />)}
            </AnimatePresence>
        </div>
    );
};

const CustomDropdown: FC<{ options: {id: string; name: string}[]; selected: Profile; onSelect: (profile: Pick<Profile, 'stationId' | 'stationName'>) => void; }> = ({ options, selected, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (option: {id: string; name: string}) => {
        onSelect({ stationId: option.id, stationName: option.name });
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between bg-[var(--c-bg)] p-3 rounded-lg border border-[var(--c-border)] hover:border-[var(--c-accent)] focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px] focus:shadow-[var(--c-accent-glow)] outline-none">
                <div className="flex items-center gap-3">
                    <MapPin size={18} className="text-[var(--c-accent)]" />
                    <span className="font-medium">{selected.stationName || "Select a Station"}</span>
                </div>
                <ChevronDown size={20} className={`text-[var(--c-text-alt)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.ul initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full mt-2 w-full bg-[var(--c-bg-alt)] border border-[var(--c-border)] rounded-lg shadow-[var(--shadow-lg)] z-10 p-1 max-h-60 overflow-y-auto">
                        {options.map(option => (
                            <li key={option.id} onClick={() => handleSelect(option)} className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--c-accent)] hover:text-[var(--c-accent-text)] cursor-pointer text-sm font-medium">
                                {option.name}
                                {option.id === selected.stationId && <CheckCircle size={16} />}
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
};


// --- APP-SPECIFIC COMPONENTS ---

const Header: FC = () => {
    const { profile } = useAppContext();
    return (
        <header className="p-4 flex items-center justify-between sticky top-0 bg-[var(--c-bg)]/80 backdrop-blur-md z-10 border-b border-[var(--c-border)]">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[var(--c-accent)] rounded-lg flex items-center justify-center shadow-[0_0_20px] shadow-[var(--c-accent-glow)]">
                    <Power className="text-[var(--c-accent-text)]" size={20} />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight leading-tight">{APP_NAME}</h1>
                    <p className="text-xs text-[var(--c-text-alt)] leading-tight">{profile.stationName || 'No Profile Set'}</p>
                </div>
            </div>
        </header>
    );
};

const BottomNav: FC = () => {
  const { activeView, setActiveView } = useAppContext();
  const [isScanFlowActive, setIsScanFlowActive] = useState(false);

  const navItems: { label: string; view: ActiveView; icon: React.ElementType }[] = [
    { label: 'Home', view: 'main', icon: LayoutGrid },
    { label: 'History', view: 'history', icon: History },
  ];

  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 bg-[var(--c-bg-alt)]/80 backdrop-blur-md border-t border-[var(--c-border)] z-50">
        <div className="max-w-md mx-auto grid grid-cols-4 items-center gap-2 p-2">
            {navItems.map(({ label, view, icon: Icon }) => (
                 <button key={label} onClick={() => setActiveView(view)} className={`transition-all duration-200 active:scale-90 p-2 rounded-xl flex flex-col items-center justify-center space-y-1 h-14 ${activeView === view ? 'text-[var(--c-accent)]' : 'text-[var(--c-text-alt)] hover:bg-[var(--c-bg)]'}`}>
                    <Icon size={20} /> <span className="text-xs font-medium">{label}</span>
                 </button>
            ))}
            <button onClick={() => setIsScanFlowActive(true)} className="col-span-1 bg-[var(--c-accent)] text-[var(--c-accent-text)] h-16 rounded-xl flex flex-col items-center justify-center space-y-1 font-bold transition-all active:scale-95 hover:opacity-90">
                <QrCode size={24} /> <span className="text-xs">Start Scan</span>
            </button>
             <button onClick={() => setActiveView('profile')} className={`transition-all duration-200 active:scale-90 p-2 rounded-xl flex flex-col items-center justify-center space-y-1 h-14 ${activeView === 'profile' ? 'text-[var(--c-accent)]' : 'text-[var(--c-text-alt)] hover:bg-[var(--c-bg)]'}`}>
                <User size={20} /> <span className="text-xs font-medium">Profile</span>
             </button>
        </div>
      </footer>
      <AnimatePresence>
        {isScanFlowActive && <ScanningFlow onExit={() => setIsScanFlowActive(false)} />}
      </AnimatePresence>
    </>
  );
};

const ShareModal: FC<{ payload: SharePayload, onClose: () => void }> = ({ payload, onClose }) => {
    const { profile, showToast } = useAppContext();
    const isOpen = !!payload;

    const shareText = useMemo(() => {
        if (!payload) return "";
        return `🔋 *Battery Dost - Scan Report* 🔋\n\n*Station:* ${profile.stationName}\n*ID:* ${profile.stationId}\n*Date:* ${new Date(payload.date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})} at ${payload.timestamp}\n\n*Total Chargers:* ${payload.chargers}\n*Batteries Scanned:* ${payload.entries.length}\n\n*--- Scanned IDs ---*\n${payload.entries.map(e => e.batteryId).join('\n') || 'No batteries in this session.'}`;
    }, [payload, profile]);
    
    const whatsappLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareText).then(() => {
            showToast("Report copied!", "success");
            onClose();
        }, () => {
            showToast("Failed to copy", "error");
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Scan Report">
            <div className="space-y-4">
                <p className="text-sm text-[var(--c-text-alt)]">Share a summary of this session for <strong>{profile.stationName}</strong>.</p>
                <div className="p-3 bg-[var(--c-bg)] rounded-lg text-xs text-[var(--c-text-alt)] whitespace-pre-wrap h-40 overflow-y-auto border border-[var(--c-border)]">{shareText}</div>
                <div className="flex flex-col space-y-3">
                     <a href={whatsappLink} target="_blank" rel="noopener noreferrer" onClick={onClose} className="w-full text-center bg-[#25D366] text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-opacity hover:opacity-90">Share on WhatsApp</a>
                     <button onClick={copyToClipboard} className="w-full text-center bg-[var(--c-bg)] text-[var(--c-text)] font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-[var(--c-border)] hover:bg-[var(--c-border)]"><Copy size={16} /> Copy Text</button>
                </div>
            </div>
        </Modal>
    );
};

const ScanningFlow: FC<{ onExit: () => void }> = ({ onExit }) => {
  type Stage = 'chargers' | 'scanning';
  const [stage, setStage] = useState<Stage>('chargers');
  const [chargers, setChargers] = useState<number | ''>('');
  const [sessionEntries, setSessionEntries] = useState<BatteryEntry[]>([]);
  const { commitSessionToHistory, triggerShare, showToast, profile } = useAppContext();

  const startScanning = () => {
    if (!profile.stationId) {
        showToast("Please set a station profile first.", "error");
        onExit();
        return;
    }
    setStage('scanning');
  }

  const completeAndExit = () => {
    if (sessionEntries.length > 0) {
      const session: ScanSession = {
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        chargers: Number(chargers) || 0,
        entries: sessionEntries
      };
      commitSessionToHistory(session);
      triggerShare(session);
    } else {
      showToast("Scan session cancelled, no entries saved.", "info");
    }
    onExit();
  };
  
  const addEntry = (entry: BatteryEntry) => {
    if(sessionEntries.some(e => e.batteryId === entry.batteryId)) {
        showToast("Battery already scanned in this session.", "info");
        return;
    }
    setSessionEntries(prev => [entry, ...prev]);
    showToast(`Scanned: ${entry.batteryId}`, "success");
  }

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="fixed inset-0 bg-[var(--c-bg)] z-[100] flex flex-col">
       <header className="p-4 flex items-center justify-between border-b border-[var(--c-border)] shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2"><Target size={20} className="text-[var(--c-accent)]" /> New Scan Session</h2>
        <button onClick={onExit} className="p-1.5 rounded-full hover:bg-[var(--c-border)] text-[var(--c-text-alt)]"> <X size={20} /> </button>
      </header>
      
      <AnimatePresence mode="wait">
        <motion.div key={stage} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex flex-col flex-grow overflow-hidden">
            {stage === 'chargers' ? (
                <div className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold">Step 1: Set Charger Count</h3>
                    <Card className="p-6 space-y-2">
                        <label htmlFor="charger-input" className="text-sm font-medium text-[var(--c-text-alt)] flex items-center gap-2"><BatteryCharging size={16}/> Total Chargers for this scan</label>
                        <input id="charger-input" type="number" value={chargers} placeholder="e.g., 10" onChange={e => setChargers(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full text-2xl font-bold p-3 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px] focus:shadow-[var(--c-accent-glow)] outline-none" />
                    </Card>
                    <button onClick={startScanning} className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3.5 rounded-xl transition-all active:scale-95 hover:opacity-90">Start Scanning <ChevronsRight size={18}/></button>
                </div>
            ) : (
                <div className="flex flex-col flex-grow h-[calc(100vh-65px)]"> {/* vh minus header height */}
                    <div id="qr-code-reader" className="w-full max-w-sm mx-auto p-4 shrink-0"></div>
                    <div className="flex-grow p-4 pt-0 space-y-3 overflow-y-auto">
                        <h3 className="font-semibold">Scanned in this session ({sessionEntries.length})</h3>
                        {sessionEntries.length > 0 ? (
                           <AnimatePresence>
                           {sessionEntries.map(entry => (
                            <motion.div key={entry.batteryId} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-between bg-[var(--c-bg-alt)] p-3 rounded-lg border border-[var(--c-border)]">
                                <div className="flex items-center gap-3"><BatteryFull className="text-[var(--c-success)]" size={20} /><span className="font-mono text-sm">{entry.batteryId}</span></div>
                                <span className="text-xs text-[var(--c-text-alt)]">{entry.timestamp}</span>
                            </motion.div>
                           ))}
                           </AnimatePresence>
                        ) : <p className="text-sm text-center text-[var(--c-text-alt)] py-8">Point camera at QR code.</p>}
                    </div>
                    <div className="p-4 border-t border-[var(--c-border)] shrink-0">
                        <button onClick={completeAndExit} className="w-full flex items-center justify-center gap-2 bg-[var(--c-success)] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 hover:opacity-90"><CheckCircle size={18}/> Complete & Save Scan</button>
                    </div>
                    <ScannerEffect onScan={addEntry} />
                </div>
            )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

const ScannerEffect: FC<{onScan: (entry: BatteryEntry) => void}> = ({ onScan }) => {
    const { showToast } = useAppContext();
    
    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        try {
            scanner = new Html5QrcodeScanner('qr-code-reader', { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true }, false);
            
            const handleSuccess: QrcodeSuccessCallback = (decodedText) => {
                const newEntry = {
                    batteryId: decodedText,
                    timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                };
                onScan(newEntry);
            };

            scanner.render(handleSuccess, undefined).catch(err => {
                console.error("Scanner render error:", err);
                showToast("Camera could not be started.", "error");
            });
        } catch (error) {
            console.error("Scanner instantiation error:", error);
            showToast("QR Scanner failed to start.", "error");
        }

        return () => {
            if (scanner && scanner.isScanning) {
                scanner.clear().catch(error => {
                    console.error("Failed to clear html5QrcodeScanner.", error);
                });
            }
        };
    }, [onScan, showToast]);

    return null; // This component only manages the effect
};

const HistoryLogSummary: FC<{ session: ScanSession }> = ({ session }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Card className="p-0 overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 hover:bg-[var(--c-bg)] transition-all text-left">
                <div className="flex items-center gap-3">
                    <Calendar size={20} className="text-[var(--c-accent)]" />
                    <div>
                        <p className="font-semibold">{new Date(session.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        <p className="text-xs text-[var(--c-text-alt)] flex items-center gap-1.5"><Clock size={12}/>{session.timestamp}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="font-mono text-sm flex items-center gap-1.5 justify-end"><BatteryFull size={14}/> {session.entries.length}</p>
                        <p className="font-mono text-xs text-[var(--c-text-alt)] flex items-center gap-1.5 justify-end"><BatteryCharging size={12}/> {session.chargers}</p>
                    </div>
                    <ChevronDown size={20} className={`text-[var(--c-text-alt)] transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-2 pt-0 space-y-1">
                        {session.entries.map(entry => (
                            <div key={entry.batteryId} className="flex items-center justify-between p-3 rounded-md">
                                <div className="flex items-center gap-3"><ChevronsRight size={16} className="text-[var(--c-text-alt)]" /><span className="font-mono text-sm">{entry.batteryId}</span></div>
                                <span className="text-xs text-[var(--c-text-alt)]">{entry.timestamp}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
            </AnimatePresence>
        </Card>
    );
};

const HistoryView: FC = () => {
    const { profile, scannedData } = useAppContext();
    const sortedHistory = useMemo(() => {
        const stationHistory = scannedData[profile.stationId] || [];
        if (!Array.isArray(stationHistory)) return []; // Defensive check for old data
        return stationHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [scannedData, profile.stationId]);
    
    if (!profile.stationId) { 
        return (
            <div className="p-6 text-center flex items-center justify-center h-full">
                <Card className="p-8">
                    <User size={48} className="mx-auto text-[var(--c-accent)]" />
                    <h2 className="text-xl font-bold mt-4">Profile Not Set</h2>
                    <p className="text-md text-[var(--c-text-alt)] mt-2">Go to the Profile tab to view history.</p>
                </Card>
            </div>
        ); 
    }
    return (
        <div className="p-4 space-y-4">
          <h2 className="text-2xl font-extrabold flex items-center gap-3"><History size={24} /> Scan Session History</h2>
          {sortedHistory.length > 0 ? (
            sortedHistory.map((session, i) => <HistoryLogSummary key={`${session.date}-${session.timestamp}-${i}`} session={session} />)
          ) : <div className="text-center py-16 text-[var(--c-text-alt)]"><History size={40} className="mx-auto mb-4" /><p className="font-semibold">No scan sessions recorded.</p></div>}
        </div>
      );
};

const MainView: FC = () => {
  const { profile, scannedData } = useAppContext();
  
  const uniqueBatteries = useMemo(() => {
    const stationHistory = scannedData[profile.stationId] || [];
    if (!Array.isArray(stationHistory)) return 0; // Defensive check
    const allEntries = stationHistory.flatMap(session => session.entries);
    return new Set(allEntries.map(e => e.batteryId)).size;
  }, [scannedData, profile.stationId]);

  const totalChargersFromLastScan = useMemo(() => {
    const stationHistory = scannedData[profile.stationId] || [];
    if (!Array.isArray(stationHistory) || stationHistory.length === 0) return 0; // Defensive check
    const sortedHistory = [...stationHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sortedHistory[0]?.chargers ?? 0;
  }, [scannedData, profile.stationId]);
  
  if (!profile.stationId) {
    return (
        <div className="p-6 text-center flex items-center justify-center h-full">
            <Card className="p-8">
                <User size={48} className="mx-auto text-[var(--c-accent)]" />
                <h2 className="text-xl font-bold mt-4">Welcome to Battery Dost!</h2>
                <p className="text-md text-[var(--c-text-alt)] mt-2">Please go to the Profile tab to set up your station.</p>
            </Card>
        </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
            <h3 className="text-sm font-medium text-[var(--c-text-alt)] flex items-center gap-2"><BatteryCharging size={16}/> Chargers (Last Scan)</h3>
            <p className="text-3xl font-bold mt-1">{totalChargersFromLastScan}</p>
        </Card>
        <Card className="p-4">
            <h3 className="text-sm font-medium text-[var(--c-text-alt)] flex items-center gap-2"><BatteryFull size={16}/> Unique Batteries</h3>
            <p className="text-3xl font-bold mt-1">{uniqueBatteries}</p>
        </Card>
      </div>
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-3"><LayoutGrid size={20} /> Quick Access</h2>
        <Card className="p-4 text-center text-[var(--c-text-alt)]">
            <p>More dashboard widgets coming soon!</p>
        </Card>
      </div>
    </div>
  );
};

const ProfileView: FC = () => {
    const { profile, updateProfile, setActiveView, showToast } = useAppContext();
    const [localProfile, setLocalProfile] = useState<Profile>(profile);

    const handleSave = () => {
        if (!localProfile.stationName || !localProfile.stationId) {
            showToast("Station Name and ID cannot be empty.", "error");
            return;
        }
        updateProfile(localProfile);
        showToast("Profile updated successfully!", "success");
        setActiveView('main');
    };
    
    return (
        <div className="p-4 space-y-6 flex-grow">
            <h2 className="text-2xl font-extrabold flex items-center gap-3"><User size={24} /> Station Profile</h2>
            <Card className="p-6 space-y-5">
                <div>
                    <label className="text-sm font-medium text-[var(--c-text-alt)]">Station Name</label>
                    <input type="text" value={localProfile.stationName} onChange={e => setLocalProfile(p => ({...p, stationName: e.target.value}))} className="mt-1 w-full p-3 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px] focus:shadow-[var(--c-accent-glow)] outline-none" />
                </div>
                <div>
                    <label className="text-sm font-medium text-[var(--c-text-alt)]">Station ID</label>
                    <input type="text" value={localProfile.stationId} onChange={e => setLocalProfile(p => ({...p, stationId: e.target.value}))} className="mt-1 w-full p-3 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px] focus:shadow-[var(--c-accent-glow)] outline-none" />
                </div>
                <div>
                    <label className="text-sm font-medium text-[var(--c-text-alt)]">Change Station (Preset)</label>
                    <CustomDropdown options={STATIONS_DATA} selected={localProfile} onSelect={(s) => setLocalProfile(p => ({...p, ...s}))}/>
                </div>
            </Card>
            <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3.5 rounded-xl transition-all active:scale-95 hover:opacity-90"><Save size={18}/> Save Profile</button>
        </div>
    );
};

// --- ROOT APP COMPONENT ---
const App: FC = () => {
  const [theme, setTheme] = useState<Theme>("light");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [profile, setProfile] = useState<Profile>({ stationId: "", stationName: "" });
  const [scannedData, setScannedData] = useState<ScannedData>({});
  const [activeView, setActiveView] = useState<ActiveView>('main');
  const [sharePayload, setSharePayload] = useState<SharePayload>(null);

  useEffect(() => {
    setIsMounted(true);
    setTheme((localStorage.getItem("app-theme") as Theme) || "light");
    const savedProfile = localStorage.getItem("app-profile");
    if(savedProfile) setProfile(JSON.parse(savedProfile));
    const savedData = localStorage.getItem("scanned-data");
    if(savedData) setScannedData(JSON.parse(savedData));
  }, []);

  useEffect(() => { if (isMounted) { document.documentElement.className = theme; } }, [theme, isMounted]);

  const updateProfile = useCallback((newProfile: Profile) => {
    setProfile(newProfile);
    localStorage.setItem("app-profile", JSON.stringify(newProfile));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToasts(p => [...p, { id: Date.now() + Math.random(), message, type }]);
  }, []);

  const commitSessionToHistory = useCallback((session: ScanSession) => {
    if (!profile.stationId) { showToast("Cannot save, profile not set.", "error"); return; }
    setScannedData(prevData => {
        const stationHistory = prevData[profile.stationId] || [];
        // Defensive check to handle old data format
        const validHistory = Array.isArray(stationHistory) ? stationHistory : [];
        const updatedHistory = [session, ...validHistory];
        const newData = { ...prevData, [profile.stationId]: updatedHistory };
        localStorage.setItem("scanned-data", JSON.stringify(newData));
        return newData;
    });
  }, [profile.stationId, showToast]);

  const triggerShare = useCallback((payload: SharePayload) => setSharePayload(payload), []);
  
  const toggleTheme = useCallback(() => {
    setTheme(p => {
        const newTheme = p === "light" ? "dark" : "light";
        localStorage.setItem("app-theme", newTheme);
        return newTheme;
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(p => p.filter(t => t.id !== id))
  }, []);

  if (!isMounted) return <div style={{ visibility: 'hidden' }} />;
  
  const appContextValue: AppContextType = {
    theme, toggleTheme,
    profile, updateProfile,
    showToast,
    scannedData, commitSessionToHistory,
    activeView, setActiveView,
    triggerShare,
  };

  const views: Record<ActiveView, React.ReactNode> = {
    main: <MainView />,
    history: <HistoryView />,
    profile: <ProfileView />
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <link rel="stylesheet" href={FONT_URL} />
      <GlobalStyles />
      <div className="flex flex-col h-screen antialiased">
          <Header />
          <main className="flex-grow overflow-y-auto pb-24">
            <AnimatePresence mode="wait">
              <motion.div key={activeView} initial={{ opacity: 0, x: activeView === 'main' ? 0 : 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                  {views[activeView]}
              </motion.div>
            </AnimatePresence>
          </main>
          <BottomNav />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
          <ShareModal payload={sharePayload} onClose={() => setSharePayload(null)} />
      </div>
    </AppContext.Provider>
  );
};

export default App;