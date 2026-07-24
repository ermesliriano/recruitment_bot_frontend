// src/lib/featureFlags.js
/**
 * Flags de funcionalidades del frontend.
 *
 * EMAIL_CHANNEL_ENABLED: controla la visibilidad del canal de email
 * (outbound en Carga de CVs, pestaña "Correo de reclutamiento" del perfil de
 * empresa e hilos de email en Conversaciones). El backend conserva toda la
 * funcionalidad; esto solo la oculta en la interfaz mientras no sea funcional.
 * Para reactivar el canal: poner a true.
 */
export const EMAIL_CHANNEL_ENABLED = false;
