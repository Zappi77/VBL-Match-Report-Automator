import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { getMatchReport, matchCache } from "./services/geminiService";
import { SEASON_MATCHES, KNOWN_TEAMS } from "./data/vblData";
import { Loader2, Copy, Check, Volleyball, Search, ExternalLink, Code, RefreshCw, Youtube, FileText, Layout, Info, AlertCircle, Database, Users, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "./lib/utils";
import ReactMarkdown from "react-markdown";
import { auth } from "./firebase";
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
                {JSON.stringify(this.state.error, null, 2)}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [copied, setCopied] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const ADMIN_EMAIL = "knud.zabrocki@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL && user?.emailVerified;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

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
    const isKnown = !!SEASON_MATCHES[matchNumber];
    setLogs([isKnown ? "Direktzugriff auf VBL-Daten (Match-ID bekannt)..." : "Initialisiere Suche..."]);
    setError("");
    setReport("");

    // Timeout mechanism
    let isRequestActive = true;
    const timeoutId = setTimeout(() => {
      if (isRequestActive) {
        setLoading(false);
        setError("Die Suche dauert ungewöhnlich lange (über 5 Minuten). Das liegt meist an der Komplexität der Google-Suche oder der VBL-Webseite. Bitte versuche es erneut oder prüfe die Internetverbindung.");
      }
    }, 300000); // 300 seconds timeout

    try {
      let result = await getMatchReport(matchNumber, (newStatus) => {
        setLogs(prev => {
          if (prev[prev.length - 1] === newStatus) return prev;
          return [...prev, newStatus];
        });
      }, forceRefresh);
      
      isRequestActive = false;
      clearTimeout(timeoutId);
      setForceRefresh(false);
      if (result) {
        // Clean up markdown code blocks if present
        result = result.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "").trim();
        setReport(result);
      } else {
        setError("Keine Daten gefunden. Bitte überprüfe die Spielnummer.");
      }
    } catch (err: any) {
      isRequestActive = false;
      clearTimeout(timeoutId);
      console.error(err);
      
      // Check if it's a Firestore error (JSON string)
      try {
        const firestoreError = JSON.parse(err.message);
        if (firestoreError.error && firestoreError.error.includes("insufficient permissions")) {
          setError(`Berechtigungsfehler: Du bist zwar angemeldet (${firestoreError.authInfo.email}), aber hast keine Schreibrechte für diesen Pfad (${firestoreError.path}).`);
        } else {
          setError(`Firestore Fehler: ${firestoreError.error}`);
        }
      } catch (e) {
        setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
      }
      
      // Clear cache on error to allow retry
      delete matchCache[matchNumber];
    } finally {
      setLoading(false);
    }
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
            <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]">Master-Datenbank</h2>
              <p className="text-[10px] text-[#5A5A40]/60">Hinterlegte Match-IDs für 2025/26</p>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-2">
            {Object.keys(SEASON_MATCHES).sort().map(num => (
              <button 
                key={num} 
                onClick={() => setMatchNumber(num)}
                disabled={loading}
                className="bg-white/80 p-2 rounded-xl text-center border border-black/5 hover:border-[#5A5A40]/30 hover:bg-white transition-all cursor-pointer group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title={`${SEASON_MATCHES[num].homeTeam} vs. ${SEASON_MATCHES[num].awayTeam}`}
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
                  href={`https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml?c.teamId=${id}&c.view=teamMain#samsCmsComponent_766577326`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white/80 p-3 rounded-xl border border-black/5 hover:border-[#5A5A40]/30 hover:bg-white transition-all flex items-center justify-between group"
                >
                  <span className="text-[10px] font-bold text-[#5A5A40] truncate pr-2">{name}</span>
                  <ExternalLink className="w-3 h-3 text-[#5A5A40]/30 group-hover:text-[#5A5A40] transition-colors flex-shrink-0" />
                </a>
              ))}
          </div>
        </section>

        {/* Form Section */}
        <section className="bg-white p-8 rounded-[32px] shadow-sm border border-black/5 mb-8">
          <form onSubmit={handleGenerate} className="space-y-6">
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
                <p className="mt-2 text-[10px] text-[#5A5A40]/50 italic">
                  Die KI durchsucht live die VBL-Webseite und Google. Dies kann bis zu 2 Minuten dauern.
                  {isAdmin && <span className="block text-green-600 font-bold mt-1">✓ Admin-Modus aktiv: Neue Daten werden automatisch in der Master-Datenbank gespeichert.</span>}
                </p>
                <div className="flex gap-2 mt-4">
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
              </div>
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

        {/* Result Section */}
        {report && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
