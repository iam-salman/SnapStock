"use client";

import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
  type FC,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
// --- FIXED: Removed non-existent Html5QrcodeError type ---
import { Html5Qrcode } from "html5-qrcode";
import {
  Share2,
  X,
  MapPin,
  ChevronDown,
  BatteryFull,
  CheckCircle,
  Copy,
  AlertTriangle,
  Info,
  Sun,
  Moon,
  User,
  Save,
  History,
  LayoutGrid,
  ChevronsRight,
  Target,
  BatteryCharging,
  Calendar,
  Clock,
  XCircle,
  Boxes,
  ScanLine,
  Zap,
  Upload,
  ZapOff,
  PlusCircle,
  Trash2,
} from "lucide-react";

declare global {
  interface MediaTrackCapabilities {
    torch?: boolean;
  }
  interface MediaTrackConstraintSet {
    torch?: boolean;
  }
}

const APP_NAME = "SnapStock";
const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap";
const STATIONS_DATA = [
  { id: "De963991", name: "Hallo Majra", city: "Chandigarh" },
  { id: "De425627", name: "Raipur Khurd", city: "Chandigarh" },
  { id: "De988915", name: "Sector 42", city: "Chandigarh" },
  { id: "De316535", name: "Maloya", city: "Chandigarh" },
  { id: "De337282", name: "Daria", city: "Chandigarh" },
  { id: "De258797", name: "Sector 20", city: "Chandigarh" },
  { id: "De455892", name: "Sector 35", city: "Chandigarh" },
  { id: "De297974", name: "Sector 26", city: "Chandigarh" },
];

type Theme = "light" | "dark";
type ActiveView = "main" | "history" | "profile";
type ToastType = "success" | "error" | "info";
type Profile = { stationId: string; stationName: string };
type BatteryEntry = { batteryId: string; timestamp: string };
type InventoryItem = { name: string; count: number };
type ScanSession = {
  date: string;
  timestamp: string;
  items: InventoryItem[];
  entries: BatteryEntry[];
};
type ScannedData = { [stationId: string]: ScanSession[] };
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}
type SharePayload = ScanSession | null;
type StationOption = { id: string; name: string; city: string };

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
  if (!context)
    throw new Error("useAppContext must be used within an AppProvider");
  return context;
};

const GlobalStyles: FC = () => (
  <style>{`
    :root {
      --font-primary: 'Outfit', sans-serif;
      --radius: 0.75rem;
      --c-bg: #F4F7FE;
      --c-bg-alt: #FFFFFF;
      --c-text: #0D111C;
      --c-text-alt: #5C677D;
      --c-text-faint: #9CA3AF;
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
      --c-text-faint: #4B5563;
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
      overscroll-behavior: none;
    }
    #video-container { border: none !important; border-radius: var(--radius); overflow: hidden; background-color: #000; }
    #video-container video { object-fit: cover !important; width: 100% !important; height: 100% !important; border-radius: var(--radius) !important; }
    @keyframes scan { 0% { transform: translateY(0px); } 100% { transform: translateY(245px); } }
    .animate-scan { animation: scan 3s cubic-bezier(0.65, 0, 0.35, 1) infinite alternate; }
  `}</style>
);

const Card: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`bg-[var(--c-bg-alt)] rounded-[var(--radius)] shadow-[var(--shadow)] transition-all ${className}`}
  >
    {children}
  </div>
);

