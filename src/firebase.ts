import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBj2zIewxaNVt68f_ooIKITqvtZ1h0ht4I",
  authDomain: "sero-6db23.firebaseapp.com",
  projectId: "sero-6db23",
  storageBucket: "sero-6db23.appspot.com",
  messagingSenderId: "1026077313908",
  appId: "1:1026077313908:web:33fc29d3bf4ce58856fa21",
  measurementId: "G-W5XC0WY469"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);