/**
 * This client-only module that contains everything related to auth and is used
 * to avoid importing `@webcontainer/api` in the server bundle.
 */

import { auth } from '@webcontainer/api';

if (!import.meta.env.SSR) {
  auth.init({
    clientId: import.meta.env.VITE_WEBCONTAINER_CLIENT_ID || 'Your_Client_ID',
    scope: '',
  });
}

export { auth, type AuthAPI } from '@webcontainer/api';
