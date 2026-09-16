import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAi9YLbUydV4yDZe64hfUo-btSdo_uYunc",
  authDomain: "pokematicos.firebaseapp.com",
  databaseURL:
    "https://pokematicos-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "pokematicos",
  storageBucket: "pokematicos.firebasestorage.app",
  messagingSenderId: "101415606738",
  appId: "1:101415606738:web:c009f17005904490e9d00b",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export default app;