const Modal: FC<{
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  children: ReactNode;
  hideCloseButton?: boolean;
}> = ({ isOpen, onClose, title, children, hideCloseButton = false }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
        onClick={hideCloseButton ? undefined : onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-[var(--c-bg)] rounded-xl shadow-[var(--shadow-lg)] w-full max-w-sm border border-[var(--c-border)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--c-border)]">
            <h3 className="text-lg font-semibold">{title}</h3>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-[var(--c-border)] text-[var(--c-text-alt)] cursor-pointer"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <div className="p-5">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const ToastContainer: FC<{
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}> = ({ toasts, onDismiss }) => {
  const Toast: FC<ToastItem & { onDismiss: (id: number) => void }> = ({
    id,
    message,
    type,
    onDismiss,
  }) => {
    useEffect(() => {
      const timer = setTimeout(() => onDismiss(id), 4000);
      return () => clearTimeout(timer);
    }, [id, onDismiss]);
    const typeInfo = {
      success: { icon: CheckCircle, color: "var(--c-success)" },
      error: { icon: AlertTriangle, color: "var(--c-danger)" },
      info: { icon: Info, color: "var(--c-accent)" },
    };
    const Icon = typeInfo[type].icon;
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 30, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="flex items-center bg-[var(--c-bg-alt)] text-[var(--c-text)] py-3 px-4 rounded-lg shadow-[var(--shadow-lg)] border border-[var(--c-border)] min-w-[320px]"
      >
        <Icon
          size={20}
          className="mr-3 shrink-0"
          style={{ color: typeInfo[type].color }}
        />
        <span className="flex-grow text-sm font-medium">{message}</span>
        <button
          onClick={() => onDismiss(id)}
          className="ml-2 p-1 rounded-full hover:bg-[var(--c-border)] text-[var(--c-text-alt)] cursor-pointer"
        >
          <X size={16} />
        </button>
      </motion.div>
    );
  };
  return (
    <div className="fixed top-5 right-5 z-[1001] space-y-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const CustomDropdown: FC<{
  options: StationOption[];
  selected: Profile;
  onSelect: (profile: Pick<Profile, "stationId" | "stationName">) => void;
}> = ({ options, selected, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const handleSelect = (option: StationOption) => {
    onSelect({ stationId: option.id, stationName: option.name });
    setIsOpen(false);
  };
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[var(--c-bg)] p-3 rounded-lg border border-[var(--c-border)] hover:border-[var(--c-accent)] focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px] focus:shadow-[var(--c-accent-glow)] outline-none cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <MapPin size={18} className="text-[var(--c-accent)]" />
          <span className="font-medium">
            {selected.stationName || "Select a Station"}
          </span>
        </div>
        <ChevronDown
          size={20}
          className={`text-[var(--c-text-alt)] transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 w-full bg-[var(--c-bg-alt)] border border-[var(--c-border)] rounded-lg shadow-[var(--shadow-lg)] z-10 p-1 max-h-60 overflow-y-auto"
          >
            {options.map((option) => (
              <li
                key={option.id}
                onClick={() => handleSelect(option)}
                className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--c-accent)] hover:text-[var(--c-accent-text)] cursor-pointer text-sm font-medium"
              >
                <div>
                  {option.name}
                  <span className="block text-xs opacity-70">
                    {option.city}
                  </span>
                </div>
                {option.id === selected.stationId && <CheckCircle size={16} />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

const Header: FC = () => {
  const { profile } = useAppContext();
  return (
    <header className="p-4 h-[65px] flex items-center justify-between sticky top-0 bg-[var(--c-bg)]/80 backdrop-blur-md z-10 border-b border-[var(--c-border)]">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-[var(--c-accent)] rounded-lg flex items-center justify-center shadow-[0_0_20px] shadow-[var(--c-accent-glow)]">
          <Boxes className="text-[var(--c-accent-text)]" size={20} />
        </div>
        <h1 className="text-lg font-bold tracking-tight">{APP_NAME}</h1>
      </div>
      {profile.stationName && (
        <div className="flex items-center gap-2 text-sm text-[var(--c-text-alt)]">
          <span className="font-semibold text-right text-[var(--c-text)]">
            {profile.stationName}
          </span>
          <MapPin size={16} className="text-[var(--c-accent)]" />
        </div>
      )}
    </header>
  );
};

const BottomNav: FC = () => {
  const { activeView, setActiveView, theme, toggleTheme } = useAppContext();
  const [isScanFlowActive, setIsScanFlowActive] = useState(false);
  const navButtonClass = (view: ActiveView | "theme") =>
    `transition-all duration-200 active:scale-90 p-2 rounded-xl flex flex-col items-center justify-center space-y-1 h-14 cursor-pointer ${
      activeView === view
        ? "text-[var(--c-accent)]"
        : "text-[var(--c-text-alt)] hover:bg-[var(--c-bg)]"
    }`;
  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 bg-[var(--c-bg-alt)]/80 backdrop-blur-md border-t border-[var(--c-border)] z-50">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center gap-1 p-2 h-[72px]">
          <button
            onClick={() => setActiveView("main")}
            className={navButtonClass("main")}
          >
            <LayoutGrid size={20} />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={navButtonClass("history")}
          >
            <History size={20} />
            <span className="text-xs font-medium">History</span>
          </button>
          <div className="flex justify-center">
            <button
              onClick={() => setIsScanFlowActive(true)}
              className="transform -translate-y-4 bg-[var(--c-accent)] text-[var(--c-accent-text)] h-16 w-16 rounded-2xl flex flex-col items-center justify-center font-bold transition-all active:scale-95 hover:opacity-90 shadow-[var(--shadow-lg)] border-4 border-[var(--c-bg-alt)] cursor-pointer"
            >
              <ScanLine size={24} />
              <span className="text-xs mt-1">Scan</span>
            </button>
          </div>
          <button onClick={toggleTheme} className={navButtonClass("theme")}>
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            <span className="text-xs font-medium capitalize">
              {theme === "light" ? "Dark" : "Light"}
            </span>
          </button>
          <button
            onClick={() => setActiveView("profile")}
            className={navButtonClass("profile")}
          >
            <User size={20} />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </footer>
      <AnimatePresence>
        {isScanFlowActive && (
          <ScanningFlow onExit={() => setIsScanFlowActive(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

const ShareModal: FC<{ payload: SharePayload; onClose: () => void }> = ({
  payload,
  onClose,
}) => {
  const { profile, showToast } = useAppContext();
  const isOpen = !!payload;
  
  const shareText = useMemo(() => {
    if (!payload) return "";

    const itemsList = payload.items.length > 0
      ? payload.items.map(item => `- ${item.name}: ${item.count}`).join('\n')
      : "No inventory items recorded.";
      
    const batteryList = payload.entries.length > 0
      ? payload.entries.map(e => `\`${e.batteryId}\``).join('\n')
      : "No batteries in this session.";

    return `*Battery Dost - Scan Report* ⚡\n\n` +
           `*Station Details*\n` +
           `🏢 *Name:* ${profile.stationName}\n` +
           `🆔 *ID:* ${profile.stationId}\n` +
           `📅 *Date:* ${new Date(payload.date).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}\n` +
           `⏰ *Time:* ${payload.timestamp}\n\n` +
           `*Inventory Count*\n` +
           `${itemsList}\n\n` +
           `*Scanned Batteries (${payload.entries.length})*\n` +
           `──────────────────\n` +
           `${batteryList}\n` +
           `──────────────────\n` +
           `Total Scanned: *${payload.entries.length}*`;
           
  }, [payload, profile]);

  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText).then(
      () => {
        showToast("Report copied!", "success");
        onClose();
      },
      () => {
        showToast("Failed to copy", "error");
      }
    );
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Scan Report">
      <div className="space-y-4">
        <p className="text-sm text-[var(--c-text-alt)]">
          Share a summary of this session for{" "}
          <strong>{profile.stationName}</strong>.
        </p>
        <div className="p-3 bg-[var(--c-bg)] rounded-lg text-xs text-[var(--c-text-alt)] whitespace-pre-wrap h-40 overflow-y-auto border border-[var(--c-border)]">
          {shareText}
        </div>
        <div className="flex flex-col space-y-3">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full text-center bg-[#25D366] text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-opacity hover:opacity-90 cursor-pointer"
          >
            Share on WhatsApp
          </a>
          <button
            onClick={copyToClipboard}
            className="w-full text-center bg-[var(--c-bg)] text-[var(--c-text)] font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-[var(--c-border)] hover:bg-[var(--c-border)] cursor-pointer"
          >
            <Copy size={16} /> Copy Text
          </button>
        </div>
      </div>
    </Modal>
  );
};

