// src/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Your Firebase configuration object goes here
  apiKey: "AIzaSyAilZeVqeHDtyNvznAFGZx9Hr3hbnuwMvM",
  authDomain: "final-56260.firebaseapp.com",
  projectId: "final-56260",
  storageBucket: "final-56260.appspot.com",
  messagingSenderId: "621420677053",
  appId: "1:621420677053:web:ce4695f9623c73cb3174d4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };