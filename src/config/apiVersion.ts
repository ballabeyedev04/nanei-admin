/**
 * Version MINIMALE du contrat d'API (back) dont cette interface a besoin.
 *
 * Le back publie sa propre version de contrat dans `GET /health` :
 * `{ status: 'OK', db: 'ok', version: '<sha>', api: <entier> }`.
 * Avant toute mise en service de l'admin, la chaîne de déploiement
 * (.github/workflows/deploy.yml) refuse de déployer si `api` est absent ou
 * inférieur à cette valeur : il faut alors DÉPLOYER D'ABORD LE BACK.
 *
 * Règle d'incrément (voir docs/DEPLOIEMENT_ADMIN.md) :
 *  - le back incrémente `api` quand il ajoute ou modifie une route, un champ
 *    ou un comportement dont un client peut dépendre ;
 *  - l'admin monte API_VERSION_MIN à cette valeur dans le MÊME changement que
 *    le code qui utilise la nouveauté (jamais avant que le back soit prêt) ;
 *  - une simple correction côté admin ne change pas cette valeur.
 *
 * Lu tel quel par la chaîne (motif `API_VERSION_MIN = <entier>`) : garder un
 * entier littéral sur une seule ligne.
 */
export const API_VERSION_MIN = 2;
