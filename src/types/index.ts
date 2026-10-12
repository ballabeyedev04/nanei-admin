export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  adresse?: string;
  telephone?: string;
  role: 'Admin' | 'Particulier';
  statut: 'actif' | 'inactif';
  createdAt?: string;
  photoProfil?: string;
}

export interface Colis {
  id: string;
  reference: string;
  poids: number;
  prix: number;
  destination: string;
  description?: string;
  /** Nature du colis, texte libre (« Vêtements »…). */
  type_colis?: string | null;
  /** Mode de transport choisi à l'envoi ; null pour un ancien colis. */
  type_transport?: 'aerien' | 'maritime' | null;
  statut: 'en_attente' | 'recupere' | 'livre';
  createdAt: string;
  // Le back ne renvoie pas l'id des personnes (nom, prénom, e-mail, téléphone).
  expediteur?: { nom: string; prenom: string; email: string; telephone?: string };
  recepteur?: { nom: string; prenom: string; email: string; telephone?: string };
  lot_id?: string | null;
  /** Nombre total de colis du lot (toutes pages), renvoyé par les listes admin. */
  taille_lot?: number;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt?: string;
}

export interface ShippingPrice {
  id: string;
  countryId: string;
  type: 'aérien' | 'maritime';
  minWeight: number;
  maxWeight: number;
  pricePerKg: number;
  country?: Country;
}

export interface ServicePrice {
  id: string;
  serviceType: 'récupération' | 'livraison';
  countryId: string;
  price: number;
  country?: Country;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  identifiant: string;
  mot_de_passe: string;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  success?: boolean;
}

export interface MessageClient {
  id: string;
  email: string;
  objet: string;
  description: string;
  createdAt: string;
}

export interface KpiStats {
  totalClients: number;
  totalAdmins: number;
  totalColis: number;
  colisEnAttente: number;
  colisRecuperes: number;
  colisLivres: number;
}

export type StatutReclamation = 'ouverte' | 'en_cours' | 'resolue' | 'rejetee';
// Valeurs du back : `endommagé` AVEC accent (seule exception aux codes sans accent).
export type TypeReclamation   = 'perdu' | 'endommagé' | 'retard' | 'autre';

/**
 * Réclamation telle qu'affichée par l'admin. Construite par
 * `api/reclamations.ts` à partir de la réponse du back
 * (`colis.reference`, `utilisateur`, `commentaire_admin`).
 */
export interface Reclamation {
  id: string;
  colisReference: string;
  colisDestination?: string;
  client: { nom: string; prenom: string; email: string; telephone?: string };
  type: TypeReclamation;
  statut: StatutReclamation;
  description: string;
  photos: string[];
  /** Dernier commentaire envoyé au client (colonne commentaire_admin). */
  commentaireAdmin?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Avis tel qu'affiché par l'admin, construit par `api/avis.ts`. */
export interface Avis {
  id: string;
  colisReference: string;
  colisDestination?: string;
  client: { nom: string; prenom: string; email?: string };
  note: number;
  commentaire?: string;
  createdAt: string;
}

export interface AvisStats {
  moyenne: number;
  total: number;
  distribution: Record<number, number>;
}

/** Ligne du journal d'audit — noms de champs du back (snake_case). */
export interface AuditLog {
  id: string;
  admin_id?: string | null;
  admin: { nom: string; prenom: string; email?: string } | null;
  action: string;
  entite: string;
  entite_id: string | null;
  details?: Record<string, unknown>;
  ip_address: string | null;
  createdAt: string;
}

export interface Rapport {
  filename: string;
  mois: string | null;
  annee: string | null;
  label: string;
  url?: string;
  taille?: number;
}

/** Preuve de livraison — noms de champs du back. */
export interface PreuveLivraison {
  id?: string;
  colis_id?: string;
  photo_url: string;
  commentaire?: string | null;
  gps_lat?: number | string | null;
  gps_lng?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Métadonnées de pagination renvoyées par le back quand `page`/`limit` sont fournis. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** Une page d'une liste paginée côté serveur. */
export interface PageListe<T> {
  items: T[];
  pagination: Pagination;
}

/** Paramètres communs des listes paginées (`q` : recherche « contient » côté serveur). */
export interface ParamsListe {
  page?: number;
  limit?: number;
  q?: string;
}