// --- SCANNER COMPONENT ---
type ScannerState = "idle" | "loading" | "scanning" | "error";
interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onStateChange?: (state: ScannerState) => void;
  showToast: (msg: string, type?: ToastType) => void;
}
interface ScannerControls {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}

const Scanner = forwardRef<ScannerControls, ScannerProps>(
  ({ onScanSuccess, onStateChange, showToast }, ref) => {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isTorchSupported, setIsTorchSupported] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setState = (state: ScannerState) => {
        onStateChange?.(state);
    }

    useImperativeHandle(ref, () => ({
      start: async () => {
        if (html5QrCodeRef.current && !html5QrCodeRef.current.isScanning) {
          setState("loading");
          try {
            await html5QrCodeRef.current.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 220, height: 220 } },
              onScanSuccess,
              () => {}
            );
            const capabilities = html5QrCodeRef.current.getRunningTrackCapabilities();
            if (capabilities.torch) setIsTorchSupported(true);
            setState("scanning");
          } catch (err) {
            console.error("Camera Start Error:", err);
            setState("error");
          }
        }
      },
      stop: async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          try {
            await html5QrCodeRef.current.stop();
            setState("idle");
          } catch (err) {
            console.error("Error stopping scanner:", err);
          }
        }
      },
      pause: () => {
        if (html5QrCodeRef.current?.isScanning) html5QrCodeRef.current.pause(true);
      },
      resume: () => {
        if (html5QrCodeRef.current?.isScanning) html5QrCodeRef.current.resume();
      },
    }));

    useEffect(() => {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("video-container", { verbose: false });
      }
      return () => {
        if (html5QrCodeRef.current?.isScanning) {
            html5QrCodeRef.current.stop().catch(err => console.error("Cleanup stop error", err));
        }
      }
    }, []);

    const toggleTorch = useCallback(async () => {
      if (html5QrCodeRef.current && isTorchSupported) {
        try {
          const torchState = !isTorchOn;
          await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ torch: torchState }] });
          setIsTorchOn(torchState);
        } catch (err) {
          showToast("Could not control torch.", "error");
        }
      }
    }, [isTorchOn, isTorchSupported, showToast]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && html5QrCodeRef.current) {
            showToast("Processing image...", "info");
            try {
                const decodedText = await html5QrCodeRef.current.scanFile(file, false);
                onScanSuccess(decodedText);
            } catch (err) {
                showToast("QR code not found in image.", "error");
            }
        }
        if (event.target) event.target.value = "";
    }

    return (
      <>
        <div id="video-container" className="w-full h-full"></div>
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
          {isTorchSupported && (
            <button onClick={toggleTorch} className="w-10 h-10 flex items-center justify-center bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors cursor-pointer backdrop-blur-sm">
              {isTorchOn ? <ZapOff size={20} /> : <Zap size={20} />}
            </button>
          )}
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors backdrop-blur-sm text-sm font-semibold cursor-pointer">
            <Upload size={16} /> Scan from Image
          </button>
        </div>
      </>
    );
  }
);
Scanner.displayName = "Scanner";

