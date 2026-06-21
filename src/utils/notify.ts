import Swal from 'sweetalert2';

const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  customClass: {
    popup: 'swal-nanei-toast',
  },
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export function notifySuccess(message: string) {
  toast.fire({ icon: 'success', title: message });
}

export function notifyError(message: string) {
  toast.fire({ icon: 'error', title: message });
}

export function notifyInfo(message: string) {
  toast.fire({ icon: 'info', title: message });
}
