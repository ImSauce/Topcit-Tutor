// ============================================================================
// Firebase web configuration
// ----------------------------------------------------------------------------
// These values were taken from Assets/Data/Firebase/google-services.json, which
// is the Android config for the Unity client. They point at the SAME Firebase
// project ("topcittutor"), so the admin portal reads and writes the same data
// the game does.
//
// RECOMMENDED: register a Web App in the Firebase console
//   Firebase Console -> Project settings -> Your apps -> Add app -> Web (</>)
// then paste the generated config over the object below. A dedicated web app
// gives you a proper appId and a browser-scoped API key.
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyBWZVODaMPOPbOQ24RKXxEDntD7xjJjWQM",
  authDomain: "topcittutor.firebaseapp.com",
  projectId: "topcittutor",
  storageBucket: "topcittutor.firebasestorage.app",
  messagingSenderId: "443169109297",
  // appId is only required for Analytics. Auth + Firestore work without it.
  appId: ""
};

// Version of the Firebase JS SDK loaded from the CDN.
export const SDK_VERSION = "11.6.0";
