import { InjectionToken, Provider } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Functions, getFunctions } from 'firebase/functions';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { firebaseConfig } from './firebase.config';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIREBASE_FIRESTORE = new InjectionToken<Firestore>(
  'FIREBASE_FIRESTORE',
);
export const FIREBASE_STORAGE = new InjectionToken<FirebaseStorage>(
  'FIREBASE_STORAGE',
);
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>(
  'FIREBASE_FUNCTIONS',
);

export const firebaseProviders: Provider[] = [
  {
    provide: FIREBASE_APP,
    useFactory: () => initializeApp(firebaseConfig),
  },
  {
    provide: FIREBASE_AUTH,
    deps: [FIREBASE_APP],
    useFactory: (app: FirebaseApp) => getAuth(app),
  },
  {
    provide: FIREBASE_FIRESTORE,
    deps: [FIREBASE_APP],
    useFactory: (app: FirebaseApp) => getFirestore(app),
  },
  {
    provide: FIREBASE_STORAGE,
    deps: [FIREBASE_APP],
    useFactory: (app: FirebaseApp) => getStorage(app),
  },
  {
    provide: FIREBASE_FUNCTIONS,
    deps: [FIREBASE_APP],
    useFactory: (app: FirebaseApp) => getFunctions(app),
  },
];
