import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';

const firebaseConfig ={
    apiKey: "AIzaSyDrnMb_p618xyXXvVVEn4kl1ej-cDNrYjk",
    authDomain: "synapse-8f371.firebaseapp.com",
    projectId: "synapse-8f371",
    storageBucket: "synapse-8f371.firebasestorage.app",
    messagingSenderId: "862000804017",
    appId: "1:862000804017:web:32373eca5767a2168eb290",
    measurementId: "G-GY6SQF7QJS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);