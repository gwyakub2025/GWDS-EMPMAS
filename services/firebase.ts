import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import * as XLSX from 'xlsx';

// --- Configuration & Environment ---

const getEnv = (key: string) => {
  const meta = import.meta as any;
  if (meta && meta.env && meta.env[key]) {
    return meta.env[key];
  }
  // Fallback for some environments where VITE_ vars might be directly on process.env
  try {
     // @ts-ignore
     if (typeof process !== 'undefined' && process.env && process.env[key]) {
        // @ts-ignore
        return process.env[key];
     }
  } catch (e) {}
  return undefined;
};

const apiKey = getEnv('VITE_FIREBASE_API_KEY');
const hasFirebaseConfig = !!apiKey && apiKey !== 'undefined';

// --- Firebase Instances ---
let app: any;
let auth: any;
let db: any;
let storage: any;

if (hasFirebaseConfig) {
  try {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnv('VITE_FIREBASE_APP_ID')
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (e) {
    console.error("Firebase Initialization Failed:", e);
  }
}

// --- Types ---
export interface CompanyMeta {
  id: string;
  name: string;
  storagePath: string | null; // Null if created but no file uploaded yet
  uploadDate: string | null;
  uploadedBy: string;
  hasData: boolean;
}

export interface SystemUser {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  password?: string;
}

// --- Mock State (In-Memory & LocalStorage) ---
let mockUser: any = null;
const mockAuthListeners: ((user: any) => void)[] = [];

// Load users from localStorage or initialize with Admin
const loadMockUsers = (): SystemUser[] => {
  const stored = localStorage.getItem('mock_users_db');
  if (stored) {
    return JSON.parse(stored);
  }
  return [
    { uid: 'admin-123', email: 'admin@empmas.com', password: 'admin123', role: 'admin' }
  ];
};

let mockUsersDB: SystemUser[] = loadMockUsers();

const saveMockUsers = () => {
  localStorage.setItem('mock_users_db', JSON.stringify(mockUsersDB));
};

// Load companies from localStorage (purging any legacy dummy values)
const loadMockCompanies = (): CompanyMeta[] => {
  try {
    const stored = localStorage.getItem('mock_companies_db');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Strip out any legacy dummy sample data if previously persisted
        const cleaned = parsed.filter((c: any) => c.id !== 'comp-default' && !c.name?.includes('Al Habtoor') && !c.name?.includes('MoHRE Census'));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('mock_companies_db', JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error("Failed to parse mock companies", e);
  }
  return [];
};

let mockCompanies: CompanyMeta[] = loadMockCompanies();

const saveMockCompanies = () => {
  try {
    localStorage.setItem('mock_companies_db', JSON.stringify(mockCompanies));
  } catch (e) {
    console.error("Failed to save mock companies", e);
  }
};

const mockFileStorage: Record<string, ArrayBuffer> = {};

const saveFileBuffer = (path: string, buffer: ArrayBuffer) => {
  mockFileStorage[path] = buffer;
  try {
    if (buffer.byteLength < 5 * 1024 * 1024) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      sessionStorage.setItem(`file_${path}`, btoa(binary));
    }
  } catch (e) {}
};

const getFileBuffer = (path: string): ArrayBuffer | null => {
  if (mockFileStorage[path]) return mockFileStorage[path];
  try {
    const cached = sessionStorage.getItem(`file_${path}`);
    if (cached) {
      const binary = atob(cached);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      mockFileStorage[path] = bytes.buffer;
      return bytes.buffer;
    }
  } catch (e) {}
  return null;
};

// --- Facade Methods ---

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  if (hasFirebaseConfig && auth) {
    return onAuthStateChanged(auth, callback);
  } else {
    // Mock Subscription
    mockAuthListeners.push(callback);
    callback(mockUser);
    return () => {
      const idx = mockAuthListeners.indexOf(callback);
      if (idx > -1) mockAuthListeners.splice(idx, 1);
    };
  }
};

export const login = async (email: string, password: string): Promise<void> => {
  if (hasFirebaseConfig && auth) {
    await signInWithEmailAndPassword(auth, email, password);
  } else {
    if (!email || !password) throw new Error("Invalid credentials");
    const user = mockUsersDB.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) throw new Error("Invalid email or password.");
    await new Promise(r => setTimeout(r, 800));
    mockUser = { 
      uid: user.uid, 
      email: user.email, 
      displayName: user.email.split('@')[0] 
    };
    mockAuthListeners.forEach(cb => cb(mockUser));
  }
};

export const logout = async (): Promise<void> => {
  if (hasFirebaseConfig && auth) {
    await signOut(auth);
  } else {
    mockUser = null;
    mockAuthListeners.forEach(cb => cb(null));
  }
};

// --- User Management (Mock Only for now) ---

