import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCBtWtzcHY6D07k8KdSJRU8im2BjtctfbE",
  authDomain: "activity-tracker-1fbb2.firebaseapp.com",
  projectId: "activity-tracker-1fbb2",
  storageBucket: "activity-tracker-1fbb2.firebasestorage.app",
  messagingSenderId: "821951458083",
  appId: "1:821951458083:web:81a3b033e5266e2af8fa96",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
