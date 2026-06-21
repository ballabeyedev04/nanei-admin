import Swal from 'sweetalert2';

const base = Swal.mixin({
  customClass: {
    popup:          'swal-nanei-popup',
    title:          'swal-nanei-title',
    htmlContainer:  'swal-nanei-html',
    confirmButton:  'swal-nanei-confirm',
    cancelButton:   'swal-nanei-cancel',
    icon:           'swal-nanei-icon',
  },
  buttonsStyling: false,
  showCancelButton: true,
  cancelButtonText: 'Annuler',
  reverseButtons: true,
  focusConfirm: false,
});

export async function confirmAction(opts: {
  title: string;
  text: string;
  confirmText?: string;
  icon?: 'warning' | 'question' | 'info' | 'error';
}): Promise<boolean> {
  const result = await base.fire({
    title:             opts.title,
    html:              opts.text,
    icon:              opts.icon ?? 'warning',
    confirmButtonText: opts.confirmText ?? 'Confirmer',
  });
  return result.isConfirmed;
}

export async function confirmDeactivate(name: string): Promise<boolean> {
  return confirmAction({
    title:       'Désactiver ce compte ?',
    text:        `<span class="swal-name">${name}</span> ne pourra plus se connecter jusqu'à réactivation.`,
    confirmText: 'Oui, désactiver',
    icon:        'warning',
  });
}

export async function confirmActivate(name: string): Promise<boolean> {
  return confirmAction({
    title:       'Activer ce compte ?',
    text:        `<span class="swal-name">${name}</span> pourra à nouveau accéder à l'application.`,
    confirmText: 'Oui, activer',
    icon:        'question',
  });
}

export async function confirmLogout(): Promise<boolean> {
  return confirmAction({
    title:       'Se déconnecter ?',
    text:        'Vous serez redirigé vers la page de connexion.',
    confirmText: 'Se déconnecter',
    icon:        'question',
  });
}
