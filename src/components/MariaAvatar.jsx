import { useState } from "react";

/**
 * Avatar circular de María.
 *
 * Intenta cargar la imagen oficial desde /maria-avatar.png (colocar el asset
 * oficial en la carpeta public/ del proyecto). Mientras no exista, muestra un
 * placeholder con la inicial "M" sobre el acento de marca.
 */
export default function MariaAvatar({ size = 40, className = "" }) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`maria-avatar ${className}`.trim()}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-label="María, asistente de reclutamiento"
      role="img"
    >
      {failed ? (
        "M"
      ) : (
        <img
          src="/maria-avatar.png"
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
