export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}

export function getInitials(nom: string, prenom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();
}
