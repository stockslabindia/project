import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAMFVDS_nETXWSVvgiRipBMtUi2FSCV0G0",
  authDomain: "stocks-lab-india.firebaseapp.com",
  projectId: "stocks-lab-india",
  storageBucket: "stocks-lab-india.firebasestorage.app",
  messagingSenderId: "509042280988",
  appId: "1:509042280988:web:431ab83c0f9e925038edd9"
};

let app;
let auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase initialization error. Make sure you have added your config in firebase.js", error);
}

export { auth };
