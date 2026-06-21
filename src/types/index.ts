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
  type_colis?: string;
  statut: 'en_attente' | 'recupere' | 'livre';
  createdAt: string;
  expediteur?: { id: string; nom: string; prenom: string; email: string };
  recepteur?: { id: string; nom: string; prenom: string; email: string };
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
export type TypeReclamation   = 'perdu' | 'endommage' | 'retard' | 'autre';

export interface HistoriqueReclamation {
  statut: StatutReclamation;
  commentaire?: string;
  date: string;
  admin?: string;
}

export interface Reclamation {
  id: string;
  colisReference: string;
  client: { id: string; nom: string; prenom: string; email: string };
  type: TypeReclamation;
  statut: StatutReclamation;
  description: string;
  photos?: string[];
  historique?: HistoriqueReclamation[];
  createdAt: string;
}

export interface Avis {
  id: string;
  colisReference: string;
  client: { id: string; nom: string; prenom: string };
  note: number;
  commentaire?: string;
  createdAt: string;
}

export interface AvisStats {
  moyenne: number;
  total: number;
  distribution: Record<number, number>;
}

export interface AuditLog {
  id: string;
  admin: { id: string; nom: string; prenom: string };
  action: string;
  entite: string;
  entiteId: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface Rapport {
  filename: string;
  mois: string;
  annee: string;
  label: string;
  url?: string;
}

export interface PreuveLivraison {
  id?: string;
  photo?: string;
  lat?: number;
  lng?: number;
  createdAt?: string;
}