const AddItemModal: FC<{ isOpen: boolean; onClose: () => void; onAdd: (name: string) => void; }> = ({ isOpen, onClose, onAdd }) => {
    const [itemName, setItemName] = useState("");
    
    const handleSave = () => {
        if (itemName.trim()) {
            onAdd(itemName.trim());
            onClose();
        }
    };
    
    useEffect(() => {
        if(isOpen) setItemName("");
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Inventory Item">
            <div className="space-y-4">
                <div>
                    <label htmlFor="item-name-input" className="text-sm font-medium text-[var(--c-text-alt)] flex items-center gap-2 mb-1">
                        <Boxes size={16} /> Item Name
                    </label>
                    <input
                        id="item-name-input"
                        type="text"
                        value={itemName}
                        placeholder="e.g., Cables"
                        autoFocus
                        onChange={(e) => setItemName(e.target.value)}
                        onKeyUp={(e) => e.key === 'Enter' && handleSave()}
                        className="w-full text-lg font-bold p-3 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px] focus:shadow-[var(--c-accent-glow)] outline-none"
                    />
                </div>
                <button
                    onClick={handleSave}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3 rounded-xl transition-all active:scale-95 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!itemName.trim()}
                >
                    <PlusCircle size={18} /> Add Item
                </button>
            </div>
        </Modal>
    );
};

