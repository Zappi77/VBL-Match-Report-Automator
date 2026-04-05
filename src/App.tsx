import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { fetchMatchDataFull, saveMatchData, getMatchReport, matchCache, buildReport, saveReport, deleteMatchEntry } from "./services/geminiService";
import { SEASON_MATCHES, KNOWN_TEAMS, type MatchReference } from "./data/vblData";
import { Loader2, Copy, Check, Volleyball, Search, ExternalLink, Code, RefreshCw, Youtube, FileText, Layout, Info, AlertCircle, Database, Users, LogIn, LogOut, ShieldCheck, Save, Edit3, X } from "lucide-react";
import { cn } from "./lib/utils";
import ReactMarkdown from "react-markdown";
import { auth, db } from "./firebase";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, getDocs, getDocFromServer } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-red-100 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-600 mb-2">Etwas ist schiefgelaufen</h2>
            <p className="text-sm text-gray-600 mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#5A5A40] text-white py-3 px-6 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all"
            >
              Seite neu laden
            </button>
            {this.state.error && (
              <pre className="mt-6 p-4 bg-gray-50 rounded-xl text-[10px] text-left overflow-auto max-h-40 text-gray-400">
                {typeof this.state.error === 'string' ? this.state.error : JSON.stringify(this.state.error, null, 2)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore connection error: The client is offline. Please check your configuration.");
    }
  }
}
testConnection();

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [matchNumber, setMatchNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [report, setReport] = useState("");
  const [previewData, setPreviewData] = useState<MatchReference | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [manualMatchId, setManualMatchId] = useState("");
  const [deleteMatchNumber, setDeleteMatchNumber] = useState("");
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [dbMatchNumbers, setDbMatchNumbers] = useState<string[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);

  const ADMIN_EMAIL = "knud.zabrocki@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    
    const q = query(collection(db, "matches"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const numbers = snapshot.docs.map(doc => doc.id);
      console.log(`Loaded ${numbers.length} matches from Firestore:`, numbers);
      setDbMatchNumbers(numbers);
      setIsDbLoading(false);
    }, (err) => {
      console.error("Error fetching matches from DB:", err);
      // Fallback: If snapshot fails, try a one-time getDocs
      getDocs(q).then(snap => {
        setDbMatchNumbers(snap.docs.map(d => d.id));
        setIsDbLoading(false);
      }).catch(e => {
        console.error("Fallback getDocs failed:", e);
        setIsDbLoading(false);
      });
    });
    
    return () => unsubscribe();
  }, [isAuthReady, user]); // Add user to dependencies to restart listener on auth change

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
      setError("Login fehlgeschlagen. Bitte versuche es erneut.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setForceRefresh(true);
    // Clear the in-memory cache
    Object.keys(matchCache).forEach(key => delete matchCache[key]);
    
    // Reset UI state
    setReport("");
    setLogs(["Cache geleert. Nächste Generierung erfolgt live..."]);
    setError("");
    
    // Visual feedback delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchNumber) return;

    setLoading(true);
    setElapsedTime(0);
    const isKnown = !!SEASON_MATCHES[matchNumber] || dbMatchNumbers.includes(matchNumber);
    setLogs([isKnown ? "Direktzugriff auf Master-Datenbank (Spiel bekannt)..." : "Initialisiere Suche..."]);
    setError("");
    setReport("");
    setPreviewData(null);
    setSaveSuccess(false);

    // Timeout mechanism
    let isRequestActive = true;
    const timeoutId = setTimeout(() => {
      if (isRequestActive) {
        setLoading(false);
        setError("Die Suche dauert zu lange (über 3 Minuten). Bitte versuche es erneut oder wähle eine Mannschaft aus, um die Suche zu beschleunigen.");
      }
    }, 180000); // 180 seconds timeout

    try {
      const data = await fetchMatchDataFull(matchNumber, (newStatus) => {
        setLogs(prev => {
          if (prev[prev.length - 1] === newStatus) return prev;
          return [...prev, newStatus];
        });
      }, forceRefresh, selectedTeamId, manualMatchId);
      
      isRequestActive = false;
      clearTimeout(timeoutId);
      setForceRefresh(false);
      
      if (data) {
        setPreviewData(data);
        
        // Wenn Daten aus DB kommen und KEIN Admin-Modus: Direkt Bericht bauen
        if (data.fromDb && !isAdmin) {
          setLogs(prev => [...prev, "Daten aus Master-Datenbank geladen. Überspringe Validierung..."]);
          const result = buildReport(data as any, matchNumber);
          const cleanReport = result.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
          setReport(cleanReport);
          
          setTimeout(() => {
            document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      } else {
        setError("Keine Daten gefunden. Bitte überprüfe die Spielnummer.");
      }
    } catch (err: any) {
      isRequestActive = false;
      clearTimeout(timeoutId);
      console.error(err);
      setError(err.message || "Ein Fehler ist aufgetreten.");
      delete matchCache[matchNumber];
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndBuild = async () => {
    if (!previewData) return;
    setIsSaving(true);
    setError("");

    try {
      // 1. Bericht generieren (lokal aus validierten Daten)
      const result = buildReport(previewData as any, matchNumber);
      const cleanReport = result.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
      setReport(cleanReport);

      // 2. Speichern in Firestore (falls Admin)
      if (isAdmin) {
        await saveMatchData(matchNumber, previewData);
        await saveReport(matchNumber, cleanReport);
        setSaveSuccess(true);
        setLogs(prev => [...prev, "✅ Daten erfolgreich in Master-Datenbank gespeichert."]);
      }
      
      // Scroll to result
      setTimeout(() => {
        document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" });
      }, 100);

    } catch (err: any) {
      console.error(err);
      setError("Fehler beim Speichern: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    const targetNumber = deleteMatchNumber || matchNumber;
    if (!isAdmin || !targetNumber) return;
    
    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
      setTimeout(() => setIsDeleteConfirming(false), 3000); // Reset after 3 seconds
      return;
    }
    
    setLoading(true);
    setLogs([`Lösche Spiel #${targetNumber}...`]);
    try {
      await deleteMatchEntry(targetNumber);
      setLogs(prev => [...prev, `✅ Spiel #${targetNumber} erfolgreich gelöscht.`]);
      setDeleteMatchNumber("");
      setIsDeleteConfirming(false);
    } catch (err: any) {
      setError("Fehler beim Löschen: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePreviewField = (field: keyof MatchReference, value: string) => {
    if (!previewData) return;
    setPreviewData({ ...previewData, [field]: value });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyAsHtml = () => {
    // Basic conversion of markdown links to HTML for WordPress
    const html = report
      .split("\n\n") // Split by double line breaks for paragraphs
      .map(paragraph => {
        // Replace [Text](Link) with <a href="Link" target="_blank" rel="noopener noreferrer">Text</a>
        let processed = paragraph.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        // Replace single line breaks within paragraph with <br>
        processed = processed.replace(/\n/g, "<br>\n");
        return `<p>${processed}</p>`;
      })
      .join("\n");
    
    navigator.clipboard.writeText(html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  // Timer effect
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-12 border-b border-[#141414] pb-6">
          <div className="flex justify-between items-start mb-4">
            <a 
              href="https://www.volleyball-bundesliga.de/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity group w-fit"
            >
              <Volleyball className="w-8 h-8 text-[#5A5A40] group-hover:rotate-12 transition-transform" />
              <h1 className="text-3xl font-serif italic font-bold tracking-tight">
                VBL Match Report Automator
              </h1>
              <ExternalLink className="w-4 h-4 text-[#5A5A40]/40" />
            </a>

            {isAuthReady && (
              <div className="flex items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-3 bg-white/50 backdrop-blur-sm py-1.5 px-3 rounded-full border border-black/5">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-[#5A5A40] leading-tight">{user.displayName}</span>
                      {isAdmin && (
                        <span className="text-[8px] text-green-600 font-bold uppercase tracking-tighter flex items-center gap-0.5">
                          <ShieldCheck className="w-2 h-2" /> Admin Mode
                        </span>
                      )}
                    </div>
                    {user.photoURL && (
                      <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full border border-black/10" referrerPolicy="no-referrer" />
                    )}
                    <button 
                      onClick={handleLogout}
                      className="text-[#5A5A40]/40 hover:text-red-500 transition-colors"
                      title="Abmelden"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleLogin}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] hover:text-[#141414] transition-colors bg-white/50 py-2 px-4 rounded-full border border-black/5"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Admin Login</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-[#5A5A40] uppercase tracking-widest font-semibold">
              DSHS SnowTrex Köln Pressewart Tool
            </p>
            <p className="text-xs text-[#5A5A40]/60 font-medium">
              Sparda 2. Liga Pro | Saison 2025/26
            </p>
          </div>
        </header>

        {/* User Guide / Bedienungsanleitung */}
        <section className="bg-white/50 backdrop-blur-sm p-8 rounded-[32px] border border-black/5 mb-8 space-y-4">
          <h2 className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]">Bedienungsanleitung</h2>
          <div className="grid md:grid-cols-3 gap-6 text-xs text-[#141414]/70 leading-relaxed">
            <div className="space-y-2">
              <span className="font-bold text-[#5A5A40]">1. Spielnummer finden</span>
              <p>Suche auf der <a href="https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro.xhtml" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#5A5A40] decoration-[#5A5A40]/30">VBL-Webseite</a> die Spielnummer (z.B. 3150) für die Saison 2025/26 der 2. Liga Pro.</p>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-[#5A5A40]">2. Bericht generieren</span>
              <p>Gib die Nummer unten ein. Die KI sucht nun nach Spieldaten, MVPs und dem passenden YouTube-Video.</p>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-[#5A5A40]">3. Exportieren</span>
              <p>Kopiere den fertigen Bericht als Markdown oder nutze den "Gutenberg HTML" Button für WordPress.</p>
            </div>
          </div>
        </section>

        {/* Database Info Section */}
        <section className="bg-white/50 backdrop-blur-sm p-8 rounded-[32px] border border-black/5 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]">Master-Datenbank</h2>
                  <p className="text-[10px] text-[#5A5A40]/60">Hinterlegte Match-IDs für 2025/26</p>
                </div>
              </div>
              <button 
                onClick={async () => {
                  setIsDbLoading(true);
                  const q = query(collection(db, "matches"));
                  const snap = await getDocs(q);
                  setDbMatchNumbers(snap.docs.map(d => d.id));
                  setIsDbLoading(false);
                }}
                className={cn(
                  "p-2 hover:bg-[#5A5A40]/10 rounded-full text-[#5A5A40]/40 hover:text-[#5A5A40] transition-colors",
                  isDbLoading && "animate-spin"
                )}
                title="Datenbank aktualisieren"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-2">
            {Array.from(new Set([...Object.keys(SEASON_MATCHES), ...dbMatchNumbers]))
              .sort((a, b) => Number(a) - Number(b))
              .map(num => (
                <button 
                  key={num}
                  onClick={() => setMatchNumber(num)}
                  disabled={loading}
                  className={cn(
                    "bg-white/80 p-2 rounded-xl text-center border transition-all cursor-pointer group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                    matchNumber === num ? "border-[#5A5A40] bg-white ring-2 ring-[#5A5A40]/20" : "border-black/5 hover:border-[#5A5A40]/30 hover:bg-white"
                  )}
                  title={SEASON_MATCHES[num] ? `${SEASON_MATCHES[num].homeTeam} vs. ${SEASON_MATCHES[num].awayTeam}` : `Spiel #${num} (aus Datenbank)`}
                >
                  <span className="block text-[10px] font-bold text-[#5A5A40]">#{num}</span>
                </button>
              ))}
          </div>
          <p className="mt-4 text-[9px] text-[#5A5A40]/40 italic text-center">
            Die Datenbank wird kontinuierlich erweitert. Fehlende Spiele werden live via Google & VBL-Suche ermittelt.
          </p>
        </section>

        {/* Team Links Section */}
        <section className="bg-white/50 backdrop-blur-sm p-8 rounded-[32px] border border-black/5 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]">Mannschaften</h2>
              <p className="text-[10px] text-[#5A5A40]/60">Sparda 2. Liga Pro Links</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(KNOWN_TEAMS)
              // Filter to show each teamId only once (taking the first name found)
              .filter((entry, index, self) => 
                index === self.findIndex((t) => t[1] === entry[1])
              )
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([name, id]) => (
                <a 
                  key={id} 
                  href={TEAM_URL(id)}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white/80 p-3 rounded-xl border border-black/5 hover:border-[#5A5A40]/30 hover:bg-white transition-all flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1 border border-black/5 flex-shrink-0">
                    <img 
                      src={TEAM_LOGO_URL(id)} 
                      alt={name} 
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=5A5A40&color=fff&size=64`;
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#5A5A40] truncate pr-2 flex-grow">{name}</span>
                  <ExternalLink className="w-3 h-3 text-[#5A5A40]/30 group-hover:text-[#5A5A40] transition-colors flex-shrink-0" />
                </a>
              ))}
          </div>
        </section>

        {/* Form Section */}
        <section className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 mb-8">
          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label 
                  htmlFor="matchNumber" 
                  className="block text-xs uppercase tracking-widest font-bold text-[#5A5A40] mb-2"
                >
                  Spielnummer (z.B. 3137)
                </label>
                <div className="relative">
                  <input
                    id="matchNumber"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={matchNumber}
                    onChange={(e) => setMatchNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="3137"
                    disabled={loading}
                    autoFocus
                    className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 text-xl font-mono focus:ring-2 focus:ring-[#5A5A40] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                  />
                  {matchNumber && !loading && (
                    <button
                      type="button"
                      onClick={() => setMatchNumber("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40 hover:text-[#5A5A40] transition-colors"
                      title="Eingabe löschen"
                    >
                      <AlertCircle className="w-5 h-5 rotate-45" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label 
                  htmlFor="teamSelect" 
                  className="block text-xs uppercase tracking-widest font-bold text-[#5A5A40] mb-2"
                >
                  Beteiligte Mannschaft (Optional)
                </label>
                <select
                  id="teamSelect"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#F5F5F0] border-none rounded-2xl py-4 px-6 text-sm font-bold text-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
                >
                  <option value="">-- Mannschaft wählen (für schnellere Suche) --</option>
                  {Object.entries(KNOWN_TEAMS)
                    .filter((entry, index, self) => 
                      index === self.findIndex((t) => t[1] === entry[1])
                    )
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([name, id]) => (
                      <option key={id} value={id}>{name}</option>
                    ))
                  }
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label 
                htmlFor="manualMatchId" 
                className="block text-xs uppercase tracking-widest font-bold text-[#5A5A40] mb-2"
              >
                Manuelle Match-ID (Optional)
              </label>
              <div className="relative">
                <input
                  id="manualMatchId"
                  type="text"
                  value={manualMatchId}
                  onChange={(e) => setManualMatchId(e.target.value.replace(/\D/g, ''))}
                  placeholder="z.B. 777353472"
                  disabled={loading}
                  className="w-full bg-[#F5F5F0] border-none rounded-2xl py-3 px-6 text-sm font-mono focus:ring-2 focus:ring-[#5A5A40] transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                />
                <Database className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5A40]/40" />
              </div>
              <p className="mt-2 text-[10px] text-[#5A5A40]/40 italic">
                Falls die Suche fehlschlägt: Die Match-ID findest du auf der VBL-Seite unter "i" (Info) in der URL (matchId=...).
              </p>
            </div>

            <div className="relative">
              <p className="text-[10px] text-[#5A5A40]/50 italic mb-4">
                Die KI durchsucht live die VBL-Webseite. Falls das Spiel neu ist, hilft die Auswahl einer Mannschaft, um die Match-ID sofort zu finden.
                {isAdmin && <span className="block text-green-600 font-bold mt-1">✓ Admin-Modus aktiv: Neue Daten werden automatisch in der Master-Datenbank gespeichert.</span>}
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !matchNumber}
                  className={cn(
                    "flex-1 py-4 px-6 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all",
                    loading || !matchNumber
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#5A5A40] text-white hover:bg-[#4A4A30] active:scale-95"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Suche...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>Bericht Erstellen</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className={cn(
                    "px-6 rounded-2xl border-2 border-[#5A5A40]/20 text-[#5A5A40] hover:bg-[#5A5A40]/5 transition-all flex items-center justify-center relative",
                    isRefreshing && "bg-[#5A5A40]/10 border-[#5A5A40]/40"
                  )}
                  title="Cache leeren & neu laden"
                >
                  <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
                  {forceRefresh && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                  )}
                </button>
              </div>
              {forceRefresh && (
                <p className="mt-2 text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Modus: Neugenerierung (Cache wird ignoriert)
                </p>
              )}
              {isAdmin && (
                <div className="flex flex-col gap-3 mt-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                  <div className="flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    Admin-Werkzeuge
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deleteMatchNumber}
                      onChange={(e) => setDeleteMatchNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="Spiel-Nr. löschen"
                      className="flex-1 bg-white border border-green-200 rounded-xl py-2 px-4 text-sm font-mono focus:ring-1 focus:ring-green-500 outline-none"
                    />
                    <button
                      onClick={handleDeleteEntry}
                      disabled={loading || (!deleteMatchNumber && !matchNumber)}
                      type="button"
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-50",
                        isDeleteConfirming 
                          ? "bg-red-600 text-white hover:bg-red-700 animate-pulse" 
                          : "bg-red-100 text-red-600 hover:bg-red-200"
                      )}
                    >
                      {isDeleteConfirming ? (
                        <>
                          <AlertCircle className="w-3 h-3" />
                          Sicher? (Klicken)
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          Löschen
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Status Indicator / Logs */}
          {loading && logs.length > 0 && (
            <div className="mt-6 bg-[#5A5A40]/5 p-6 rounded-2xl border border-[#5A5A40]/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-start gap-3">
                  <Loader2 className="w-5 h-5 text-[#5A5A40] animate-spin mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40]">Live-Protokoll (KI-Suche)</p>
                    <p className="text-sm font-medium italic text-[#5A5A40]">{logs[logs.length - 1]}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-[#5A5A40]">{elapsedTime}s</span>
                  <p className="text-[8px] text-[#5A5A40]/40 uppercase tracking-widest">Abgelaufen</p>
                </div>
              </div>
              
              <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                {logs.slice(0, -1).reverse().map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-[#5A5A40]/50 font-mono">
                    <Check className="w-3 h-3" />
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 mb-8 font-medium">
            {error}
          </div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <div className="bg-green-50 text-green-700 p-6 rounded-[32px] border-2 border-green-100 mb-8 flex items-center gap-4 animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Erfolgreich gespeichert!</h3>
              <p className="text-sm opacity-90">Das Spiel #{matchNumber} wurde in der Master-Datenbank aktualisiert und ist nun für alle Nutzer verfügbar.</p>
            </div>
          </div>
        )}

        {/* Validation Section (Human-in-the-loop) */}
        {previewData && !report && (
          <section className="bg-white p-8 rounded-[32px] shadow-lg border-2 border-[#5A5A40]/20 mb-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5A5A40] flex items-center justify-center text-white">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm uppercase tracking-widest font-bold text-[#5A5A40]">Daten-Validierung</h2>
                  <p className="text-[10px] text-[#5A5A40]/60">Bitte extrahierte Daten prüfen und ggf. korrigieren.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {previewData.matchId && (
                  <a 
                    href={`https://www.volleyball-bundesliga.de/popup/matchSeries/matchDetails.xhtml?matchId=${previewData.matchId}&hideHistoryBackButton=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] font-bold text-[#5A5A40] hover:underline bg-[#5A5A40]/5 py-1.5 px-3 rounded-full transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                    VBL Seite öffnen
                  </a>
                )}
                <button 
                  onClick={() => setPreviewData(null)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <ValidationField 
                label="Match-ID" 
                value={previewData.matchId} 
                onChange={(v) => updatePreviewField("matchId", v)} 
                warning={!previewData.matchId ? "Fehlt!" : undefined}
                link={previewData.matchId ? VBL_MATCH_URL(previewData.matchId) : undefined}
              />
              <ValidationField 
                label="SAMS Score UUID" 
                value={previewData.samsScoreUuid} 
                onChange={(v) => updatePreviewField("samsScoreUuid", v)} 
                link={previewData.samsScoreUuid ? SAMS_URL(previewData.samsScoreUuid, matchNumber) : undefined}
              />
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <ValidationField 
                  label="Heimteam" 
                  value={previewData.homeTeam} 
                  onChange={(v) => updatePreviewField("homeTeam", v)} 
                  link={previewData.homeTeamId ? TEAM_URL(previewData.homeTeamId) : undefined}
                  logo={previewData.homeTeamId ? TEAM_LOGO_URL(previewData.homeTeamId) : undefined}
                />
                <ValidationField 
                  label="Heimteam-ID" 
                  value={previewData.homeTeamId} 
                  onChange={(v) => updatePreviewField("homeTeamId", v)} 
                  link={previewData.homeTeamId ? TEAM_URL(previewData.homeTeamId) : undefined}
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <ValidationField 
                  label="Gastteam" 
                  value={previewData.awayTeam} 
                  onChange={(v) => updatePreviewField("awayTeam", v)} 
                  link={previewData.awayTeamId ? TEAM_URL(previewData.awayTeamId) : undefined}
                  logo={previewData.awayTeamId ? TEAM_LOGO_URL(previewData.awayTeamId) : undefined}
                />
                <ValidationField 
                  label="Gastteam-ID" 
                  value={previewData.awayTeamId} 
                  onChange={(v) => updatePreviewField("awayTeamId", v)} 
                  link={previewData.awayTeamId ? TEAM_URL(previewData.awayTeamId) : undefined}
                />
              </div>
              <ValidationField 
                label="Spielort" 
                value={previewData.venueName} 
                onChange={(v) => updatePreviewField("venueName", v)} 
              />
              <ValidationField 
                label="Location ID" 
                value={previewData.locationId} 
                onChange={(v) => updatePreviewField("locationId", v)} 
                link={previewData.locationId ? LOCATION_URL(previewData.locationId) : undefined}
              />
              <ValidationField 
                label="Zuschauer" 
                value={previewData.spectators} 
                onChange={(v) => updatePreviewField("spectators", v)} 
              />
              <ValidationField 
                label="Spielergebnis" 
                value={previewData.resultSets} 
                onChange={(v) => updatePreviewField("resultSets", v)} 
                placeholder="z.B. 3:0"
              />
              <ValidationField 
                label="Satz-Ergebnisse" 
                value={previewData.setPoints} 
                onChange={(v) => updatePreviewField("setPoints", v)} 
                placeholder="z.B. 25:12, 25:18, 25:15"
              />
              <ValidationField 
                label="Gesamtpunkte" 
                value={previewData.totalPoints} 
                onChange={(v) => updatePreviewField("totalPoints", v)} 
                placeholder="z.B. 75:45"
              />
              <ValidationField 
                label="Spieldauer" 
                value={previewData.matchDuration} 
                onChange={(v) => updatePreviewField("matchDuration", v)} 
                placeholder="z.B. 107 Min. (23, 27, 26, 31)"
              />
              <ValidationField 
                label="MVP Heim (Name)" 
                value={previewData.mvpHomeName} 
                onChange={(v) => updatePreviewField("mvpHomeName", v)} 
              />
              <ValidationField 
                label="MVP Heim (User-ID)" 
                value={previewData.mvpHomeUserId} 
                onChange={(v) => updatePreviewField("mvpHomeUserId", v)} 
                link={previewData.homeTeamId && previewData.mvpHomeUserId ? PLAYER_URL(previewData.homeTeamId, previewData.mvpHomeUserId) : undefined}
              />
              <ValidationField 
                label="MVP Gast (Name)" 
                value={previewData.mvpAwayName} 
                onChange={(v) => updatePreviewField("mvpAwayName", v)} 
              />
              <ValidationField 
                label="MVP Gast (User-ID)" 
                value={previewData.mvpAwayUserId} 
                onChange={(v) => updatePreviewField("mvpAwayUserId", v)} 
                link={previewData.awayTeamId && previewData.mvpAwayUserId ? PLAYER_URL(previewData.awayTeamId, previewData.mvpAwayUserId) : undefined}
              />
              <div className="md:col-span-2">
                <ValidationField 
                  label="YouTube URL" 
                  value={previewData.youtubeUrl} 
                  onChange={(v) => updatePreviewField("youtubeUrl", v)} 
                  link={previewData.youtubeUrl || undefined}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveAndBuild}
                disabled={isSaving}
                className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>{isAdmin ? "Daten speichern & Bericht erstellen" : "Bericht erstellen (ohne Speichern)"}</span>
              </button>
              {!isAdmin && (
                <p className="text-[10px] text-center text-[#5A5A40]/50 italic">
                  Hinweis: Du bist nicht als Admin angemeldet. Änderungen werden nur für diesen Bericht übernommen, aber nicht in der Datenbank gespeichert.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Result Section */}
        {report && (
          <div id="result-section" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap gap-4 justify-between items-center px-2">
              <h2 className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]">
                Vorschau & Export
              </h2>
              <div className="flex gap-4">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-[#5A5A40] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">Markdown Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Markdown</span>
                    </>
                  )}
                </button>
                <button
                  onClick={copyAsHtml}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-[#5A5A40] transition-colors"
                >
                  {copiedHtml ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">HTML Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Code className="w-4 h-4" />
                      <span>Gutenberg HTML</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Clickable Preview */}
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5">
              <div className="prose prose-sm max-w-none prose-a:text-[#5A5A40] prose-a:font-bold prose-a:no-underline hover:prose-a:underline">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                        {props.children}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ),
                    p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />
                  }}
                >
                  {report}
                </ReactMarkdown>
              </div>
            </div>

            <div className="bg-[#5A5A40]/5 p-6 rounded-2xl border border-[#5A5A40]/10">
              <p className="text-xs text-[#5A5A40] leading-relaxed italic">
                Tipp für Gutenberg: Nutze den "Gutenberg HTML" Button und füge den Inhalt in WordPress über einen "Individuelles HTML" Block ein.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!report && !loading && !error && (
          <div className="text-center py-20 opacity-30">
            <Volleyball className="w-16 h-16 mx-auto mb-4" />
            <p className="font-serif italic text-xl">Gib eine Spielnummer ein, um zu beginnen.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// URL Helpers for Validation
const VBL_MATCH_URL = (matchId: string) => `https://www.volleyball-bundesliga.de/popup/matchSeries/matchDetails.xhtml?matchId=${matchId}&hideHistoryBackButton=true`;
const STATS_URL = (matchNumber: string) => `https://live.volleyball-bundesliga.de/2025-26/Women/${matchNumber}.pdf`;
const SAMS_URL = (uuid: string, matchNumber: string) => `https://distributor.sams-score.de/scoresheet/pdf/${uuid}/${matchNumber}`;
const LOCATION_URL = (locationId: string) => `https://www.volleyball-bundesliga.de/popup/location/locationDetails.xhtml?locationId=${locationId}&showVolleyballFields=true`;
const TEAM_URL = (teamId: string) => `https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml?c.teamId=${teamId}&c.view=teamMain#samsCmsComponent_766577326`;
const TEAM_LOGO_URL = (teamId: string) => {
  const customLogos: Record<string, string> = {
    "776309795": "https://www.volleyball-bundesliga.de/uploads/89cb6afe-a0c8-4c30-a4c6-34cbe79176aa/TV_Waldgirmes_kreis.png",
    "776308933": "https://www.volleyball-bundesliga.de/uploads/bb11fe67-9f40-49ed-a42f-1e99316dadf9/Bayer+Leverkusen.png",
    "776308987": "https://www.volleyball-bundesliga.de/uploads/131fc503-06e0-4f69-a475-84adf278b0d9/BBSC+Berlin.png",
    "776308895": "https://www.volleyball-bundesliga.de/uploads/9d7057ef-e7c8-4d41-9c70-3efce1b653a3/DSHS+SnowTrex+K%C3%B6ln.png",
    "776311815": "https://www.volleyball-bundesliga.de/uploads/11eb6af6-6268-4767-8c60-813b6161d2fc/Eintracht+Spontent_Kreis.png",
    "776308803": "https://www.volleyball-bundesliga.de/uploads/e1c6edbd-64a5-4055-8f01-28c03e70f558/ESA+Grimma+Volleys_kreis.png",
    "776308823": "https://www.volleyball-bundesliga.de/uploads/825c2558-e734-45c0-a93d-261df75fb4c3/Straubing.png",
    "776309559": "https://www.volleyball-bundesliga.de/uploads/befce1b4-d568-4ffd-928a-d351be3301eb/Neuseenland-Volleys+Markkleeberg.png",
    "776309082": "https://www.volleyball-bundesliga.de/uploads/19de3821-7526-4e46-a0b9-9cd60bf0535e/Vilsbiburg.png",
    "776309386": "https://www.volleyball-bundesliga.de/uploads/edc53223-6279-497b-8f0c-a3b2bf93eed8/Sparkassen+Wildcats+Stralsund.png",
    "776309004": "https://www.volleyball-bundesliga.de/uploads/b87f5e38-7eb4-4966-84a1-be0e4839f151/TV+Dingolfing.png",
    "776309275": "https://www.volleyball-bundesliga.de/uploads/0a049112-a6b6-49b9-8e9d-38f09c907cb7/TV+H%C3%B6rde.png",
    "776309673": "https://www.volleyball-bundesliga.de/uploads/c44d2e47-3206-4312-ac8e-067faff3ac85/Planegg-Krailling_Kreis.png",
    "776309105": "https://www.volleyball-bundesliga.de/uploads/33ebca47-ee88-4505-80a3-8f625a651bdc/Dresden.png",
    "776308853": "https://www.volleyball-bundesliga.de/uploads/10c17d7b-d082-4d7d-a4e0-f1d800544ff8/oythe.png"
  };
  return customLogos[teamId] || `https://vbl-web.sams-server.de/public/team/logo/${teamId}`;
};
const PLAYER_URL = (teamId: string, userId: string) => `https://www.volleyball-bundesliga.de/popup/teamMember/teamMemberDetails.xhtml?teamId=${teamId}&userId=${userId}`;

function ValidationField({ label, value, onChange, warning, placeholder, link, logo }: { 
  label: string, 
  value: string | undefined, 
  onChange: (v: string) => void,
  warning?: string,
  placeholder?: string,
  link?: string,
  logo?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center px-1">
        <label className="text-[9px] uppercase tracking-tighter font-bold text-[#5A5A40]/60">{label}</label>
        <div className="flex items-center gap-2">
          {warning && <span className="text-[9px] font-bold text-red-500 animate-pulse">{warning}</span>}
          {link && value && (
            <a 
              href={link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[9px] font-bold text-[#5A5A40] hover:underline flex items-center gap-0.5 bg-[#5A5A40]/5 px-1.5 py-0.5 rounded"
            >
              <ExternalLink className="w-2 h-2" /> Link
            </a>
          )}
        </div>
      </div>
      <div className="relative group">
        <input 
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-[#F5F5F0] border-none rounded-xl py-2 px-3 text-xs font-medium focus:ring-1 focus:ring-[#5A5A40] outline-none transition-all",
            logo && "pl-10",
            warning && "bg-red-50 ring-1 ring-red-200"
          )}
        />
        {logo && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-lg border border-black/5 flex items-center justify-center p-0.5 pointer-events-none">
            <img 
              src={logo} 
              alt="" 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
