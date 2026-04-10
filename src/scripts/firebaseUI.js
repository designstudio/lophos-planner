import { auth } from './firebase.js';
import firebaseui from "firebaseui";

let ui = new firebaseui.auth.AuthUI(auth);

ui.start('#firebaseui-auth-container', {
    signInOptions: [
        // List of OAuth providers supported.
        auth.GoogleAuthProvider.PROVIDER_ID,
    ],
    // Other config options...
});