const ScanningFlow: FC<{ onExit: () => void }> = ({ onExit }) => {
  type Stage = "items" | "scanning";
  const [stage, setStage] = useState<Stage>("items");
  const [items, setItems] = useState<{ name: string; count: number | "" }[]>([ { name: "Chargers", count: "" } ]);
  const [sessionEntries, setSessionEntries] = useState<BatteryEntry[]>([]);
  const [isListOpen, setIsListOpen] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(true);
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [lastScannedEntry, setLastScannedEntry] = useState<BatteryEntry | null>(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const { commitSessionToHistory, triggerShare, showToast, profile } = useAppContext();
  const scannerRef = useRef<ScannerControls | null>(null);
  const sessionEntriesRef = useRef(sessionEntries);

  useEffect(() => {
    sessionEntriesRef.current = sessionEntries;
  }, [sessionEntries]);

  const triggerHapticFeedback = () => {
    if (navigator.vibrate) navigator.vibrate(200);
  };

  const startScanning = () => {
    if (!profile.stationId) {
      showToast("Please set a station profile first.", "error");
      onExit();
      return;
    }
    setStage("scanning");
  };
  
  const handleItemCountChange = (index: number, value: string) => {
    const newItems = [...items];
    newItems[index].count = value === "" ? "" : parseInt(value, 10);
    setItems(newItems);
  };

  const handleConfirmAddItem = (newItemName: string) => {
    if (items.some(item => item.name.toLowerCase() === newItemName.toLowerCase())) {
        showToast("An item with this name already exists.", "error");
        return;
    }
    setItems([...items, { name: newItemName, count: "" }]);
  };
  
  const handleRemoveItem = (indexToRemove: number) => {
    setItems(items.filter((_, index) => index !== indexToRemove));
  };

  const isStartDisabled = useMemo(() => {
    return items.some(item => item.count === "" || isNaN(Number(item.count)));
  }, [items]);

  const handleAllowCamera = async () => {
    setShowPermissionModal(false);
    await scannerRef.current?.start();
  };

  const gracefulExit = () => {
    scannerRef.current?.stop();
    onExit();
  };

  const completeAndSave = () => {
    scannerRef.current?.stop();
    if (sessionEntries.length > 0 || items.some(i => Number(i.count) >= 0)) {
        const finalItems = items
          .map(item => ({ name: item.name, count: Number(item.count) || 0 }))
          .filter(item => item.count >= 0 && item.name !== '');

        const session: ScanSession = {
            date: new Date().toISOString(),
            timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            items: finalItems,
            entries: sessionEntries,
        };
        commitSessionToHistory(session);
        triggerShare(session);
    } else {
        showToast("Session cancelled, no entries saved.", "info");
    }
    onExit();
  };

  const handleScanSuccess = (decodedText: string) => {
    if (isProcessingScan) return;
    setIsProcessingScan(true);
    scannerRef.current?.pause();
    
    const isDuplicate = sessionEntriesRef.current.some(e => e.batteryId === decodedText);
    if (isDuplicate) {
      showToast("Battery already scanned.", "info");
      setTimeout(() => {
        setIsProcessingScan(false);
        scannerRef.current?.resume();
      }, 100);
      return;
    }

    triggerHapticFeedback();

    const newEntry: BatteryEntry = {
      batteryId: decodedText,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };
    setSessionEntries(prev => [newEntry, ...prev]);
    if (!isListOpen) setIsListOpen(true);
    setLastScannedEntry(newEntry);
  };
  
  const handleContinueScanning = () => {
    setLastScannedEntry(null);
    setTimeout(() => {
        setIsProcessingScan(false);
        scannerRef.current?.resume();
    }, 100);
  };

  const handleCompleteFromModal = () => {
    setLastScannedEntry(null);
    completeAndSave();
  };

  const clearSession = () => {
    if (window.confirm("Are you sure? This will clear all scanned items.")) {
      setSessionEntries([]);
      showToast("Session cleared.", "info");
    }
  };
  
  useEffect(() => {
    return () => {
        scannerRef.current?.stop();
    }
  }, []);

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 350, damping: 40 }} className="fixed inset-0 bg-[var(--c-bg)] z-[100] flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-[var(--c-border)] shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Target size={20} className="text-[var(--c-accent)]" /> New Scan Session
        </h2>
        <button onClick={gracefulExit} className="p-1.5 rounded-full hover:bg-[var(--c-border)] text-[var(--c-text-alt)] cursor-pointer">
          <X size={20} />
        </button>
      </header>
      <div className="flex flex-col flex-grow overflow-hidden">
        {stage === "items" ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 space-y-6 overflow-y-auto">
            <h3 className="text-lg font-semibold">Step 1: Log Inventory Counts</h3>
            <Card className="p-4 space-y-4">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-grow">
                    <label htmlFor={`item-input-${index}`} className="text-sm font-medium text-[var(--c-text-alt)] flex items-center gap-2 mb-1">
                      <Boxes size={16} /> {item.name}
                    </label>
                    <input id={`item-input-${index}`} type="number" value={item.count} placeholder="e.g., 10" onChange={(e) => handleItemCountChange(index, e.target.value)} className="w-full text-xl font-bold p-3 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg focus:border-[var(--c-accent)] focus:shadow-[0_0_0_3px] focus:shadow-[var(--c-accent-glow)] outline-none" />
                  </div>
                  {index > 0 && (
                    <button onClick={() => handleRemoveItem(index)} className="p-2 mt-7 text-[var(--c-danger)] hover:bg-[var(--c-danger)]/10 rounded-full">
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setIsAddItemModalOpen(true)} className="w-full flex items-center justify-center gap-2 text-[var(--c-accent)] font-semibold py-2.5 rounded-lg border-2 border-dashed border-[var(--c-accent)]/50 hover:bg-[var(--c-accent)]/10 transition-colors cursor-pointer mt-2">
                <PlusCircle size={18} /> Add Item
              </button>
            </Card>
            <button onClick={startScanning} disabled={isStartDisabled} className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3.5 rounded-xl transition-all active:scale-95 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              <ChevronsRight size={18} /> Start Scanning
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-grow flex flex-col items-center p-4 bg-black space-y-4">
            <div className="w-[250px] h-[250px] bg-gray-900 rounded-lg relative flex items-center justify-center overflow-hidden">
              {scannerState === "loading" && (<div className="text-center text-gray-400 flex items-center flex-col"> <Clock size={40} className="animate-spin" /> <p className="mt-3 font-medium">Starting Camera...</p> </div>)}
              {scannerState === "error" && (<div className="text-center text-red-400 p-4"> <XCircle size={40} /> <p className="mt-3 font-semibold">Camera Failed</p> <p className="text-xs text-gray-400">Please check permissions and try again.</p> </div>)}
              <Scanner ref={scannerRef} onScanSuccess={handleScanSuccess} onStateChange={setScannerState} showToast={showToast} />
              {scannerState === "scanning" && (<div className="absolute inset-0 pointer-events-none z-10"> <div className="w-full h-full relative"> <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white/80 rounded-tl-lg"></div> <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white/80 rounded-tr-lg"></div> <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white/80 rounded-bl-lg"></div> <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white/80 rounded-br-lg"></div> <div className="absolute top-0 w-full h-0.5 bg-red-400/80 shadow-[0_0_10px_red] animate-scan"></div> </div> </div>)}
            </div>
            <div className="w-full max-w-[400px]">
              <div className="bg-[var(--c-bg-alt)] rounded-xl shadow-[var(--shadow-lg)]">
                <div className="p-3 flex justify-between items-center cursor-pointer" onClick={() => setIsListOpen(!isListOpen)}>
                  <h3 className="font-semibold text-[var(--c-text)]"> Scanned Items ({sessionEntries.length}) </h3>
                  <div className="flex items-center gap-2"> {sessionEntries.length > 0 && (<button onClick={(e) => { e.stopPropagation(); clearSession(); }} className="flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-[var(--c-danger)]/10 text-[var(--c-danger)] hover:bg-[var(--c-danger)]/20 transition-colors text-xs font-semibold cursor-pointer"> <XCircle size={14} /> Clear All </button>)} <ChevronDown size={20} className={`text-[var(--c-text-alt)] transition-transform duration-300 ${ isListOpen ? "rotate-180" : "" }`} /> </div>
                </div>
                <AnimatePresence> {isListOpen && (<motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden"> <div className="border-t border-[var(--c-border)] p-2 max-h-32 overflow-y-auto"> {sessionEntries.length > 0 ? (sessionEntries.map((entry) => (<motion.div key={entry.batteryId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between p-2 rounded-md"> <div className="flex items-center gap-3"> <BatteryFull className="text-[var(--c-success)]" size={18} /> <span className="font-mono text-sm text-[var(--c-text)]"> {entry.batteryId} </span> </div> <span className="text-xs text-[var(--c-text-alt)]"> {entry.timestamp} </span> </motion.div>))) : ( <p className="text-center text-xs text-[var(--c-text-alt)] p-4"> No items scanned yet. </p> )} </div> </motion.div>)} </AnimatePresence>
              </div>
              <button onClick={completeAndSave} className="w-full flex items-center justify-center gap-2 bg-[var(--c-success)] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 hover:opacity-90 mt-4 cursor-pointer">
                <CheckCircle size={18} /> Complete & Save Scan
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <AddItemModal isOpen={isAddItemModalOpen} onClose={() => setIsAddItemModalOpen(false)} onAdd={handleConfirmAddItem} />

      <Modal isOpen={!!lastScannedEntry} onClose={handleContinueScanning} title="Scan Successful">
        {lastScannedEntry && (<div className="text-center space-y-4"> <CheckCircle size={48} className="mx-auto text-[var(--c-success)]" /> <p className="text-md text-[var(--c-text-alt)]"> Successfully scanned battery: </p> <p className="font-mono text-xl font-bold p-3 bg-[var(--c-bg)] rounded-lg border border-[var(--c-border)]"> {lastScannedEntry.batteryId} </p> <div className="flex flex-col space-y-3 pt-2"> <button onClick={handleContinueScanning} className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3 rounded-xl transition-all active:scale-95 hover:opacity-90 cursor-pointer"> <ScanLine size={18} /> Continue Scanning </button> <button onClick={handleCompleteFromModal} className="w-full text-center bg-[var(--c-bg)] text-[var(--c-text)] font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-[var(--c-border)] hover:bg-[var(--c-border)] cursor-pointer"> <CheckCircle size={16} /> Complete Session </button> </div> </div>)}
      </Modal>

      <Modal isOpen={stage === "scanning" && showPermissionModal} hideCloseButton title="Camera Permission">
        <div className="text-center"> <p className="text-md text-[var(--c-text-alt)] mb-6"> This app needs access to your camera to scan QR codes. </p> <button onClick={handleAllowCamera} className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3 rounded-xl transition-all active:scale-95 hover:opacity-90 cursor-pointer"> Allow Camera Access </button> </div>
      </Modal>
    </motion.div>
  );
};

