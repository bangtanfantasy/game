import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQ6IyV5AlgEmMgGAHbyFzak3g2czYFIr0",
  authDomain: "bts-guesser.firebaseapp.com",
  projectId: "bts-guesser",
  storageBucket: "bts-guesser.firebasestorage.app",
  messagingSenderId: "557127957234",
  appId: "1:557127957234:web:038da28e0142cb427cae6b",
  measurementId: "G-DTT1XHXCQH"
};

const app = initializeApp(firebaseConfig);

// LOGIN SYSTEM
export const auth = getAuth(app);

// DATABASE
export const db = getFirestore(app);


