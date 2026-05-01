import React, { useState, useEffect, useRef } from 'react';
import { 
  Wrench, 
  MapPin, 
  Phone, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  User, 
  LogOut, 
  LayoutDashboard,
  MessageSquare,
  ChevronRight,
  Send,
  Loader2,
  Menu,
  X,
  History,
  ShieldCheck,
  CreditCard,
  Sun,
  Moon,
  ShoppingBag,
  Search,
  Filter,
  ShoppingCart,
  Star,
  ArrowRight,
  Activity,
  Zap,
  ChevronDown,
  ChevronLeft,
  Play,
  Quote,
  Trash2,
  Plus,
  Video,
  PhoneCall,
  Smartphone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Github,
  StickyNote
} from 'lucide-react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { ServiceRequest, UserProfile, UserRole, RequestStatus, Mechanic, ChatMessage, SparePart } from './types';
import { getChatResponse, SYSTEM_PROMPT } from './lib/gemini';
import { WhatsAppService } from './services/whatsappService';
import Markdown from 'react-markdown';

// --- Leaflet Map ---
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the whole app, but we log it clearly
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', size?: 'sm' | 'md' | 'lg', loading?: boolean }>(
  ({ className, variant = 'primary', size = 'md', loading, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
      secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
      ghost: 'bg-transparent text-slate-600 hover:bg-slate-100'
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg font-medium'
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn('rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden', className)}
  >
    {children}
  </div>
);