const HistoryLogSummary: FC<{ session: ScanSession }> = ({ session }) => {
  const { triggerShare } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  const chargerItem = session.items?.find(
    (item) => item.name.toLowerCase() === "chargers"
  );

  return (
    <Card className="p-0 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
          <Calendar size={20} className="text-[var(--c-accent)] shrink-0" />
          <div>
            <p className="font-semibold text-base leading-tight">
              {new Date(session.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-sm text-[var(--c-text-alt)] leading-tight flex items-center gap-1.5">
              <Clock size={12} />
              {session.timestamp}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="font-mono text-sm flex items-center gap-1.5 justify-end">
              <BatteryFull size={14} /> {session.entries.length}
            </p>
            {chargerItem && (
              <p className="font-mono text-xs text-[var(--c-text-faint)] flex items-center gap-1.5 justify-end">
                <BatteryCharging size={12} /> {chargerItem.count}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              triggerShare(session);
            }}
            className="p-2 rounded-full hover:bg-[var(--c-border)] text-[var(--c-text-alt)]"
          >
            <Share2 size={16} />
          </button>
          <ChevronDown
            size={20}
            className={`text-[var(--c-text-alt)] transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-2 pt-0 border-t border-[var(--c-border)] mx-4 pb-4">
              <h4 className="text-xs font-semibold text-[var(--c-text-alt)] pt-3 pb-1 px-2">
                Inventory Counts
              </h4>
              {/* FIX 2: Check for `session.items` existence before trying to access `.length` or `.map` */}
              {session.items && session.items.length > 0 ? (
                session.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2 rounded-md bg-[var(--c-bg)] mb-1"
                  >
                    <div className="flex items-center gap-3">
                      <Boxes size={16} className="text-[var(--c-text-alt)]" />
                      <span className="font-medium text-sm">{item.name}</span>
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-[var(--c-text-alt)] p-2">
                  No inventory recorded.
                </p>
              )}
              <h4 className="text-xs font-semibold text-[var(--c-text-alt)] pt-3 pb-1 px-2">
                Scanned Batteries ({session.entries.length})
              </h4>
              {session.entries.length > 0 ? (
                session.entries.map((entry) => (
                  <div
                    key={entry.batteryId}
                    className="flex items-center justify-between p-2 rounded-md bg-[var(--c-bg)]"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronsRight
                        size={16}
                        className="text-[var(--c-text-alt)]"
                      />
                      <span className="font-mono text-sm">
                        {entry.batteryId}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--c-text-alt)]">
                      {entry.timestamp}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-[var(--c-text-alt)] p-2">
                  No batteries in this session.
                </p>
              )}
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
    if (!Array.isArray(stationHistory)) return [];
    return stationHistory.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [scannedData, profile.stationId]);
  if (!profile.stationId) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center flex-grow">
        <Card className="p-8">
          <User size={48} className="mx-auto text-[var(--c-accent)]" />
          <h2 className="text-xl font-bold mt-4">Profile Not Set</h2>
          <p className="text-md text-[var(--c-text-alt)] mt-2">
            Go to the Profile tab to select your station.
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-extrabold flex items-center gap-3">
        <History size={24} /> Scan Session History
      </h2>
      {sortedHistory.length > 0 ? (
        sortedHistory.map((session, index) => (
          <HistoryLogSummary key={`${session.date}-${index}`} session={session} />
        ))
      ) : (
        <div className="text-center py-16 text-[var(--c-text-alt)]">
          <History size={40} className="mx-auto mb-4" />
          <p className="font-semibold">No scan sessions recorded.</p>
          <p className="text-sm">Tap 'Scan' to begin.</p>
        </div>
      )}
    </div>
  );
};

const MainView: FC = () => {
  const { profile, scannedData, setActiveView } = useAppContext();
  const { chargers, batteries } = useMemo(() => {
    const stationHistory = scannedData[profile.stationId] || [];
    if (!Array.isArray(stationHistory) || stationHistory.length === 0)
      return { chargers: 0, batteries: 0 };
    
    const latestSession = [...stationHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    
    const allEntries = stationHistory.flatMap((session) => session.entries);
    
    const chargerItem = latestSession?.items?.find(item => item.name.toLowerCase() === 'chargers');

    return {
      chargers: chargerItem?.count ?? 0,
      batteries: new Set(allEntries.map((e) => e.batteryId)).size,
    };
  }, [scannedData, profile.stationId]);

  if (!profile.stationId) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center flex-grow">
        <Card className="p-8 max-w-sm">
          <User size={48} className="mx-auto text-[var(--c-accent)]" />
          <h2 className="text-xl font-bold mt-4">Welcome to {APP_NAME}!</h2>
          <p className="text-md text-[var(--c-text-alt)] mt-2 mb-6">
            To get started, please set up your station profile.
          </p>
          <button
            onClick={() => setActiveView("profile")}
            className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3 rounded-xl transition-all active:scale-95 hover:opacity-90 cursor-pointer"
          >
            Go to Profile <ChevronsRight size={18} />
          </button>
        </Card>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-[var(--c-text-alt)] flex items-center gap-2">
            <BatteryCharging size={16} /> Chargers
          </h3>
          <p className="text-3xl font-bold mt-1">{chargers}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-[var(--c-text-alt)] flex items-center gap-2">
            <BatteryFull size={16} /> Unique Batteries
          </h3>
          <p className="text-3xl font-bold mt-1">{batteries}</p>
        </Card>
      </div>
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-3">
          <LayoutGrid size={20} /> Quick Access
        </h2>
        <Card className="p-4 text-center text-[var(--c-text-alt)]">
          <p>More dashboard widgets coming soon! 🚀</p>
        </Card>
      </div>
    </div>
  );
};

const ProfileView: FC = () => {
  const {
    profile,
    updateProfile,
    setActiveView,
    showToast,
    theme,
    toggleTheme,
  } = useAppContext();
  const [localProfile, setLocalProfile] = useState<Profile>(profile);
  const handleSave = () => {
    if (!localProfile.stationName || !localProfile.stationId) {
      showToast("Please select a station from the preset list.", "error");
      return;
    }
    updateProfile(localProfile);
    showToast("Profile updated successfully!", "success");
    setActiveView("main");
  };
  return (
    <div className="p-4 space-y-6 flex-grow">
      <h2 className="text-2xl font-extrabold flex items-center gap-3">
        <User size={24} /> Station Profile
      </h2>
      <Card className="p-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-[var(--c-text-alt)] mb-1 block">
            Select Your Station
          </label>
          <CustomDropdown
            options={STATIONS_DATA}
            selected={localProfile}
            onSelect={(s) => setLocalProfile({ ...localProfile, ...s })}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--c-text-alt)]">
            Station Name
          </label>
          <input
            type="text"
            value={localProfile.stationName}
            disabled
            className="mt-1 w-full p-3 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg outline-none opacity-60"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--c-text-alt)]">
            Station ID
          </label>
          <input
            type="text"
            value={localProfile.stationId}
            disabled
            className="mt-1 w-full p-3 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-lg outline-none opacity-60"
          />
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "light" ? (
              <Sun className="text-[var(--c-text-alt)]" />
            ) : (
              <Moon className="text-[var(--c-text-alt)]" />
            )}
            <span className="font-medium">Appearance</span>
          </div>
          <button
            onClick={toggleTheme}
            className="font-semibold text-sm text-[var(--c-accent)] bg-[var(--c-accent-glow)] py-1.5 px-3 rounded-md cursor-pointer"
          >
            Switch to {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </Card>
      <button
        onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 bg-[var(--c-accent)] text-[var(--c-accent-text)] font-bold py-3.5 rounded-xl transition-all active:scale-95 hover:opacity-90 cursor-pointer"
      >
        <Save size={18} /> Save Profile
      </button>
    </div>
  );
};

const App: FC = () => {
  const [theme, setTheme] = useState<Theme>("light");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    stationId: "",
    stationName: "",
  });
  const [scannedData, setScannedData] = useState<ScannedData>({});
  const [activeView, setActiveView] = useState<ActiveView>("main");
  const [sharePayload, setSharePayload] = useState<SharePayload>(null);
  useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem("app-theme") as Theme;
    if (savedTheme) setTheme(savedTheme);
    try {
      const savedProfile = localStorage.getItem("app-profile");
      if (savedProfile) setProfile(JSON.parse(savedProfile));
    } catch (error) {
      localStorage.removeItem("app-profile");
    }
    try {
      const savedData = localStorage.getItem("scanned-data");
      if (savedData) setScannedData(JSON.parse(savedData));
    } catch (error) {
      localStorage.removeItem("scanned-data");
    }
  }, []);
  useEffect(() => {
    if (isMounted) document.documentElement.className = theme;
  }, [theme, isMounted]);
  const toggleTheme = useCallback(() => {
    setTheme((p) => {
      const newTheme = p === "light" ? "dark" : "light";
      localStorage.setItem("app-theme", newTheme);
      return newTheme;
    });
  }, []);
  const updateProfile = useCallback((newProfile: Profile) => {
    setProfile(newProfile);
    localStorage.setItem("app-profile", JSON.stringify(newProfile));
  }, []);
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToasts((p) => [...p, { id: Date.now() + Math.random(), message, type }]);
  }, []);
  const commitSessionToHistory = useCallback(
    (session: ScanSession) => {
      if (!profile.stationId) {
        showToast("Cannot save, profile not set.", "error");
        return;
      }
      setScannedData((prevData) => {
        const stationHistory = prevData[profile.stationId] || [];
        const newHistory = [
          session,
          ...(Array.isArray(stationHistory) ? stationHistory : []),
        ];
        const newData = { ...prevData, [profile.stationId]: newHistory };
        localStorage.setItem("scanned-data", JSON.stringify(newData));
        return newData;
      });
    },
    [profile.stationId, showToast]
  );
  const triggerShare = useCallback(
    (payload: SharePayload) => setSharePayload(payload),
    []
  );
  const dismissToast = useCallback(
    (id: number) => setToasts((p) => p.filter((t) => t.id !== id)),
    []
  );
  if (!isMounted) return <div style={{ visibility: "hidden" }} />;
  const appContextValue: AppContextType = {
    theme,
    toggleTheme,
    profile,
    updateProfile,
    showToast,
    scannedData,
    commitSessionToHistory,
    activeView,
    setActiveView,
    triggerShare,
  };
  const views: Record<ActiveView, React.ReactNode> = {
    main: <MainView />,
    history: <HistoryView />,
    profile: <ProfileView />,
  };
  return (
    <AppContext.Provider value={appContextValue}>
      <link rel="stylesheet" href={FONT_URL} />
      <GlobalStyles />
      <div className="flex flex-col h-screen antialiased max-w-md mx-auto bg-[var(--c-bg)] border-x border-[var(--c-border)]">
        <Header />
        <main className="flex-grow overflow-y-auto pb-24 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex-grow flex flex-col"
            >
              {views[activeView]}
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <ShareModal
          payload={sharePayload}
          onClose={() => setSharePayload(null)}
        />
      </div>
    </AppContext.Provider>
  );
};

export default App;