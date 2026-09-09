// ============================================================================
// Firebase bootstrap
// ----------------------------------------------------------------------------
// Loads the modular Firebase JS SDK from the CDN and re-exports everything the
// rest of the portal needs, so no other file has to know the CDN URL or SDK
// version. Uses top-level await + dynamic import so the version lives in one
// place (firebase-config.js).
// ============================================================================

import { firebaseConfig, SDK_VERSION } from "./firebase-config.js";

const base = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

const appMod  = await import(`${base}/firebase-app.js`);
const authMod = await import(`${base}/firebase-auth.js`);
const fsMod   = await import(`${base}/firebase-firestore.js`);

// ---- App ------------------------------------------------------------------
export const initializeApp = appMod.initializeApp;
export const deleteApp     = appMod.deleteApp;

export const app  = appMod.initializeApp(firebaseConfig);
export const auth = authMod.getAuth(app);
export const db   = fsMod.getFirestore(app);

export { firebaseConfig };

// ---- Auth -----------------------------------------------------------------
export const getAuth                       = authMod.getAuth;
export const signInWithEmailAndPassword    = authMod.signInWithEmailAndPassword;
export const createUserWithEmailAndPassword = authMod.createUserWithEmailAndPassword;
export const signOut                       = authMod.signOut;
export const onAuthStateChanged            = authMod.onAuthStateChanged;
export const sendPasswordResetEmail        = authMod.sendPasswordResetEmail;
export const updateProfile                 = authMod.updateProfile;

// ---- Firestore ------------------------------------------------------------
export const getFirestore       = fsMod.getFirestore;
export const collection         = fsMod.collection;
export const collectionGroup    = fsMod.collectionGroup;
export const doc                = fsMod.doc;
export const getDoc             = fsMod.getDoc;
export const getDocs            = fsMod.getDocs;
export const setDoc             = fsMod.setDoc;
export const addDoc             = fsMod.addDoc;
export const updateDoc          = fsMod.updateDoc;
export const deleteDoc          = fsMod.deleteDoc;
export const query              = fsMod.query;
export const where              = fsMod.where;
export const orderBy            = fsMod.orderBy;
export const limit              = fsMod.limit;
export const startAfter         = fsMod.startAfter;
export const documentId         = fsMod.documentId;
export const serverTimestamp    = fsMod.serverTimestamp;
export const Timestamp          = fsMod.Timestamp;
export const writeBatch         = fsMod.writeBatch;
export const increment          = fsMod.increment;
export const deleteField        = fsMod.deleteField;
export const getCountFromServer = fsMod.getCountFromServer;
export const onSnapshot         = fsMod.onSnapshot;
export const GeoPoint           = fsMod.GeoPoint;
export const DocumentReference  = fsMod.DocumentReference;
