/**
 * Version de l'application embarquée à la construction : le sha du commit
 * (variable VITE_APP_VERSION fournie par la chaîne de déploiement), ou `dev`
 * en local. Le même sha est publié dans /version.json, que la chaîne relit
 * après la mise en ligne pour vérifier ce qui est réellement servi.
 */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';