export const fetchSystemUsers = async (): Promise<SystemUser[]> => {
  return mockUsersDB.map(u => ({ uid: u.uid, email: u.email, role: u.role }));
};

export const createSystemUser = async (email: string, password: string) => {
  if (mockUsersDB.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("User with this email already exists.");
  }
  const newUser: SystemUser = {
    uid: `user-${Date.now()}`,
    email,
    password,
    role: 'user'
  };
  mockUsersDB.push(newUser);
  saveMockUsers();
  return newUser;
};

export const deleteSystemUser = async (uid: string) => {
  if (uid === 'admin-123') throw new Error("Cannot delete the root administrator.");
  mockUsersDB = mockUsersDB.filter(u => u.uid !== uid);
  saveMockUsers();
};

// --- Data Methods ---

/**
 * Creates a new Company Entity (Shell) without data.
 */
export const createCompanyEntity = async (name: string, userId: string): Promise<CompanyMeta> => {
  if (hasFirebaseConfig && db) {
    const meta: Omit<CompanyMeta, 'id'> = {
        name,
        storagePath: null,
        uploadDate: null,
        uploadedBy: userId,
        hasData: false
    };
    const docRef = await addDoc(collection(db, "companies"), meta);
    return { id: docRef.id, ...meta };
  } else {
    // Mock
    const mockId = `comp-${Date.now()}`;
    const meta: CompanyMeta = {
        id: mockId,
        name,
        storagePath: null,
        uploadDate: null,
        uploadedBy: userId,
        hasData: false
    };
    mockCompanies.unshift(meta);
    saveMockCompanies();
    return meta;
  }
};

/**
 * Uploads file to an EXISTING company, overwriting previous data.
 */
export const uploadCompanyData = async (file: File, companyId: string, userId: string): Promise<void> => {
  if (hasFirebaseConfig && storage && db) {
    // 1. Get existing company to find old file path
    // (Skipping fetch implementation for brevity in this snippet, assuming overwrite by new path reference or managing deletions)
    
    // 2. Upload new file
    const storagePath = `companies/${userId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    
    // 3. Update Company Doc
    const companyRef = doc(db, "companies", companyId);
    await updateDoc(companyRef, {
        storagePath: storagePath,
        uploadDate: new Date().toISOString(),
        uploadedBy: userId,
        hasData: true
    });

  } else {
    // Mock Upload with Overwrite
    await new Promise(r => setTimeout(r, 600));
    
    const companyIndex = mockCompanies.findIndex(c => c.id === companyId);
    if (companyIndex === -1) throw new Error("Company not found");

    const company = mockCompanies[companyIndex];

    // If there was an old file, 'delete' it from mock storage
    if (company.storagePath) {
        delete mockFileStorage[company.storagePath];
        try { sessionStorage.removeItem(`file_${company.storagePath}`); } catch (e) {}
    }

    // Create new path
    const newStoragePath = `mock/${companyId}/${Date.now()}_${file.name}`;
    
    // Save file buffer
    const arrayBuffer = await file.arrayBuffer();
    saveFileBuffer(newStoragePath, arrayBuffer);

    // Update Metadata
    mockCompanies[companyIndex] = {
        ...company,
        storagePath: newStoragePath,
        uploadDate: new Date().toISOString(),
        uploadedBy: userId,
        hasData: true
    };
    saveMockCompanies();
  }
};

/**
 * Legacy support for Master Sheet (if needed) or can be removed.
 * Kept for safety but not used in new flow.
 */
export const uploadMasterSheet = async (file: File, userId: string): Promise<number> => {
    return 0;
}

export const fetchCompanies = async (): Promise<CompanyMeta[]> => {
  if (hasFirebaseConfig && db) {
    const q = query(collection(db, "companies"), orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyMeta));
  } else {
    return [...mockCompanies].sort((a, b) => a.name.localeCompare(b.name));
  }
};

export const deleteCompanyData = async (id: string, storagePath: string | null) => {
  if (hasFirebaseConfig && db && storage) {
    if (storagePath) {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef).catch(e => console.warn("File might not exist", e));
    }
    await deleteDoc(doc(db, "companies", id));
  } else {
    mockCompanies = mockCompanies.filter(c => c.id !== id);
    saveMockCompanies();
    if (storagePath) {
      delete mockFileStorage[storagePath];
      try { sessionStorage.removeItem(`file_${storagePath}`); } catch (e) {}
    }
  }
};

export const downloadCompanyFile = async (storagePath: string | null): Promise<ArrayBuffer> => {
  if (!storagePath) throw new Error("No data uploaded for this company.");

  if (hasFirebaseConfig && storage) {
    const pathReference = ref(storage, storagePath);
    const url = await getDownloadURL(pathReference);
    const response = await fetch(url);
    return await response.arrayBuffer();
  } else {
    const buffer = getFileBuffer(storagePath);
    if (buffer) return buffer;
    throw new Error("File not found in local storage");
  }
};