const StatusTracker = ({ status }: { status: RequestStatus }) => {
  const steps: { label: string, key: RequestStatus }[] = [
    { label: 'Dispatched', key: 'assigned' },
    { label: 'On the way', key: 'in-progress' },
    { label: 'Arrived', key: 'arrived' },
    { label: 'Completed', key: 'completed' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === status);
  
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
        {steps.map((step, i) => {
          const isActive = i <= currentStepIndex;
          const isCurrent = i === currentStepIndex;
          
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                isActive ? "bg-brand-600 text-white scale-110" : "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-400",
                isCurrent && "ring-4 ring-brand-500/20"
              )}>
                {isActive ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                isActive ? "text-brand-600" : "text-slate-400"
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MechanicProfile = ({ mechanicId, mechanics }: { mechanicId: string, mechanics: Mechanic[] }) => {
  const mechanic = mechanics.find(m => m.uid === mechanicId);
  if (!mechanic) return null;

  return (
    <div className="flex items-center gap-4 p-4 bg-brand-50 dark:bg-brand-900/10 rounded-2xl border border-brand-100 dark:border-brand-900/20">
      <div className="relative">
        <img 
          src={mechanic.photoUrl || `https://images.unsplash.com/photo-1615906659123-265b676994ad?auto=format&fit=crop&q=80&w=200`} 
          alt={mechanic.name}
          className="w-16 h-16 rounded-xl object-cover border-2 border-white dark:border-slate-800 shadow-sm"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1615906659123-265b676994ad?auto=format&fit=crop&q=80&w=200`;
          }}
        />
        <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-widest">Your Mechanic</p>
            <h4 className="font-bold text-slate-900 dark:text-white">{mechanic.name}</h4>
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg shadow-sm">
            <Star className="h-3 w-3 text-amber-500 fill-current" />
            <span className="text-xs font-bold">4.9</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <a href={`tel:${mechanic.phone}`} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
            <Phone className="h-3 w-3" /> {mechanic.phone}
          </a>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-500">Verified Professional</span>
        </div>
      </div>
    </div>
  );
};

// --- Auth Modal ---

function AuthModal({ isOpen, onClose, initialMode = 'login' }: { isOpen: boolean, onClose: () => void, initialMode?: 'login' | 'signup' }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  
  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode, isOpen]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address to reset password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Auto-admin logic for owner email
        const role = email.toLowerCase() === 'princegogoekine@gmail.com' ? 'admin' : 'customer';
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: email.toLowerCase(),
          displayName: email.split('@')[0],
          role: role,
          isPremium: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-100 dark:border-slate-800 scrollbar-hide"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                  <div className="bg-brand-600 p-2 rounded-xl">
                    <Wrench className="text-white h-5 w-5" />
                  </div>
                  <span className="font-black text-xl tracking-tighter uppercase italic">AutoBit Rescue</span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-8">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none">
                  {isLogin ? "Welcome" : "Join the"} <span className="text-brand-600">Rescue</span>
                </h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">
                  {isLogin ? "Sign in to manage your vehicle recovery." : "Create an account for faster emergency response."}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {resetSent && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-2xl text-green-600 dark:text-green-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Password reset link sent! Check your inbox.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                  <div className="relative">
                    <Input 
                      type="email" 
                      placeholder="name@example.com" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pl-12 h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl"
                      required
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password</label>
                    {isLogin && (
                      <button 
                        type="button"
                        onClick={handleResetPassword}
                        className="text-[10px] font-black uppercase tracking-widest text-brand-600 hover:underline cursor-pointer"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-12 pr-12 h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl"
                      required
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  loading={loading}
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-600/20"
                >
                  {isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                  <span className="bg-white dark:bg-slate-900 px-4 text-slate-400">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 w-full h-14 rounded-2xl border-2 border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold text-sm cursor-pointer"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                  Google Account
                </button>
              </div>

              <div className="mt-8 text-center text-xs font-bold text-slate-500">
                {isLogin ? "No account yet?" : "Already have an account?"}
                <button 
                  onClick={() => { setIsLogin(!isLogin); setResetSent(false); setError(null); }}
                  className="ml-2 text-brand-600 hover:underline cursor-pointer"
                >
                  {isLogin ? "Sign Up Free" : "Log In Now"}
                </button>
              </div>

              <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
                  Staff & Admin: Use your corporate credentials to access the command center.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'request' | 'history' | 'admin' | 'chat' | 'mechanics' | 'shop' | 'landing' | 'privacy' | 'terms' | 'premium' | 'settings' | 'map'>('landing');
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [currency, setCurrency] = useState({ symbol: '$', code: 'USD', rate: 1 });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    // Currency detection based on location (mocked for demo, but structure is there)
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        // In a real app, we'd use a reverse geocoding API here
        // For now, we'll default to NGN if in Nigeria (mocked) or USD
        setCurrency({ symbol: '₦', code: 'NGN', rate: 1500 }); // Example rate
      });
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Use onSnapshot for real-time profile updates
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'User',
              role: user.email === 'princegogoekine@gmail.com' ? 'admin' : 'customer',
              isOnline: false,
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
          setView(prev => (prev === 'landing' ? 'home' : prev));
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        setView(prev => {
          const publicViews = ['landing', 'request', 'shop', 'chat', 'privacy', 'terms'];
          return publicViews.includes(prev) ? prev : 'landing';
        });
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    if (!user || !profile) return;

    let q;
    if (profile.role === 'admin' || profile.role === 'staff') {
      q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    } else if (profile.role === 'mechanic') {
      q = query(
        collection(db, 'requests'), 
        where('mechanicId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'requests'), 
        where('customerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceRequest));
      setRequests(reqs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    // Fetch mechanics
    const mQuery = query(collection(db, 'mechanics'));
    const mUnsubscribe = onSnapshot(mQuery, (snapshot) => {
      const ms = snapshot.docs.map(doc => {
        const data = doc.data() as Mechanic;
        // Inject mock location if missing for demonstration purposes on the map
        if (!data.location) {
          return {
            ...data,
            uid: doc.id,
            location: {
              latitude: 4.8156 + (Math.random() - 0.5) * 0.05,
              longitude: 7.0498 + (Math.random() - 0.5) * 0.05
            }
          } as Mechanic;
        }
        return { uid: doc.id, ...data } as Mechanic;
      });
      setMechanics(ms);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'mechanics');
    });

    return () => {
      unsubscribe();
      mUnsubscribe();
    };
  }, [user, profile]);

  const handleLogin = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const handleSignUp = () => {
    setAuthModalMode('signup');
    setIsAuthModalOpen(true);
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(user ? 'home' : 'landing')}>
            <div className="bg-brand-600 p-2 rounded-lg">
              <Wrench className="text-white h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">AutoBit Rescue</span>
          </div>

            <div className="hidden md:flex items-center gap-6">
            {view === 'admin' || view === 'mechanics' ? (
              <>
                <button onClick={() => setView('admin')} className={cn("text-sm font-bold uppercase tracking-widest transition-colors", view === 'admin' ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>Dashboard</button>
                <button onClick={() => setView('mechanics')} className={cn("text-sm font-bold uppercase tracking-widest transition-colors", view === 'mechanics' ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>Team Management</button>
                <button onClick={() => setView('home')} className="text-sm font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Return to Service</button>
              </>
            ) : (
              <>
                <button onClick={() => setView(user ? 'home' : 'landing')} className={cn("text-sm font-medium transition-colors", (view === 'home' || view === 'landing') ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>Home</button>
                <button onClick={() => setView('request')} className={cn("text-sm font-medium transition-colors", view === 'request' ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>Request Service</button>
                <button onClick={() => setView('shop')} className={cn("text-sm font-medium transition-colors", view === 'shop' ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>Spare Parts</button>
                {user && (
                  <>
                    <button onClick={() => setView('history')} className={cn("text-sm font-medium transition-colors", view === 'history' ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>My Requests</button>
                    {(profile?.role === 'admin' || profile?.role === 'staff') && (
                      <button onClick={() => setView('admin')} className="text-sm font-bold uppercase tracking-widest bg-brand-600/10 text-brand-600 px-3 py-1 rounded-lg hover:bg-brand-600 hover:text-white transition-all flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Management
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => setView('map')} className={cn("text-sm font-medium transition-colors", view === 'map' ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>Live Map</button>
                <button onClick={() => setView('chat')} className={cn("text-sm font-medium transition-colors", view === 'chat' ? "text-brand-600" : "text-slate-600 dark:text-slate-400 hover:text-brand-600")}>AI Assistant</button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1 justify-end">
                    {user.displayName || user.email?.split('@')[0]}
                    {profile?.isPremium && <Star className="h-3 w-3 text-amber-500 fill-current" />}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{profile?.role}</p>
                </div>
                <button 
                  onClick={() => setView('settings')}
                  className={cn("p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors", view === 'settings' ? "text-brand-600 bg-slate-100 dark:bg-slate-800" : "text-slate-600 dark:text-slate-400")}
                  title="Settings"
                >
                  <User className="h-5 w-5" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button onClick={handleLogin} variant="ghost" size="sm" className="hidden sm:inline-flex rounded-xl font-bold">Sign In</Button>
                <Button onClick={handleSignUp} size="sm" className="rounded-xl font-black uppercase text-[10px] tracking-widest">Sign Up Free</Button>
              </div>
            )}
            <button 
              className="md:hidden p-2 text-slate-600 dark:text-slate-400"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-16 left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-40 p-4 flex flex-col gap-4 shadow-xl"
          >
            {view === 'admin' || view === 'mechanics' ? (
              <>
                <button onClick={() => { setView('admin'); setIsMenuOpen(false); }} className="text-left py-2 font-bold uppercase tracking-widest">Dashboard</button>
                <button onClick={() => { setView('mechanics'); setIsMenuOpen(false); }} className="text-left py-2 font-bold uppercase tracking-widest">Team Management</button>
                <button onClick={() => { setView('home'); setIsMenuOpen(false); }} className="text-left py-2 font-bold uppercase tracking-widest text-slate-400">Return to Service</button>
              </>
            ) : (
              <>
                <button onClick={() => { setView(user ? 'home' : 'landing'); setIsMenuOpen(false); }} className="text-left py-2 font-medium">Home</button>
                <button onClick={() => { setView('request'); setIsMenuOpen(false); }} className="text-left py-2 font-medium">Request Service</button>
                <button onClick={() => { setView('shop'); setIsMenuOpen(false); }} className="text-left py-2 font-medium">Spare Parts</button>
                <button onClick={() => { setView('map'); setIsMenuOpen(false); }} className="text-left py-2 font-medium">Live Map</button>
                {user && (
                  <>
                    <button onClick={() => { setView('settings'); setIsMenuOpen(false); }} className="text-left py-2 font-medium">Profile Settings</button>
                    <button onClick={() => { setView('history'); setIsMenuOpen(false); }} className="text-left py-2 font-medium">My Requests</button>
                    {(profile?.role === 'admin' || profile?.role === 'staff') && (
                      <button onClick={() => { setView('admin'); setIsMenuOpen(false); }} className="text-left py-2 font-bold text-brand-600 uppercase tracking-widest">Management</button>
                    )}
                  </>
                )}
                <button onClick={() => { setView('chat'); setIsMenuOpen(false); }} className="text-left py-2 font-medium">AI Assistant</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {view === 'landing' && <LandingPageView setView={setView} handleLogin={handleLogin} />}
        {view === 'home' && <HomeView setView={setView} user={user} handleLogin={handleLogin} currency={currency} profile={profile} />}
        {view === 'request' && <RequestFormView setView={setView} user={user} />}
        {view === 'history' && <HistoryView requests={requests} user={user} profile={profile} currency={currency} mechanics={mechanics} />}
        {view === 'map' && <PublicMapView requests={requests} mechanics={mechanics} />}
        {view === 'admin' && (
          (profile?.role === 'admin' || profile?.role === 'staff') 
            ? <StaffPortal requests={requests} mechanics={mechanics} currency={currency} profile={profile} />
            : <div className="max-w-md mx-auto py-20 text-center space-y-6">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="text-3xl font-black italic uppercase italic tracking-tighter">Access Restricted</h2>
                <p className="text-slate-500 font-medium">The Staff Command Center is only available to authorized personnel. Please sign in with your staff credentials or contact support if you believe this is an error.</p>
                <div className="flex justify-center gap-4 pt-4">
                  <Button onClick={() => setView('home')} variant="ghost">Back to Home</Button>
                  <Button onClick={handleLogin}>Staff Sign In</Button>
                </div>
              </div>
        )}
        {view === 'mechanics' && <MechanicManagementView mechanics={mechanics} />}
        {view === 'chat' && <AIChatView user={user} profile={profile} />}
        {view === 'settings' && <SettingsView profile={profile} />}
        {view === 'shop' && <SparePartsShopView currency={currency} isAdmin={profile?.role === 'admin'} />}
        {view === 'privacy' && <PrivacyView />}
        {view === 'terms' && <TermsView />}
        {view === 'premium' && <PremiumMembershipView user={user} profile={profile} handleLogin={handleLogin} currency={currency} />}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Wrench className="text-brand-600 h-5 w-5" />
            <span className="font-bold text-lg dark:text-white">AutoBit Rescue</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">© 2026 AutoBit Rescue. All rights reserved.</p>
          <div className="flex gap-6">
            <button onClick={() => setView('admin')} className="text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600">Staff Portal</button>
            <button onClick={() => setView('privacy')} className="text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600">Privacy</button>
            <button onClick={() => setView('terms')} className="text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600">Terms</button>
            <a href="#" className="text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600">Contact</a>
          </div>
        </div>
      </footer>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        initialMode={authModalMode}
      />
    </div>
  );
}

// --- View Components ---

function HomeView({ setView, user, handleLogin, currency, profile }: { setView: (v: any) => void, user: any, handleLogin: () => void, currency: any, profile: UserProfile | null }) {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden bg-slate-900 dark:bg-slate-950 py-20 px-8 text-center">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center" />
        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
          {profile?.isPremium && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold"
            >
              <Star className="h-4 w-4 fill-current" />
              Premium Member
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider"
          >
            <ShieldCheck className="h-3 w-3" />
            Trusted Roadside Assistance
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold text-white leading-tight"
          >
            Fast, Reliable Car Service <br />
            <span className="text-brand-500">When You Need It Most</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-400"
          >
            From emergency breakdowns to routine maintenance, our expert mechanics are just a click away. Real-time tracking, transparent pricing, and professional care.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Button 
              size="lg" 
              className="w-full sm:w-auto"
              onClick={() => setView('request')}
            >
              Request Service Now
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="danger" 
              size="lg" 
              className="w-full sm:w-auto"
              onClick={() => setView('request')}
            >
              <AlertTriangle className="mr-2 h-5 w-5" />
              Emergency Breakdown
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-8">
        {[
          { icon: Clock, title: "Rapid Response", desc: "Our dispatch system ensures the nearest mechanic reaches you in record time." },
          { icon: MapPin, title: "GPS Tracking", desc: "Auto-capture your breakdown location and track your mechanic in real-time." },
          { icon: CreditCard, title: "Secure Payments", desc: "Transparent pricing with secure online payment options for all services." }
        ].map((feature, i) => (
          <Card key={i} className="p-8 hover:border-brand-500/30 transition-colors group">
            <div className="bg-slate-50 p-4 rounded-2xl w-fit group-hover:bg-brand-50 transition-colors">
              <feature.icon className="h-8 w-8 text-brand-600" />
            </div>
            <h3 className="text-xl font-bold mt-6 mb-3">{feature.title}</h3>
            <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
          </Card>
        ))}
      </section>

      {/* Stats Section */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl font-bold text-brand-600">15m</p>
            <p className="text-sm text-slate-500 mt-1">Avg. ETA</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-brand-600">500+</p>
            <p className="text-sm text-slate-500 mt-1">Expert Mechanics</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-brand-600">50k+</p>
            <p className="text-sm text-slate-500 mt-1">Jobs Completed</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-brand-600">4.9/5</p>
            <p className="text-sm text-slate-500 mt-1">User Rating</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function RequestFormView({ setView, user }: { setView: (v: any) => void, user: any }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    make: '',
    model: '',
    year: '',
    phone: '',
    description: '',
    country: 'Nigeria',
    state: 'Rivers',
    address: '',
    isEmergency: false
  });

  const commonIssues = [
    "Engine won't start",
    "Flat tire / Wheel fix",
    "Battery jumpstart",
    "Brake failure / Noise",
    "Overheating / Steam",
    "Coolant Leakage"
  ];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => {
        console.warn("Geolocation denied", err);
      });
    }
  }, []);

  const totalSteps = user ? 3 : 4;

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }

    setLoading(true);
    try {
      const request: Omit<ServiceRequest, 'id'> = {
        customerId: user?.uid || `anon_${Math.random().toString(36).substr(2, 9)}`,
        customerName: user?.displayName || formData.name || 'Anonymous',
        customerPhone: formData.phone,
        carDetails: {
          make: formData.make,
          model: formData.model,
          year: formData.year
        },
        description: formData.description,
        location: {
          latitude: location?.lat || (4.8156 + (Math.random() - 0.5) * 0.05),
          longitude: location?.lng || (7.0498 + (Math.random() - 0.5) * 0.05),
          address: formData.address,
          state: formData.state,
          country: formData.country
        },
        status: 'pending',
        isEmergency: formData.isEmergency,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'requests'), request);
      
      if (user) {
        setView('history');
      } else {
        alert("Request submitted successfully! A mechanic will contact you shortly. Sign in to track your request in real-time.");
        setView('landing');
      }
    } catch (error) {
      console.error("Request failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <button 
            onClick={() => setView(user ? 'home' : 'landing')}
            className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-brand-600 flex items-center gap-2 mb-4 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <h2 className="text-5xl font-black tracking-tighter italic uppercase leading-none">
            Request <span className="text-brand-600">Assistance</span>
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Step {step} of {totalSteps}: {
            step === 1 ? "Vehicle Details" :
            step === 2 ? "The Problem" :
            step === 3 ? (user ? "Location" : "Location") :
            "Contact Info"
          }</p>
        </div>

        {/* Progress Dots */}
        <div className="flex gap-2">
          {Array(totalSteps).fill(0).map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                step === i + 1 ? "w-10 bg-brand-600" : 
                step > i + 1 ? "w-6 bg-green-500" : "w-2 bg-slate-200 dark:bg-slate-800"
              )} 
            />
          ))}
        </div>
      </div>

      <Card className="p-8 dark:bg-slate-900 dark:border-slate-800 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-brand-600" />
        
        <form onSubmit={handleSubmit} className="space-y-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Make</label>
                    <Input 
                      required 
                      className="h-14 text-lg font-bold bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl"
                      placeholder="e.g. Toyota" 
                      value={formData.make}
                      onChange={e => setFormData({...formData, make: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Model</label>
                    <Input 
                      required 
                      className="h-14 text-lg font-bold bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl"
                      placeholder="e.g. Camry SE" 
                      value={formData.model}
                      onChange={e => setFormData({...formData, model: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Manufacture Year</label>
                  <Input 
                    required 
                    className="h-14 text-lg font-bold bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl"
                    placeholder="e.g. 2022" 
                    value={formData.year}
                    onChange={e => setFormData({...formData, year: e.target.value})}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Quick Select Common Issues</label>
                  <div className="flex flex-wrap gap-2">
                    {commonIssues.map((issue) => (
                      <button
                        key={issue}
                        type="button"
                        onClick={() => setFormData({...formData, description: issue})}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                          formData.description === issue
                            ? "bg-brand-600 border-brand-600 text-white shadow-lg"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-500"
                        )}
                      >
                        {issue}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Problem Description</label>
                  <Textarea 
                    required 
                    className="min-h-[150px] text-lg font-medium bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-6"
                    placeholder="Tell us exactly what happened..." 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Neighborhood</label>
                    <select 
                      required 
                      className="w-full h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 px-4 text-lg font-bold border-none"
                      value={formData.address.split(',')[0]}
                      onChange={e => setFormData({...formData, address: e.target.value + (formData.address.includes(',') ? formData.address.substring(formData.address.indexOf(',')) : '')})}
                    >
                      <option value="">Choose area...</option>
                      {['GRA Phase II', 'Trans Amadi', 'D-Line', 'Diobu (Mile 1)', 'Choba', 'Borokiri', 'Eliogbolo', 'Eleme Junction', 'Rumuola', 'Garrison'].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">State</label>
                    <Input 
                      disabled
                      className="h-14 text-lg font-bold bg-slate-100 dark:bg-slate-800 border-none rounded-2xl opacity-70"
                      value="Rivers - Port Harcourt"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Detailed Landmark / Street</label>
                  <Input 
                    required 
                    className="h-14 text-lg font-bold bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl"
                    placeholder="e.g. Near Pleasure Park gate" 
                    value={formData.address.includes(',') ? formData.address.substring(formData.address.indexOf(',') + 2) : formData.address}
                    onChange={e => {
                      const neighborhood = formData.address.includes(',') ? formData.address.split(',')[0] : '';
                      setFormData({...formData, address: neighborhood ? `${neighborhood}, ${e.target.value}` : e.target.value})
                    }}
                  />
                </div>

                <div className="flex items-center gap-4 p-6 bg-red-500/5 border-2 border-red-500/10 rounded-[2rem] group transition-colors hover:border-red-500/20">
                  <input 
                    type="checkbox" 
                    id="emergency-new" 
                    className="h-6 w-6 rounded-lg border-red-200 text-red-600 focus:ring-red-500 cursor-pointer"
                    checked={formData.isEmergency}
                    onChange={e => setFormData({...formData, isEmergency: e.target.checked})}
                  />
                  <label htmlFor="emergency-new" className="cursor-pointer flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                      <span className="font-black text-sm uppercase text-red-600">Emergency Breakdown</span>
                    </div>
                    <p className="text-xs text-red-500 font-medium opacity-80 italic">Flags your request for absolute top priority dispatch.</p>
                  </label>
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                  <div className={cn("w-2 h-2 rounded-full", location ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-amber-500")} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {location ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Acquiring GPS Signal..."}
                  </span>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</label>
                  <Input 
                    required 
                    className="h-14 text-lg font-bold bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl"
                    placeholder="Enter your name" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp / Phone Number</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+234</div>
                    <Input 
                      required 
                      type="tel" 
                      className="h-14 text-lg font-bold bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl pl-16"
                      placeholder="800 000 0000" 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="flex gap-4 pt-6">
            {step > 1 && (
              <Button 
                type="button" 
                variant="secondary" 
                size="lg" 
                className="flex-1 h-16 rounded-2xl h-16 border-2 font-black uppercase tracking-widest"
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            )}
            <Button 
              type="submit" 
              size="lg" 
              className={cn(
                "flex-[2] h-16 text-xl rounded-2xl font-black uppercase tracking-widest shadow-xl",
                step === totalSteps && "bg-green-600 hover:bg-green-700 shadow-green-500/20"
              )} 
              loading={loading}
            >
              {step === totalSteps ? (user ? 'Confirm Request' : 'Submit & Track') : 'Continue'}
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </footer>
        </form>
      </Card>
      
      {/* Dynamic Instruction */}
      <div className="bg-slate-100 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-800">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-tight italic mb-1">Security Guarantee</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Your safety is our priority. All dispatch mechanics are verified, and your exact location is only shared once a mechanic is officially assigned to your request.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ requests, user, profile, currency, mechanics }: { requests: ServiceRequest[], user: FirebaseUser | null, profile: UserProfile | null, currency: any, mechanics: Mechanic[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold">My Requests</h2>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Track your active and past service requests.</p>
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center dark:bg-slate-900 dark:border-slate-800">
          <History className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">You haven't made any requests yet.</p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {requests.map((req) => (
            <Card key={req.id} className="p-6 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                        req.status === 'pending' ? "bg-amber-100 text-amber-700" :
                        req.status === 'assigned' ? "bg-blue-600 text-white animate-pulse" :
                        req.status === 'in-progress' ? "bg-indigo-100 text-indigo-700" :
                        req.status === 'arrived' ? "bg-green-600 text-white" :
                        req.status === 'completed' ? "bg-green-100 text-green-700" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {req.status === 'assigned' ? 'Mechanic Dispatched' : 
                         req.status === 'in-progress' ? 'Mechanic is on the way' :
                         req.status === 'arrived' ? 'Mechanic has arrived' :
                         req.status}
                      </div>
                      {req.isEmergency && (
                        <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                          Emergency
                        </div>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString()} at {new Date(req.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-xl">{req.carDetails.year} {req.carDetails.make} {req.carDetails.model}</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{req.description}</p>
                    </div>
                  </div>

                  {req.staffNotes && (profile?.role === 'mechanic' || profile?.role === 'staff' || profile?.role === 'admin') && (
                    <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <StickyNote className="h-3 w-3" /> Staff Instructions
                      </p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{req.staffNotes}</p>
                    </div>
                  )}

                  <div className="text-right">
                    <p className="text-xs text-slate-500">Estimated Cost</p>
                    <p className="text-2xl font-black text-brand-600">
                      {req.estimatedCost ? `${currency.symbol}${(req.estimatedCost * currency.rate).toLocaleString()}` : 'Calculating...'}
                    </p>
                    {req.paymentStatus === 'paid' ? (
                      <span className="text-[10px] font-bold text-green-600 uppercase flex items-center justify-end gap-1 mt-1">
                        <ShieldCheck className="h-3 w-3" /> Paid
                      </span>
                    ) : req.estimatedCost && (
                      <PaymentButton 
                        amount={req.estimatedCost} 
                        email={user?.email || ''} 
                        requestId={req.id || ''} 
                      />
                    )}
                  </div>
                </div>

                {req.status !== 'pending' && req.status !== 'cancelled' && (
                  <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <StatusTracker status={req.status} />
                    
                    {req.mechanicId && (
                      <div className="grid md:grid-cols-2 gap-6 items-center">
                        <MechanicProfile mechanicId={req.mechanicId} mechanics={mechanics} />
                        {req.eta && (
                          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm">
                              <Clock className="h-6 w-6 text-brand-600" />
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Estimated Arrival</p>
                              <p className="text-xl font-black text-slate-900 dark:text-white">{req.eta}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {req.status === 'pending' && (
                  <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">
                      Cancel Request
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminMapView({ requests, mechanics }: { requests: ServiceRequest[], mechanics: Mechanic[] }) {
  // Center map on Port Harcourt
  const defaultCenter: [number, number] = [4.8156, 7.0498];

  // Custom icons for mechanics and requests
  const mechanicIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const requestIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const emergencyIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <div className="h-[700px] w-full rounded-[2.5rem] overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-2xl bg-slate-100 dark:bg-slate-900 relative">
      <div className="absolute top-6 left-6 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Mechanic</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Request</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Emergency</span>
        </div>
      </div>

      <MapContainer center={defaultCenter} zoom={11} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {/* Requests Markers */}
        {requests.filter(r => r.location && r.status !== 'completed' && r.status !== 'cancelled').map(req => (
          <Marker 
            key={req.id} 
            position={[req.location.latitude, req.location.longitude]}
            icon={req.isEmergency ? emergencyIcon : requestIcon}
          >
            <Popup className="custom-popup">
              <div className="p-4 min-w-[250px] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest mb-1">Service Request</p>
                    <h4 className="font-black text-lg leading-tight uppercase italic">{req.customerName}</h4>
                  </div>
                  {req.isEmergency && (
                    <div className="bg-red-500 text-white p-1 rounded-lg">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  )}
                </div>
                
                <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Vehicle</p>
                  <p className="text-xs font-black">{req.carDetails.year} {req.carDetails.make} {req.carDetails.model}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">{req.status}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Phone</p>
                    <p className="text-[10px] font-black">{req.customerPhone}</p>
                  </div>
                </div>

                <div className="pt-2">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Issue</p>
                   <p className="text-[10px] text-slate-600 dark:text-slate-400 italic line-clamp-2 leading-relaxed font-medium">
                    "{req.description}"
                   </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Mechanics Markers */}
        {mechanics.filter(m => m.location && m.availability !== 'offline').map(mech => (
          <Marker 
            key={mech.uid} 
            position={[mech.location?.latitude || 0, mech.location?.longitude || 0]}
            icon={mechanicIcon}
          >
            <Popup>
               <div className="p-4 min-w-[200px] space-y-3">
                <div className="flex items-center gap-3">
                  <img 
                    src={mech.photoUrl || `https://images.unsplash.com/photo-1615906659123-265b676994ad?auto=format&fit=crop&q=80&w=50`} 
                    className="w-10 h-10 rounded-full object-cover border-2 border-brand-500"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest mb-1">Mechanic Pro</p>
                    <h4 className="font-black text-lg leading-tight uppercase italic">{mech.name}</h4>
                  </div>
                </div>

                <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Expertise</p>
                   <div className="flex flex-wrap gap-1">
                    {mech.skills.map((s, i) => (
                      <span key={i} className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{s}</span>
                    ))}
                   </div>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 p-2 rounded-lg flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-green-600">Availability</p>
                  <span className="text-[10px] font-black uppercase text-green-600 animate-pulse">{mech.availability}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function StaffPortal({ requests, mechanics, currency, profile }: { requests: ServiceRequest[], mechanics: Mechanic[], currency: any, profile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'map' | 'shifts' | 'users' | 'inventory'>('dispatch');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [eta, setEta] = useState('');
  const [cost, setCost] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [isSigningShift, setIsSigningShift] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inventory, setInventory] = useState<SparePart[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Engine' as any,
    price: 0,
    stock: 0,
    image: '',
    compatibility: ''
  });

  // Staff creation state
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [newStaffData, setNewStaffData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'staff' as 'staff' | 'admin'
  });

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffData.email || !newStaffData.password) {
      alert("Email and password are required.");
      return;
    }
    setIsSubmittingStaff(true);
    try {
      const { getSecondaryAuth } = await import('./firebase');
      const secondaryAuth = getSecondaryAuth();
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStaffData.email, newStaffData.password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: newStaffData.email.toLowerCase(),
        displayName: newStaffData.displayName || newStaffData.email.split('@')[0],
        role: newStaffData.role,
        isPremium: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      await signOut(secondaryAuth);
      setIsCreatingStaff(false);
      setNewStaffData({ email: '', password: '', displayName: '', role: 'staff' });
      alert("New team member added successfully!");
    } catch (error) {
      console.error("Staff creation failed", error);
      alert("Creation failed: " + (error as Error).message);
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && (profile?.role === 'admin' || profile?.role === 'staff')) {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
      });
      return () => unsubscribe();
    }
  }, [activeTab, profile]);

  useEffect(() => {
    if (activeTab === 'inventory') {
      const q = query(collection(db, 'spare-parts'), orderBy('name', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SparePart)));
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'spare-parts'), {
        ...newItem,
        rating: 5,
        reviews: 0,
        createdAt: new Date().toISOString()
      });
      setIsAddingItem(false);
      setNewItem({ name: '', category: 'Engine', price: 0, stock: 0, image: '', compatibility: '' });
    } catch (error) {
      console.error("Failed to add item", error);
    }
  };

  const updateInventoryStock = async (itemId: string, newStock: number) => {
    try {
      await updateDoc(doc(db, 'spare-parts', itemId), { stock: newStock });
    } catch (error) {
      console.error("Stock update failed", error);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest?.id || !selectedMechanicId) return;

    setIsDispatching(true);
    const mechanic = mechanics.find(m => m.uid === selectedMechanicId);

    try {
      await updateDoc(doc(db, 'requests', selectedRequest.id), {
        status: 'assigned',
        mechanicId: selectedMechanicId,
        mechanicName: mechanic?.name || 'Unknown',
        eta,
        estimatedCost: Number(cost),
        staffNotes: staffNote,
        updatedAt: new Date().toISOString()
      });
      setSelectedRequest(null);
      setSelectedMechanicId('');
      setEta('');
      setCost('');
      setStaffNote('');
    } catch (error) {
      console.error("Assignment failed", error);
      handleFirestoreError(error, OperationType.UPDATE, `requests/${selectedRequest.id}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const updateStatus = async (requestId: string, newStatus: RequestStatus) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Status update failed", error);
      handleFirestoreError(error, OperationType.UPDATE, `requests/${requestId}`);
    }
  };

  const updateNote = async (requestId: string, note: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        staffNotes: note,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Note update failed", error);
      handleFirestoreError(error, OperationType.UPDATE, `requests/${requestId}`);
    }
  };

  const toggleShift = async () => {
    if (!profile) return;
    setIsSigningShift(true);
    const isOnline = !profile.isOnline;
    const now = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        isOnline: isOnline,
        lastShiftAction: now
      });

      await addDoc(collection(db, 'shifts'), {
        userId: profile.uid,
        userName: profile.displayName,
        action: isOnline ? 'sign-in' : 'sign-out',
        timestamp: now,
        location: 'Portharcourt HQ' // Simplified
      });
    } catch (error) {
      console.error("Shift toggle failed", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSigningShift(false);
    }
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      console.error("Role update failed", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2 text-brand-600">
            <ShieldCheck className="h-6 w-6" />
            <span className="text-xs font-black uppercase tracking-widest">{profile?.role} AUTHORIZED</span>
          </div>
          <h2 className="text-5xl font-black tracking-tighter italic uppercase leading-tight">
            Management <span className="text-brand-600">Console</span>
          </h2>
          <p className="text-slate-500 font-medium mt-2 max-w-sm">Strategic operations, inventory control, and tactical team management for Port Harcourt's #1 rescue network.</p>
          <div className="flex flex-wrap gap-4 mt-8">
            <div className="w-full mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tactical Operations</p>
            </div>
            <button 
              onClick={() => setActiveTab('dispatch')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'dispatch' ? "bg-brand-600 text-white shadow-xl shadow-brand-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-600"
              )}
            >
              Manual Dispatch
            </button>
            <button 
              onClick={() => setActiveTab('map')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'map' ? "bg-brand-600 text-white shadow-xl shadow-brand-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-600"
              )}
            >
              Live Map View
            </button>
            <button 
              onClick={() => setActiveTab('shifts')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'shifts' ? "bg-brand-600 text-white shadow-xl shadow-brand-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-600"
              )}
            >
              Shift Center
            </button>

            <div className="w-full mt-4 mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Executive Management</p>
            </div>
            <button 
              onClick={() => setActiveTab('inventory')}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'inventory' ? "bg-brand-600 text-white shadow-xl shadow-brand-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-600"
              )}
            >
              Store Inventory
            </button>
            {(profile?.role === 'admin' || profile?.role === 'staff') && (
              <button 
                onClick={() => setActiveTab('users')}
                className={cn(
                  "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === 'users' ? "bg-brand-600 text-white shadow-xl shadow-brand-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-600"
                )}
              >
                Personnel Management
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <Card className="px-6 py-4 bg-white dark:bg-slate-900 border-2 border-brand-100 dark:border-brand-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incoming</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none mt-1">{requests.filter(r => r.status === 'pending').length}</p>
              </div>
            </div>
          </Card>
          <Card className="px-6 py-4 bg-white dark:bg-slate-900 border-2 border-brand-100 dark:border-brand-900/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Ops</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none mt-1">{requests.filter(r => r.status === 'assigned' || r.status === 'in-progress' || r.status === 'arrived').length}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'shifts' ? (
          <motion.div
            key="shifts"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="max-w-4xl mx-auto"
          >
            <Card className="p-12 text-center bg-white dark:bg-slate-900 border-x-0 border-y-2 lg:border-2 border-slate-100 dark:border-slate-800 shadow-2xl rounded-none lg:rounded-[3rem]">
              <div className="max-w-md mx-auto space-y-8">
                <div className="w-20 h-20 bg-brand-50 dark:bg-brand-900/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  {profile?.isOnline ? <ShieldCheck className="h-10 w-10 text-brand-600" /> : <Clock className="h-10 w-10 text-slate-400" />}
                </div>
                <div>
                  <h3 className="text-3xl font-black tracking-tighter italic uppercase mb-2">Shift <span className="text-brand-600">Status</span></h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
                    {profile?.isOnline 
                      ? "You are currently signed in and active on the network." 
                      : "You are currently off-duty. Please sign in to begin your shift."}
                  </p>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Last Action</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {profile?.lastShiftAction ? new Date(profile.lastShiftAction).toLocaleTimeString() : 'N/A'} - Portharcourt HQ
                    </p>
                  </div>
                  <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", profile?.isOnline ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500")}>
                    {profile?.isOnline ? "ONLINE" : "OFFLINE"}
                  </div>
                </div>

                <Button 
                  onClick={toggleShift} 
                  loading={isSigningShift}
                  variant={profile?.isOnline ? "danger" : "primary"}
                  className="w-full h-16 rounded-2xl text-lg font-black uppercase tracking-widest"
                >
                  {profile?.isOnline ? "End Shift & Log Out" : "Sign In For Shift"}
                </Button>
                
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">All shift activity is strictly geofenced and logged.</p>
              </div>
            </Card>
          </motion.div>
        ) : activeTab === 'inventory' ? (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">System <span className="text-brand-600">Inventory</span></h3>
              <Button onClick={() => setIsAddingItem(true)} size="sm" className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Add Spare Part
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map((item) => (
                <Card key={item.id} className="p-4 flex flex-col gap-4">
                  <div className="flex gap-4">
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-600 mb-1">{item.category}</p>
                      <h4 className="font-bold text-sm leading-tight">{item.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{item.compatibility}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Stock Level</p>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number" 
                          value={item.stock} 
                          onChange={(e) => updateInventoryStock(item.id!, parseInt(e.target.value))}
                          className="w-16 h-8 text-xs text-center"
                        />
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded",
                          item.stock > 10 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {item.stock > 10 ? "Optimal" : "Low Stock"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Unit Price</p>
                      <p className="font-black text-brand-600">{currency.symbol}{item.price}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <AnimatePresence>
              {isAddingItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-lg"
                  >
                    <Card className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter">Add <span className="text-brand-600">New Item</span></h3>
                        <button onClick={() => setIsAddingItem(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X className="h-5 w-5" /></button>
                      </div>
                      <form onSubmit={handleAddItem} className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Part Name</label>
                          <Input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Premium Brake Pads" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                          <select 
                            className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm"
                            value={newItem.category}
                            onChange={e => setNewItem({...newItem, category: e.target.value as any})}
                          >
                            <option value="Engine">Engine</option>
                            <option value="Brakes">Brakes</option>
                            <option value="Body">Body</option>
                            <option value="Electronics">Electronics</option>
                            <option value="Tires">Tires</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Compatibility</label>
                          <Input value={newItem.compatibility} onChange={e => setNewItem({...newItem, compatibility: e.target.value})} placeholder="e.g. All Sedan models" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Price ({currency.code})</label>
                          <Input type="number" required value={newItem.price} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Stock</label>
                          <Input type="number" required value={newItem.stock} onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value)})} />
                        </div>
                        <div className="col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Image URL</label>
                          <Input value={newItem.image} onChange={e => setNewItem({...newItem, image: e.target.value})} placeholder="https://..." />
                        </div>
                        <Button type="submit" className="col-span-2 h-14 rounded-2xl font-black uppercase tracking-widest mt-4">Registry To Inventory</Button>
                      </form>
                    </Card>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : activeTab === 'users' ? (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Account <span className="text-brand-600">Management</span></h3>
                <p className="text-xs text-slate-500 mt-1">Manage access privileges and onboard new personnel.</p>
              </div>
              {profile?.role === 'admin' && (
                <Button onClick={() => setIsCreatingStaff(true)} size="sm" className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Onboard Staff
                </Button>
              )}
            </div>

            <div className="p-6 bg-brand-50 dark:bg-brand-900/10 rounded-3xl border border-brand-100 dark:border-brand-900/20">
              <h4 className="font-black uppercase tracking-widest text-sm text-brand-600 mb-1">Onboarding Interface</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">Admins can create new staff accounts directly. Customers can also be elevated to staff status from the directory below.</p>
            </div>
            <div className="grid gap-4">
              {users.map((u) => (
                <Card key={u.uid} className="p-6 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xl text-slate-400">
                        {u.displayName[0]}
                      </div>
                      <div>
                        <h4 className="font-black uppercase italic italic-none tracking-tight leading-none mb-1">{u.displayName}</h4>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <select 
                        className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-[10px] font-black uppercase tracking-widest cursor-pointer"
                        value={u.role}
                        onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole)}
                      >
                        <option value="customer">Customer</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                        <option value="mechanic">Mechanic</option>
                      </select>
                      <div className={cn("w-2 h-2 rounded-full", u.isOnline ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-slate-300")} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <AnimatePresence>
              {isCreatingStaff && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md"
                  >
                    <Card className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter">Onboard <span className="text-brand-600">Personnel</span></h3>
                        <button onClick={() => setIsCreatingStaff(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X className="h-5 w-5" /></button>
                      </div>
                      <form onSubmit={handleCreateStaff} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                          <Input required value={newStaffData.displayName} onChange={e => setNewStaffData({...newStaffData, displayName: e.target.value})} placeholder="e.g. Samuel Okon" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                          <Input type="email" required value={newStaffData.email} onChange={e => setNewStaffData({...newStaffData, email: e.target.value})} placeholder="staff@autobit.com" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporary Password</label>
                          <Input type="password" required value={newStaffData.password} onChange={e => setNewStaffData({...newStaffData, password: e.target.value})} placeholder="••••••••" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Clearance Role</label>
                          <select 
                            className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm"
                            value={newStaffData.role}
                            onChange={e => setNewStaffData({...newStaffData, role: e.target.value as any})}
                          >
                            <option value="staff">Operational Staff</option>
                            <option value="admin">System Administrator</option>
                          </select>
                        </div>
                        <Button type="submit" disabled={isSubmittingStaff} className="w-full h-14 rounded-2xl font-black uppercase tracking-widest mt-4">
                          {isSubmittingStaff ? <Loader2 className="h-5 w-5 animate-spin" /> : "Registry Personnel"}
                        </Button>
                      </form>
                    </Card>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : activeTab === 'dispatch' ? (
          <motion.div 
            key="dispatch"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-4">
              {requests.map((req) => (
                <Card 
                  key={req.id} 
                  className={cn(
                    "p-4 cursor-pointer transition-all border-l-4 dark:bg-slate-900 dark:border-slate-800",
                    selectedRequest?.id === req.id ? "ring-2 ring-brand-500 border-l-brand-600" : "hover:bg-slate-50 border-l-transparent",
                    req.isEmergency && "bg-red-50/30 dark:bg-red-900/10 border-l-red-500"
                  )}
                  onClick={() => setSelectedRequest(req)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-500">{new Date(req.createdAt).toLocaleTimeString()}</span>
                        {req.isEmergency && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">Emergency</span>}
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded capitalize font-medium",
                          req.status === 'pending' ? "bg-amber-100 text-amber-700" :
                          req.status === 'completed' ? "bg-green-100 text-green-700" :
                          "bg-blue-100 text-blue-700"
                        )}>{req.status}</span>
                      </div>
                      <h4 className="font-bold">{req.customerName} - {req.carDetails.year} {req.carDetails.make}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">{req.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </Card>
              ))}
            </div>

            <div>
              {selectedRequest ? (
                <Card className="p-6 sticky top-24 dark:bg-slate-900 dark:border-slate-800">
                  <h3 className="font-bold text-xl mb-4">
                    {selectedRequest.status === 'pending' ? 'Dispatch Mechanic' : 'Manage Request'}
                  </h3>
                  
                  {selectedRequest.status === 'pending' ? (
                    <form onSubmit={handleAssign} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Mechanic</label>
                        <select 
                          className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm"
                          value={selectedMechanicId}
                          onChange={e => setSelectedMechanicId(e.target.value)}
                          required
                        >
                          <option value="">Choose a professional...</option>
                          {mechanics.filter(m => m.availability === 'available').map(m => (
                            <option key={m.uid} value={m.uid}>{m.name} ({m.skills[0]})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">ETA (e.g. 15 mins)</label>
                        <Input placeholder="15 mins" value={eta} onChange={e => setEta(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Estimated Cost (USD)</label>
                        <Input type="number" placeholder="50" value={cost} onChange={e => setCost(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-500">Assignment Notes for Mechanic (Optional)</label>
                        <Textarea 
                          placeholder="Special instructions for the mechanic..." 
                          value={staffNote} 
                          onChange={e => setStaffNote(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <Button type="submit" className="w-full" loading={isDispatching}>
                        Dispatch Now
                      </Button>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Status</span>
                          <span className="font-bold text-brand-600 capitalize">{selectedRequest.status}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Mechanic</span>
                          <span className="font-bold">{selectedRequest.mechanicName}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Note to Mechanic</p>
                        <Textarea 
                          defaultValue={selectedRequest.staffNotes || ''}
                          onBlur={(e) => updateNote(selectedRequest.id!, e.target.value)}
                          placeholder="Add or update instructions..."
                          className="text-xs bg-white dark:bg-slate-900 border-dashed"
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Update Status</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => updateStatus(selectedRequest.id!, 'in-progress')}
                            disabled={selectedRequest.status === 'in-progress'}
                          >
                            On the way
                          </Button>
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => updateStatus(selectedRequest.id!, 'arrived')}
                            disabled={selectedRequest.status === 'arrived'}
                          >
                            Arrived
                          </Button>
                          <Button 
                            size="sm" 
                            variant="primary" 
                            className="col-span-2"
                            onClick={() => updateStatus(selectedRequest.id!, 'completed')}
                            disabled={selectedRequest.status === 'completed'}
                          >
                            Mark Completed
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-medium">{selectedRequest.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-medium">{selectedRequest.customerPhone}</span>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-12 text-center border-dashed dark:bg-slate-900 dark:border-slate-800">
                  <LayoutDashboard className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">Select a request to manage dispatch</p>
                </Card>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="map"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AdminMapView requests={requests} mechanics={mechanics} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MechanicManagementView({ mechanics }: { mechanics: Mechanic[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    skills: '',
    photoUrl: '',
    availability: 'available' as const
  });

  const handleAddMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newMechanicRef = doc(collection(db, 'mechanics'));
      await setDoc(newMechanicRef, {
        name: formData.name,
        phone: formData.phone,
        skills: formData.skills.split(',').map(s => s.trim()),
        photoUrl: formData.photoUrl || `https://images.unsplash.com/photo-1615906659123-265b676994ad?auto=format&fit=crop&q=80&w=200`,
        availability: formData.availability,
        uid: newMechanicRef.id
      });
      setIsAdding(false);
      setFormData({ name: '', phone: '', skills: '', photoUrl: '', availability: 'available' });
    } catch (error) {
      console.error("Failed to add mechanic", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold">Mechanic Management</h2>
          <p className="text-slate-600 mt-2">View and manage your team of expert mechanics.</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <User className="mr-2 h-4 w-4" />
          Add Mechanic
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          >
            <Card className="w-full max-w-md p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">New Mechanic Profile</h3>
                <button onClick={() => setIsAdding(false)}><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleAddMechanic} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Skills (comma separated)</label>
                  <Input required placeholder="Engine, Tires, Electrical" value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Photo URL (optional)</label>
                  <Input placeholder="https://..." value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})} />
                </div>
                <Button type="submit" className="w-full">Save Mechanic</Button>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mechanics.map((mechanic) => (
          <Card key={mechanic.uid} className="group hover:border-brand-500/30 transition-all">
            <div className="p-6 flex items-start gap-4">
              <img 
                src={mechanic.photoUrl || `https://picsum.photos/seed/${mechanic.name}/200/200`} 
                alt={mechanic.name}
                className="w-20 h-20 rounded-2xl object-cover bg-slate-100"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${mechanic.uid}/200/200`;
                }}
              />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-lg">{mechanic.name}</h4>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    mechanic.availability === 'available' ? "bg-green-500" : 
                    mechanic.availability === 'busy' ? "bg-amber-500" : "bg-slate-300"
                  )} />
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {mechanic.phone}
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {mechanic.skills.map((skill, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                {mechanic.availability}
              </span>
              <Button variant="ghost" size="sm" className="h-8 text-xs">Edit Profile</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AIChatView({ user, profile }: { user: any, profile: any }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: "Hello! I'm your AutoBit Rescue Assistant. How can I help you with your car today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatType, setChatType] = useState<'ai' | 'admin' | 'whatsapp'>('ai');
  const [directMessages, setDirectMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, directMessages, loading]);

  useEffect(() => {
    if (chatType === 'admin' && user) {
      const chatId = profile?.role === 'admin' ? 'global_admin_chat' : user.uid;
      const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        setDirectMessages(msgs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
      });
      return () => unsubscribe();
    }
  }, [chatType, user, profile]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    if (chatType === 'ai') {
      const userMsg = input;
      setInput('');
      setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
      setLoading(true);
      try {
        const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const response = await getChatResponse(userMsg, history);
        setMessages(prev => [...prev, { role: 'model', text: response }]);
      } catch (error) {
        console.error("Chat failed", error);
        setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I'm having trouble connecting right now." }]);
      } finally {
        setLoading(false);
      }
    } else if (user) {
      const chatId = profile?.role === 'admin' ? 'global_admin_chat' : user.uid;
      const text = input;
      setInput('');
      try {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: user.uid,
          senderName: user.displayName,
          text,
          timestamp: new Date().toISOString(),
          isAdmin: profile?.role === 'admin'
        });
      } catch (error) {
        console.error("Failed to send message", error);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[600px] flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold">Support Center</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Get instant help from our AI or chat with an admin.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <button 
            onClick={() => setChatType('ai')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", chatType === 'ai' ? "bg-white dark:bg-slate-800 shadow-sm text-brand-600" : "text-slate-500")}
          >
            AI Assistant
          </button>
          <button 
            onClick={() => setChatType('admin')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", chatType === 'admin' ? "bg-white dark:bg-slate-800 shadow-sm text-brand-600" : "text-slate-500")}
          >
            Direct Chat
          </button>
          <button 
            onClick={() => setChatType('whatsapp')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", chatType === 'whatsapp' ? "bg-white dark:bg-slate-800 shadow-sm text-brand-600" : "text-slate-500")}
          >
            WhatsApp Support
          </button>
        </div>
        <div className="flex gap-2">
          {chatType === 'ai' && messages.length > 1 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setMessages([{ role: 'model', text: "Hello! History cleared. How can I help you again?" }])}
              className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-red-500"
            >
              Clear History
            </Button>
          )}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatType === 'whatsapp' ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-12">
              <div className="space-y-4">
                <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto">
                  <Smartphone className="h-10 w-10 text-green-500" />
                </div>
                <div>
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter">Direct <span className="text-green-500">WhatsApp</span></h3>
                  <p className="text-slate-500 max-w-sm">Connect instantly with our executive recovery team for emergency calls or status updates.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-xl">
                <motion.a
                  whileHover={{ y: -5 }}
                  href={WhatsAppService.getChatLink("+234800AUTOBIT", "Hello, I need assistance with my vehicle.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors group"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-green-500 group-hover:text-white transition-colors">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Chat Now</span>
                </motion.a>

                <motion.a
                  whileHover={{ y: -5 }}
                  href={WhatsAppService.getCallLink("+234800AUTOBIT")}
                  className="flex flex-col items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors group"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-green-500 group-hover:text-white transition-colors">
                    <PhoneCall className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Voice Call</span>
                </motion.a>

                <motion.a
                  whileHover={{ y: -5 }}
                  href={WhatsAppService.getCallLink("+234800AUTOBIT")}
                  className="flex flex-col items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors group"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-green-500 group-hover:text-white transition-colors">
                    <Video className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Video Call</span>
                </motion.a>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/30">
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Note: Video and Voice calls require the WhatsApp app to be installed on your device.</p>
              </div>
            </div>
          ) : chatType === 'ai' ? (
            messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm", 
                  m.role === 'user' 
                    ? "bg-brand-600 text-white rounded-tr-none" 
                    : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-tl-none"
                )}>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Markdown>{m.text}</Markdown>
                  </div>
                </div>
              </div>
            ))
          ) : !user ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full">
                <MessageSquare className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Sign in to chat with Admin</h3>
                <p className="text-sm text-slate-500">Direct chat requires a verified account to ensure secure communication.</p>
              </div>
            </div>
          ) : chatType === 'admin' && directMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-40">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center">
                <Send className="h-6 w-6" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest">No messages yet. Say hello to our staff!</p>
            </div>
          ) : (
            directMessages.map((m) => (
              <div key={m.id} className={cn("flex", m.senderId === user?.uid ? "justify-end" : "justify-start")}>
                <div className="max-w-[85%] space-y-1">
                  <p className="text-[10px] text-slate-400 px-1">{m.senderName}</p>
                  <div className={cn(
                    "rounded-2xl px-4 py-2 text-sm shadow-sm", 
                    m.senderId === user?.uid 
                      ? "bg-brand-600 text-white rounded-tr-none" 
                      : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-tl-none"
                  )}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 shadow-sm">
                <div className="flex gap-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    className="w-1.5 h-1.5 bg-brand-500 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-1.5 h-1.5 bg-brand-500 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-1.5 h-1.5 bg-brand-500 rounded-full"
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI is thinking...</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className={cn("p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2", chatType === 'whatsapp' && "hidden")}>
          <Input 
            placeholder={chatType === 'ai' ? "Ask AI..." : !user ? "Sign in to message admin" : "Message admin..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={chatType === 'admin' && !user}
          />
          <Button type="submit" disabled={loading || (chatType === 'admin' && !user)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

function PaymentButton({ amount, email, requestId }: { amount: number, email: string, requestId: string }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, email, requestId })
      });
      
      const data = await response.json();
      if (data.status && data.data.authorization_url) {
        // In a real app, we'd use a popup or redirect. 
        // For this environment, we'll open in a new tab if possible, or just log.
        window.open(data.data.authorization_url, '_blank');
        
        // Mocking the success for demo purposes since we can't easily handle the webhook/callback in this sandbox without a real domain
        await updateDoc(doc(db, 'requests', requestId), {
          paymentStatus: 'paid',
          paymentReference: data.data.reference,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Payment initialization failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      size="sm" 
      variant="primary" 
      className="mt-2 text-xs" 
      onClick={handlePayment}
      loading={loading}
    >
      <CreditCard className="mr-2 h-3 w-3" />
      Pay Now
    </Button>
  );
}

function LandingPageView({ setView, handleLogin }: { setView: (v: any) => void, handleLogin: () => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const stats = [
    { label: "Active Mechanics", value: "500+" },
    { label: "Jobs Completed", value: "10k+" },
    { label: "Avg. Response", value: "15m" },
    { label: "Satisfaction", value: "99%" }
  ];

  const activity = [
    { type: 'dispatch', city: 'GRA Phase II', detail: 'Mechanic dispatched to Tombia Street' },
    { type: 'complete', city: 'Trans Amadi', detail: 'Engine diagnostic completed in Industrial Layout' },
    { type: 'dispatch', city: 'Borokiri', detail: 'Towing truck on route to Sandfill' },
    { type: 'complete', city: 'Choba', detail: 'Brake pad replacement near Uniport Gate' }
  ];

  const cities = ['GRA', 'Trans Amadi', 'D-Line', 'Borokiri', 'ChoBa', 'Diobu', 'Rumubiakani', 'Garrison', 'Eleme', 'Ada George'];

  return (
    <div className="space-y-32 -mt-8 pb-32 overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden rounded-b-[4rem] shadow-2xl">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=2000" 
            alt="Hero Background"
            className="w-full h-full object-cover scale-110"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=2000";
            }}
          />
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/85 backdrop-blur-[1px]" />
          
          {/* Animated Glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center space-y-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-bold backdrop-blur-md"
          >
            <Zap className="h-4 w-4 fill-current" />
            Port Harcourt's #1 Real-Time Auto Rescue
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.9]"
          >
            STRANDED? <br />
            <span className="text-brand-500 italic">WE'RE ALREADY MOVING.</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto font-medium"
          >
            Smart dispatch. Professional mechanics. Fixed pricing. <br className="hidden md:block"/>
            The future of vehicle maintenance is here.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-5 justify-center pt-6"
          >
            <Button size="lg" className="h-16 px-10 text-xl font-black rounded-2xl group shadow-xl shadow-brand-500/20" onClick={() => setView('request')}>
              GET HELP NOW 
              <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="secondary" className="h-16 px-10 text-xl font-black rounded-2xl border-2" onClick={() => setView('shop')}>
              SHOP PARTS
            </Button>
          </motion.div>

          {/* Real-time Indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="pt-12 flex items-center justify-center gap-6"
          >
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-[10px] uppercase font-black tracking-widest text-green-500">524 Mechanics Online</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Marquee - Brutalist style cities */}
      <div className="bg-brand-600 py-6 -mt-12 overflow-hidden rotate-1 relative z-20 shadow-xl border-y-4 border-black/10">
        <div className="flex flex-nowrap animate-marquee whitespace-nowrap gap-12 text-white font-black text-4xl italic uppercase">
          {Array(4).fill(cities).flat().map((city, i) => (
            <span key={i} className="flex items-center gap-4">
              {city} <Wrench className="h-8 w-8 opacity-30" />
            </span>
          ))}
        </div>
      </div>

      {/* Live Activity & Interactive Steps Split */}
      <section className="max-w-7xl mx-auto px-4 grid lg:grid-cols-12 gap-16 items-start">
        <div className="lg:col-span-5 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Activity className="h-3 w-3" />
            Live Dispatch Stream
          </div>
          <h2 className="text-5xl font-black tracking-tighter leading-none">
            SEE US IN <span className="text-brand-600">ACTION</span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Our dispatch engine never sleeps. Here's what's happening right now across Port Harcourt.
          </p>
          
          <div className="space-y-4 relative">
            <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-brand-100 dark:bg-slate-800" />
            {activity.map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative group hover:shadow-md transition-shadow"
              >
                <div className="absolute top-1/2 -left-4 w-2 h-2 rounded-full bg-brand-500 -translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform" />
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-black uppercase text-brand-600">{item.city}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Just now</span>
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.detail}</p>
              </motion.div>
            ))}
            <div className="pt-4 text-center">
              <button 
                onClick={() => setView('map')}
                className="text-xs font-black uppercase tracking-widest text-brand-600 hover:text-brand-700 transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <Play className="h-3 w-3 fill-current" />
                View Full Live Map
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-12">
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            {['The Request', 'The Dispatch', 'The Fix'].map((step, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === i 
                    ? "bg-white dark:bg-slate-900 text-brand-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                {step}
              </button>
            ))}
          </div>

          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid md:grid-cols-2 gap-8 items-center"
              >
                <div className="space-y-6">
                  <h3 className="text-4xl font-black tracking-tighter leading-none">
                    {activeTab === 0 && <>You're Stranded. <br/> <span className="text-brand-600">Stay Calm.</span></>}
                    {activeTab === 1 && <>AI Search. <br/> <span className="text-brand-600">Instant Match.</span></>}
                    {activeTab === 2 && <>Certified Pro. <br/> <span className="text-brand-600">Back on Road.</span></>}
                  </h3>
                  <p className="text-lg text-slate-600 dark:text-slate-400">
                    {activeTab === 0 && "Simply open the app, tap Request Help, and our system auto-pinpoints your location. No complex forms, just the essentials."}
                    {activeTab === 1 && "Our system scans 500+ verified mechanics nearby. Within 60 seconds, a pro is assigned and already driving to your location."}
                    {activeTab === 2 && "Track them arrival in real-time. Pay securely via the app only after the job is completed. Simple as that."}
                  </p>
                  <ul className="space-y-3">
                    {activeTab === 0 && [
                      "Auto-GPS coordinates",
                      "Photo evidence backup",
                      "Anonymous requests enabled"
                    ].map((li, k) => (
                      <li key={k} className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="h-5 w-5 text-green-500" /> {li}
                      </li>
                    ))}
                    {activeTab === 1 && [
                      "Average 15m ETA",
                      "Background checked pros",
                      "Fixed pricing guarantee"
                    ].map((li, k) => (
                      <li key={k} className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="h-5 w-5 text-green-500" /> {li}
                      </li>
                    ))}
                    {activeTab === 2 && [
                      "Digital invoice system",
                      "Rated by 10k+ users",
                      "Post-fix warranty"
                    ].map((li, k) => (
                      <li key={k} className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="h-5 w-5 text-green-500" /> {li}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <motion.img 
                    src={
                      activeTab === 0 
                        ? "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800"
                        : activeTab === 1
                        ? "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=800"
                        : "https://images.unsplash.com/photo-1530046339160-ce3e5b0c7a2f?auto=format&fit=crop&q=80&w=800"
                    }
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=60&w=800`;
                    }}
                  />
                  <div className="absolute inset-0 bg-brand-600/10 mix-blend-overlay" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Featured Parts Marquee */}
      <section className="bg-slate-900 py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_70%)]" />
        <div className="max-w-7xl mx-auto px-4 text-center space-y-16 relative z-10">
          <div className="space-y-4">
            <h2 className="text-5xl font-black text-white tracking-tighter italic uppercase">Need Parts Fast?</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Get OEM parts delivered to your breakdown site or garage in record time.</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { label: "Brake Pads", img: "https://images.unsplash.com/photo-1635773054018-097c03350961?auto=format&fit=crop&q=80&w=800" },
              { label: "Tires", img: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=800" },
              { label: "Batteries", img: "https://images.unsplash.com/photo-1595213600645-ec098bb12b6f?auto=format&fit=crop&q=80&w=800" },
              { label: "Flow", img: "https://images.unsplash.com/photo-1590674852885-ce8245d98863?auto=format&fit=crop&q=80&w=800" }
            ].map((p, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-sm group cursor-pointer"
              >
                <div className="aspect-square rounded-3xl overflow-hidden mb-6 bg-white flex items-center justify-center p-4 shadow-[inset_0_2px_20px_rgba(0,0,0,0.1)] relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-100 to-white" />
                  <img 
                    src={p.img} 
                    className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-110 mix-blend-multiply" 
                    referrerPolicy="no-referrer" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=60&w=800`;
                    }} 
                  />
                </div>
                <p className="text-xl font-black text-white italic uppercase tracking-tighter">{p.label}</p>
                <button className="mt-4 text-[10px] font-black uppercase tracking-widest text-brand-400 group-hover:text-brand-300 flex items-center gap-1 mx-auto">
                  Browse Catalog <ArrowRight className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Heatmap Section */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-32 rounded-[4rem] border border-slate-200 dark:border-slate-800 mx-4">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-500/10 border border-brand-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-600">
              <MapPin className="h-3 w-3" />
              Pitakwa Resident Experts
            </div>
            <h2 className="text-5xl font-black tracking-tighter leading-none italic uppercase">
              Always <span className="text-brand-600">Within</span> Reach
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Our network currently covers the entire heart of Rivers State. From the buzz of Mile 1 to the quiet of GRA, an AutoBit expert is never more than 15 minutes away.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: 'Key Zones', value: '12 Districts' },
                { label: 'Avg Distance', value: '2.5km' },
                { label: 'Active Pros', value: '85' },
                { label: 'Mobile Units', value: '40+' }
              ].map((s, i) => (
                <div key={i} className="border-b-2 border-slate-100 dark:border-slate-800 pb-4">
                  <p className="text-2xl font-black">{s.value}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">Active Patrol Zones</p>
              <div className="flex flex-wrap gap-2">
                {['GRA Phase II', 'Trans Amadi', 'Pleasure Park', 'Mile 1 Market', 'Eleme Junction', 'Airforce Base', 'Choba', 'Borokiri'].map(zone => (
                  <span key={zone} className="px-3 py-1.5 bg-brand-500/5 border border-brand-500/10 rounded-xl text-[10px] font-black text-brand-600 uppercase tracking-widest">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="relative aspect-[4/3] bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white dark:border-slate-800">
            {/* Mock Map Background */}
            <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=1200')] bg-cover grayscale" />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-transparent" />
            
            {/* Pulses */}
            {[
              { top: '20%', left: '30%' },
              { top: '40%', left: '60%' },
              { top: '70%', left: '40%' },
              { top: '30%', left: '80%' },
              { top: '60%', left: '70%' },
              { top: '50%', left: '20%' },
            ].map((p, i) => (
              <div key={i} className="absolute" style={{ top: p.top, left: p.left }}>
                <span className="relative flex h-8 w-8">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500 mt-2.5 ml-2.5"></span>
                </span>
                <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md shadow-lg hidden group-hover:block transition-all whitespace-nowrap">
                  <p className="text-[8px] font-black uppercase tracking-widest leading-none">Mechanic #72</p>
                </div>
              </div>
            ))}

            <div className="absolute bottom-8 left-8 right-8 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-white/50 leading-none">System Status</p>
                  <p className="text-sm font-black text-white">All Systems Optimal</p>
                </div>
              </div>
                  <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 overflow-hidden">
                    <img 
                      src={`https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100`;
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="text-center space-y-16">
          <div className="space-y-4">
            <Quote className="h-12 w-12 text-brand-500 mx-auto opacity-20" />
            <h2 className="text-5xl font-black tracking-tighter leading-none italic uppercase">Don't Take Our<br/><span className="text-brand-600">Word For It</span></h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Kunle A.", role: "Premium Member", text: "Stuck at Eleme Junction during the rain. Used AutoBit and a mechanic was there in 12 minutes. Best service in Pitakwa!", rating: 5 },
              { name: "Sarah O.", role: "Commuter", text: "The fixed pricing is the best part. No more arguing with roadside mechanics at Garrison who double the price when they see you're in a hurry.", rating: 5 },
              { name: "Emeka V.", role: "Elite Member", text: "Excellent customer service. The AI assistant helped me diagnose my coolant leak at Trans Amadi before I even requested a mechanic.", rating: 5 }
            ].map((t, i) => (
              <Card key={i} className="p-8 space-y-6 dark:bg-slate-900 dark:border-slate-800 hover:scale-[1.02] transition-transform cursor-default">
                <div className="flex gap-1">
                  {Array(t.rating).fill(0).map((_, k) => (
                    <Star key={k} className="h-4 w-4 text-amber-500 fill-current" />
                  ))}
                </div>
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300 italic">"{t.text}"</p>
                <div className="flex items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-black">
                    {t.name[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm">{t.name}</p>
                    <p className="text-[10px] uppercase font-bold text-brand-600 tracking-widest">{t.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Live Activity Ticker */}
      <section className="bg-brand-600 py-6 -rotate-1 scale-105 border-y-4 border-black/10 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap gap-16 items-center">
          {[
            "RECENT SAVE: Toyota Camry (GRA Phase II - 10m ETA)",
            "NEW MEMBER: Sarah O. (Standard Plan)",
            "DISPATCHED: Mechanic #42 (Choba - Brakes)",
            "SPARES DELIVERED: Brake Pads (Trans Amadi)",
            "RECENT SAVE: Honda Accord (Borokiri - 15m ETA)",
            "NEW MEMBER: John D. (Elite Plan)",
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" />
              <span className="text-white text-sm font-black uppercase tracking-tighter italic">{text}</span>
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {[
            "RECENT SAVE: Toyota Camry (GRA Phase II - 10m ETA)",
            "NEW MEMBER: Sarah O. (Standard Plan)",
            "DISPATCHED: Mechanic #42 (Choba - Brakes)",
            "SPARES DELIVERED: Brake Pads (Trans Amadi)",
            "RECENT SAVE: Honda Accord (Borokiri - 15m ETA)",
            "NEW MEMBER: John D. (Elite Plan)",
          ].map((text, i) => (
            <div key={`dup-${i}`} className="flex items-center gap-4">
              <span className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" />
              <span className="text-white text-sm font-black uppercase tracking-tighter italic">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Interactive Accordion */}
      <section className="max-w-3xl mx-auto px-4 space-y-12">
        <h2 className="text-4xl font-black text-center tracking-tighter italic uppercase">Common Questions</h2>
        <div className="space-y-3">
          {[
            { q: "How fast is a typical dispatch?", a: "Our average dispatch time in Port Harcourt is under 15 minutes. Whether you are in the heart of the city or outskirts like Choba, we have mechanics stationed nearby." },
            { q: "Are the mechanics verified?", a: "Yes. Every mechanic undergoes a 3-step verification process: background check, skill testing, and ongoing performance monitoring based on user ratings." },
            { q: "Can I cancel a request?", a: "Requests can be cancelled within 5 minutes of being placed without any charge. After a mechanic is dispatched, a small base fee may apply." },
            { q: "Is the pricing really fixed?", a: "Yes. For standardized jobs like tire changes or oil fixes, pricing is fixed. For complex repairs, we provide an upfront estimate which is approved by you before work begins." }
          ].map((item, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <button 
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <span className="font-black text-sm uppercase tracking-tight">{item.q}</span>
                <ChevronDown className={cn("h-5 w-5 text-slate-400 transition-transform", activeFaq === i && "rotate-180")} />
              </button>
              <AnimatePresence>
                {activeFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <div className="px-6 pb-6 pt-0 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* End CTA */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-brand-600 rounded-[3rem] p-16 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-[80px]" />
          
          <div className="relative z-10 space-y-10">
            <div className="space-y-4">
              <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.8] italic uppercase">Don't Get <br/> Stuck.</h2>
              <p className="max-w-xl mx-auto text-xl font-medium text-brand-100 opacity-90">Join 10,000+ drivers who never worry about breakdown situations anymore.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="h-16 px-12 text-xl font-black rounded-2xl bg-white text-brand-600" onClick={handleLogin}>
                Sign Up Now
              </Button>
              <Button size="lg" className="h-16 px-12 text-xl font-black rounded-2xl border-2 border-white/20 bg-brand-500" onClick={() => setView('request')}>
                Get Service
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Support Button */}
      <div className="fixed bottom-8 right-8 z-[100] group">
        <div className="absolute -inset-4 bg-brand-500/20 rounded-full blur-xl group-hover:bg-brand-500/40 transition-all opacity-0 group-hover:opacity-100" />
        <button 
          onClick={() => setView('chat')}
          className="relative w-16 h-16 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group cursor-pointer"
        >
          <MessageSquare className="h-7 w-7" />
          <span className="absolute right-full mr-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl">
            Live Support Online
          </span>
        </button>
      </div>
    </div>
  );
}

function SparePartsShopView({ currency, isAdmin }: { currency: any, isAdmin: boolean }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [parts, setParts] = useState<SparePart[]>([]);
  const [cart, setCart] = useState<{ part: SparePart; quantity: number }[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [newPart, setNewPart] = useState<Partial<SparePart>>({
    name: '', category: 'Other', price: 0, description: '', stock: 0, image: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'spare_parts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SparePart));
      setParts(ps);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'spare_parts');
    });
    return () => unsubscribe();
  }, []);

  const addToCart = (part: SparePart) => {
    setCart(prev => {
      const existing = prev.find(item => item.part.id === part.id);
      if (existing) {
        return prev.map(item => 
          item.part.id === part.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { part, quantity: 1 }];
    });
    // Temporary toast simulation
    const btn = document.getElementById(`add-${part.id}`);
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span class="flex items-center gap-1"><CheckCircle2 class="h-4 w-4" /> Added</span>`;
      setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.part.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.part.price * item.quantity), 0);

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'spare_parts'), {
        ...newPart,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewPart({ name: '', category: 'Other', price: 0, description: '', stock: 0, image: '' });
    } catch (error) {
      console.error("Failed to add part", error);
    }
  };

  const partQuickSelect = (label: string, category: string, img: string, price: number, desc: string) => {
    setNewPart({
      name: label,
      category: category as any,
      image: img,
      price: price,
      description: desc,
      stock: 20
    });
  };

  const getPartPlaceholder = (name: string) => {
    return `https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=60&w=800`;
  };

  const handleDeletePart = async (id: string) => {
    if (!confirm("Are you sure you want to remove this part?")) return;
    try {
      await updateDoc(doc(db, 'spare_parts', id), { deleted: true });
    } catch (error) {
      console.error("Failed to delete part", error);
    }
  };

  const filteredParts = parts
    .filter(p => 
      !(p as any).deleted &&
      (category === 'All' || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const formatPrice = (price: number) => {
    return `${currency.symbol}${(price * currency.rate).toLocaleString()}`;
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-5xl font-black tracking-tighter italic uppercase leading-none">
            Spare <span className="text-brand-600">Parts</span> Shop
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 font-medium">OEM certified parts for emergency breakdown or scheduled maintenance.</p>
        </div>
        <div className="flex gap-4">
          {isAdmin && (
            <Button onClick={() => setIsAdding(true)} variant="secondary" className="rounded-2xl border-2">Add Stock</Button>
          )}
          <button 
            onClick={() => setShowCart(true)}
            className="flex items-center gap-3 bg-brand-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-500/20 hover:bg-brand-700 transition-all relative"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Cart</span>
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-white animate-bounce">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="Search genuine parts..." 
            className="h-14 pl-12 bg-white dark:bg-slate-900 border-none shadow-sm rounded-2xl text-lg font-bold"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 lg:pb-0">
          <select 
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="h-14 px-6 rounded-2xl bg-white dark:bg-slate-900 border-none font-black text-xs uppercase tracking-widest text-slate-500 cursor-pointer shadow-sm"
          >
            <option value="newest">Newest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
          <div className="flex gap-2 p-1.5 bg-slate-200 dark:bg-slate-800/50 rounded-2xl h-14">
            {['All', 'Engine', 'Tires', 'Brakes', 'Electrical'].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  category === cat 
                    ? "bg-white dark:bg-slate-900 text-brand-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredParts.map((part) => (
          <motion.div key={part.id} whileHover={{ y: -5 }}>
            <Card className="group h-full flex flex-col dark:bg-slate-900 dark:border-slate-800 border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2.5rem] overflow-hidden">
              <div className="relative aspect-square overflow-hidden bg-white flex items-center justify-center p-8 group relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-50 to-white" />
                <img 
                  src={part.image || getPartPlaceholder(part.name)} 
                  alt={part.name}
                  className="relative z-10 max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-700 mix-blend-multiply"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getPartPlaceholder(part.name);
                  }}
                />
                <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                  {part.category}
                </div>
                {part.stock <= 5 && (
                  <div className="absolute bottom-4 left-4 bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg animate-pulse">
                    Low Stock: {part.stock}
                  </div>
                )}
                {isAdmin && (
                  <button 
                    onClick={() => handleDeletePart(part.id)}
                    className="absolute top-4 left-4 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white p-2 rounded-xl transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col gap-4">
                <div className="space-y-1">
                  <h4 className="font-black text-xl italic uppercase tracking-tighter">{part.name}</h4>
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array(5).fill(0).map((_, i) => (
                      <Star key={i} className={cn("h-3 w-3", i < 4 ? "fill-current" : "fill-none")} />
                    ))}
                    <span className="text-[10px] font-black text-slate-400 ml-1">(12)</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed flex-1">{part.description}</p>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-2xl font-black text-brand-600">{formatPrice(part.price)}</span>
                  <button 
                    id={`add-${part.id}`}
                    onClick={() => addToCart(part)}
                    className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center hover:bg-brand-600 transition-colors shadow-lg"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Admin Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xl"
            >
              <Card className="p-8 dark:bg-slate-900 border-none shadow-2xl relative">
                <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white"><X className="h-6 w-6" /></button>
                <h3 className="text-3xl font-black italic uppercase italic tracking-tighter mb-4">Add New <span className="text-brand-600">Inventory</span></h3>
                
                <div className="flex flex-wrap gap-2 mb-8 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="w-full text-[10px] font-black uppercase text-slate-500 mb-2">Quick Templates</p>
                  {[
                    { label: 'Tires', cat: 'Tires', img: 'istockphoto-91045814-612x612.jpg', price: 120, desc: 'High-performance all-weather tires.' },
                    { label: 'Brake Pads', cat: 'Brakes', img: 'istockphoto-2157035945-612x612.jpg', price: 45, desc: 'Ceramic quiet-stop brake pads set.' },
                    { label: 'Battery', cat: 'Electrical', img: 'istockphoto-185221105-612x612.jpg', price: 150, desc: 'Heavy-duty maintenance-free battery.' }
                  ].map(t => (
                    <button 
                      key={t.label}
                      type="button" 
                      onClick={() => partQuickSelect(t.label, t.cat, t.img, t.price, t.desc)}
                      className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold hover:border-brand-500 transition-colors"
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleAddPart} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Name</label>
                      <Input required className="h-12 bg-slate-50 dark:bg-slate-800 border-none" value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Category</label>
                      <select 
                        className="w-full h-12 rounded-lg bg-slate-50 dark:bg-slate-800 px-4 text-sm font-bold"
                        value={newPart.category}
                        onChange={e => setNewPart({...newPart, category: e.target.value as any})}
                      >
                        <option value="Engine">Engine</option>
                        <option value="Tires">Tires</option>
                        <option value="Brakes">Brakes</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Price (USD)</label>
                      <Input required type="number" className="h-12 bg-slate-50 dark:bg-slate-800 border-none" value={newPart.price} onChange={e => setNewPart({...newPart, price: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Stock Count</label>
                      <Input required type="number" className="h-12 bg-slate-50 dark:bg-slate-800 border-none" value={newPart.stock} onChange={e => setNewPart({...newPart, stock: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Image Source</label>
                    <Input className="h-12 bg-slate-50 dark:bg-slate-800 border-none" placeholder="https://..." value={newPart.image} onChange={e => setNewPart({...newPart, image: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Description</label>
                    <Textarea className="min-h-[100px] bg-slate-50 dark:bg-slate-800 border-none p-4" value={newPart.description} onChange={e => setNewPart({...newPart, description: e.target.value})} />
                  </div>
                  <Button type="submit" size="lg" className="w-full h-14 text-lg font-black uppercase tracking-widest">Register Product</Button>
                </form>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Slide-over Mock */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-950 z-[110] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Your <span className="text-brand-600">Cart</span></h3>
                <button onClick={() => setShowCart(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400"><X /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                    <ShoppingCart className="h-16 w-16 mb-4" />
                    <p className="font-bold">Your cart is empty.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.part.id} className="flex gap-4 group">
                      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden flex-shrink-0">
                        <img 
                          src={item.part.image || getPartPlaceholder(item.part.name)} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getPartPlaceholder(item.part.name);
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm uppercase tracking-tight italic truncate">{item.part.name}</p>
                        <p className="text-xs text-slate-500 font-bold mb-2">{item.quantity} x {formatPrice(item.part.price)}</p>
                        <div className="flex items-center gap-4">
                          <button 
                            className="text-[10px] font-black uppercase text-red-500 hover:underline"
                            onClick={() => removeFromCart(item.part.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="font-black text-slate-900 dark:text-white">
                        {formatPrice(item.part.price * item.quantity)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 space-y-6">
                <div className="flex justify-between items-center">
                  <span className="font-black text-xs uppercase tracking-widest text-slate-500">Subtotal</span>
                  <span className="text-3xl font-black">{formatPrice(totalAmount)}</span>
                </div>
                <Button size="lg" className="w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl shadow-brand-500/20" disabled={cart.length === 0}>
                  Checkout
                </Button>
                <p className="text-[10px] text-center text-slate-400 font-medium">Free on-site delivery for Premium Members.</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsView({ profile }: { profile: UserProfile | null }) {
  const [whatsapp, setWhatsapp] = useState(profile?.whatsappNumber || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        whatsappNumber: whatsapp,
        updatedAt: new Date().toISOString()
      });
      alert("Settings updated successfully!");
    } catch (error) {
      console.error("Save failed", error);
      handleFirestoreError(error as any, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-12">
      <div>
        <h2 className="text-4xl font-black italic uppercase tracking-tighter">Your <span className="text-brand-600">Settings</span></h2>
        <p className="text-slate-500 mt-2">Manage your rescued vehicle profile and communication preferences.</p>
      </div>

      <Card className="p-8 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800">
        <form onSubmit={handleSave} className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-3xl bg-brand-500/10 flex items-center justify-center font-black text-2xl text-brand-600">
                {profile?.displayName ? profile.displayName[0] : 'U'}
              </div>
              <div>
                <h4 className="font-black italic uppercase tracking-tight">{profile?.displayName}</h4>
                <p className="text-sm text-slate-500">{profile?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp Number</label>
              <div className="relative">
                <Input 
                  placeholder="+234..." 
                  value={whatsapp} 
                  onChange={e => setWhatsapp(e.target.value)}
                  className="pl-12 h-14 bg-slate-50 dark:bg-slate-800 border-none"
                />
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Used for direct recovery communications and emergency video calls.</p>
            </div>
          </div>

          <Button type="submit" loading={loading} size="lg" className="w-full h-14 font-black uppercase tracking-widest">
            Save changes
          </Button>
        </form>
      </Card>

      <section className="p-8 bg-slate-100 dark:bg-slate-900/50 rounded-3xl space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest">Membership Status</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
               <Star className="h-5 w-5 text-amber-500 fill-current" />
             </div>
             <div>
               <p className="font-bold text-sm tracking-tight">{profile?.isPremium ? `${profile.plan} Member` : 'Standard Account'}</p>
               <p className="text-[10px] text-slate-500">{profile?.isPremium ? 'Active subscription' : 'Limited recovery speed'}</p>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PublicMapView({ requests, mechanics }: { requests: ServiceRequest[], mechanics: Mechanic[] }) {
  const activeRequests = requests.filter(r => r.status !== 'completed');
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-black tracking-tighter italic uppercase leading-none">
            Live <span className="text-brand-600">Rescue</span> Map
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Real-time status of rescue operations and mobile workshops across the city.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest">{activeRequests.length} Active Jobs</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
             <div className="w-2 h-2 rounded-full bg-green-500" />
             <span className="text-[10px] font-black uppercase tracking-widest">{mechanics.length} Pro-Mechanics</span>
          </div>
        </div>
      </div>

      <Card className="h-[700px] rounded-[2.5rem] border-4 border-white dark:border-slate-800 shadow-2xl relative overflow-hidden">
        <MapContainer 
          center={[4.8156, 7.0498]} 
          zoom={13} 
          className="h-full w-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {mechanics.map((mechanic) => (
            mechanic.location && (
              <Marker 
                key={mechanic.uid} 
                position={[mechanic.location.latitude, mechanic.location.longitude]}
                icon={L.divIcon({
                  html: `<div class="bg-blue-600 p-2 rounded-lg shadow-lg border-2 border-white transform -translate-x-1/2 -translate-y-1/2"><svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg></div>`,
                  className: '',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                })}
              >
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[150px]">
                    <p className="text-[10px] font-black uppercase text-blue-600 mb-1">Mobile Workshop</p>
                    <p className="font-bold text-sm">{mechanic.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 text-amber-500 fill-current" />
                      <span className="text-xs font-bold">4.9</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          {activeRequests.map((req) => (
            <Marker 
              key={req.id} 
              position={[req.location.latitude, req.location.longitude]}
              icon={L.divIcon({
                html: `<div class="bg-brand-600 p-2 rounded-lg shadow-lg border-2 border-white transform -translate-x-1/2 -translate-y-1/2 animate-bounce"><svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12" y2="17.01"></line></svg></div>`,
                className: '',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              })}
            >
              <Popup>
                <div className="p-2 min-w-[150px]">
                  <p className="text-[10px] font-black uppercase text-brand-600 mb-1">Rescue Operation</p>
                  <p className="font-bold text-sm capitalize">{req.carDetails.make} {req.carDetails.model}</p>
                  <div className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest mt-2",
                    req.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {req.status}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        <div className="absolute top-6 left-6 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl z-[1000] max-w-xs pointer-events-none">
          <p className="text-[10px] font-black uppercase tracking-tight text-slate-400 mb-2 underline decoration-brand-500 decoration-2">Tactical Overlay</p>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Live visualization of rescue assets and disabled vehicles. Customer privacy is protected via coordinate fuzzing.</p>
        </div>
      </Card>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
           <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
             <Clock className="h-5 w-5 text-brand-600" />
           </div>
           <h4 className="font-bold mb-2">Real-time Pulse</h4>
           <p className="text-xs text-slate-500 leading-relaxed font-medium">Engine updates every 30 seconds to ensure the most accurate arrival estimates across the network.</p>
        </div>
        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
           <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
             <MapPin className="h-5 w-5 text-brand-600" />
           </div>
           <h4 className="font-bold mb-2">Network Coverage</h4>
           <p className="text-xs text-slate-500 leading-relaxed font-medium">Currently covering Port Harcourt with regional expansions planned into Owerri and Yenagoa.</p>
        </div>
        <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
           <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
             <AlertTriangle className="h-5 w-5 text-brand-600" />
           </div>
           <h4 className="font-bold mb-2">Emergency Hubs</h4>
           <p className="text-xs text-slate-500 leading-relaxed font-medium">Mobile units are strategically positioned near major arteries like Aba Road and East-West Road.</p>
        </div>
      </div>
    </div>
  );
}

function PrivacyView() {
  return (
    <div className="max-w-3xl mx-auto prose dark:prose-invert py-12">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-slate-600 dark:text-slate-400">Last updated: April 12, 2026</p>
      <section className="mt-8 space-y-6">
        <h2 className="text-2xl font-bold">1. Information We Collect</h2>
        <p>We collect information you provide directly to us, such as when you create an account, request a service, or communicate with us. This includes your name, email, phone number, and location data for service dispatch.</p>
        <h2 className="text-2xl font-bold">2. How We Use Your Information</h2>
        <p>We use your information to provide, maintain, and improve our services, including dispatching mechanics to your location and processing payments via Paystack.</p>
        <h2 className="text-2xl font-bold">3. Data Security</h2>
        <p>We implement industry-standard security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>
      </section>
    </div>
  );
}

function TermsView() {
  return (
    <div className="max-w-3xl mx-auto prose dark:prose-invert py-12">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-slate-600 dark:text-slate-400">Last updated: April 12, 2026</p>
      <section className="mt-8 space-y-6">
        <h2 className="text-2xl font-bold">1. Acceptance of Terms</h2>
        <p>By accessing or using AutoBit Rescue, you agree to be bound by these Terms of Service.</p>
        <h2 className="text-2xl font-bold">2. Service Description</h2>
        <p>AutoBit Rescue provides a platform to connect vehicle owners with professional mechanics for maintenance and emergency services.</p>
        <h2 className="text-2xl font-bold">3. Payments</h2>
        <p>Payments for services are processed through Paystack. You agree to pay all charges incurred by you or on your behalf through the service.</p>
      </section>
    </div>
  );
}

function PremiumMembershipView({ user, profile, handleLogin, currency }: { user: any, profile: UserProfile | null, handleLogin: () => void, currency: any }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: 'Basic' | 'Standard' | 'Elite') => {
    if (!user) {
      handleLogin();
      return;
    }
    setLoading(plan);
    try {
      // Mocking Paystack flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      await updateDoc(doc(db, 'users', user.uid), {
        isPremium: true,
        plan: plan,
        premiumUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      alert(`Welcome to the ${plan} Plan! You now have access to exclusive benefits.`);
    } catch (error) {
      console.error("Upgrade failed", error);
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      name: 'Basic' as const,
      price: 5000,
      features: [
        'Standard Dispatch Queue',
        'Transparent Pay-per-job Pricing',
        '24/7 AI Troubleshooting Chat',
        'Safety & Security Guarantees',
        'Digital Service Records'
      ],
      color: 'slate'
    },
    {
      name: 'Standard' as const,
      price: 15000,
      features: [
        'Priority Dispatch (Avg. 15m ETA)',
        '5% Flat Discount on all Spare Parts',
        'Direct Human Admin Chat Access',
        'Smart AI Diagnostics with Repair Logs',
        'Multi-vehicle support (up to 2)',
        'Quarterly Roadside Inspection'
      ],
      color: 'brand',
      recommended: true
    },
    {
      name: 'Elite' as const,
      price: 50000,
      features: [
        'Instant Dispatch (Avg. 10m ETA)',
        '15% Flat Discount on all Spare Parts',
        'Free Monthly On-site Health Check',
        'VIP Direct Line Support (24/7)',
        'Unlimited AI Deep-Scan Diagnostics',
        'Free Recovery/Towing (within 20km)',
        'Personal Dedicated Service Manager'
      ],
      color: 'amber'
    }
  ];

  const comparison = [
    { feature: 'Average Response Time', basic: '30-45m', standard: '15m', elite: '10m' },
    { feature: 'Spare Parts Discount', basic: '0%', standard: '5%', elite: '15%' },
    { feature: 'AI Assistant Access', basic: 'Limited', standard: 'Advanced', elite: 'Unlimited' },
    { feature: 'Human Support', basic: 'Email/Form', standard: 'Live Chat', elite: 'Dedicated Line' },
    { feature: 'Towing Service', basic: 'Full Price', standard: '20% Off', elite: 'Free (20km)' },
    { feature: 'Health Checks', basic: 'Paid', standard: 'Quarterly', elite: 'Monthly' },
  ];

  const formatPrice = (price: number) => {
    // Assuming the input prices are in NGN as requested (15k, 50k, 120k)
    // We convert based on the currency rate if the user is not in Nigeria
    // But since the user specifically gave these numbers, they are likely NGN.
    // If currency is NGN, we show them as is.
    if (currency.code === 'NGN') {
      return `₦${price.toLocaleString()}`;
    }
    // Otherwise convert from NGN (using the rate provided earlier: 1500 NGN = 1 USD)
    return `${currency.symbol}${(price / 1500 * currency.rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-24">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-amber-600 mb-6">
          <Star className="h-3 w-3 fill-current" />
          The Membership Program
        </div>
        <h1 className="text-6xl md:text-7xl font-black mb-6 tracking-tighter italic uppercase leading-[0.8]">Join the <br/><span className="text-brand-600">Elite</span> Circle</h1>
        <p className="text-slate-600 dark:text-slate-400 text-xl max-w-2xl mx-auto font-medium">AutoBit Premium is designed for professional drivers and enthusiasts who value time, reliability, and precision maintenance.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => (
          <motion.div
            key={plan.name}
            whileHover={{ y: -10 }}
            className="h-full"
          >
            <Card 
              className={cn(
                "p-8 h-full flex flex-col relative dark:bg-slate-900 transition-all duration-500",
                plan.recommended ? "border-brand-500 ring-4 ring-brand-500/10 scale-105 z-10 shadow-2xl" : "dark:border-slate-800",
                profile?.plan === plan.name && "border-green-500 ring-4 ring-green-500/10"
              )}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                  Most Popular
                </div>
              )}
              
              <div className="mb-8">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
                  plan.color === 'slate' ? "bg-slate-100 dark:bg-slate-800" :
                  plan.color === 'brand' ? "bg-brand-50 dark:bg-brand-900/20" : "bg-amber-50 dark:bg-amber-900/20"
                )}>
                  {plan.name === 'Basic' && <Zap className="h-6 w-6 text-slate-600" />}
                  {plan.name === 'Standard' && <Activity className="h-6 w-6 text-brand-600" />}
                  {plan.name === 'Elite' && <Star className="h-6 w-6 text-amber-500" />}
                </div>
                <h3 className="text-2xl font-black mb-1 flex items-center gap-2 italic uppercase">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">{formatPrice(plan.price)}</span>
                  <span className="text-slate-500 text-sm font-medium tracking-tight">/mo</span>
                </div>
              </div>

              <ul className="grid gap-4 mb-10 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                    <CheckCircle2 className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      plan.color === 'brand' ? "text-brand-600" : 
                      plan.color === 'amber' ? "text-amber-500" : "text-slate-400"
                    )} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button 
                size="lg"
                className={cn(
                  "w-full rounded-2xl h-14 font-black uppercase tracking-widest transition-all",
                  plan.color === 'slate' ? "bg-slate-800 hover:bg-slate-900 text-white" : 
                  plan.color === 'amber' ? "bg-amber-500 hover:bg-amber-600 text-white" : "shadow-xl shadow-brand-500/20"
                )}
                onClick={() => handleUpgrade(plan.name)} 
                loading={loading === plan.name}
                disabled={profile?.plan === plan.name || (profile?.isPremium && plan.name === 'Basic' && profile.plan !== 'Basic')}
              >
                {profile?.plan === plan.name ? 'Active Plan' : 
                 (profile?.isPremium ? 'Upgrade Now' : 'Join Now')}
              </Button>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Comparison Section */}
      <section className="space-y-12">
        <div className="text-center">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Feature Comparison</h2>
          <p className="text-slate-500 mt-2">See exactly what you get at every level.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-6 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Feature</th>
                <th className="py-6 px-4 text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Basic</th>
                <th className="py-6 px-4 text-xs font-black uppercase tracking-widest text-brand-600">Standard</th>
                <th className="py-6 px-4 text-xs font-black uppercase tracking-widest text-amber-500">Elite</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-5 px-4 font-bold text-sm text-slate-600 dark:text-slate-400">{row.feature}</td>
                  <td className="py-5 px-4 text-sm font-medium text-slate-900 dark:text-slate-100">{row.basic}</td>
                  <td className="py-5 px-4 text-sm font-bold text-slate-900 dark:text-slate-100">{row.standard}</td>
                  <td className="py-5 px-4 text-sm font-black text-slate-900 dark:text-slate-100">{row.elite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="mt-32 pt-16 border-t border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: ShieldCheck, title: "Secured Payments", desc: "Encrypted via Paystack" },
            { icon: Clock, title: "24/7 Availability", desc: "No holidays, no breaks" },
            { icon: Activity, title: "Verified Results", desc: "Real pros, real fixes" },
            { icon: CheckCircle2, title: "Money Back", desc: "If we don't fix, you don't pay" }
          ].map((item, i) => (
            <div key={i} className="text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
                <item.icon className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="font-black text-xs uppercase tracking-tight">{item.title}</p>
                <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
