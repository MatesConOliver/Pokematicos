import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAi9YLbUydV4yDZe64hfUo-btSdo_uYunc",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "pokematicos.firebaseapp.com",
  databaseURL:
    process.env.REACT_APP_FIREBASE_DATABASE_URL ||
    "https://pokematicos-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "pokematicos",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "pokematicos.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "101415606738",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:101415606738:web:c009f17005904490e9d00b",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export default app;
