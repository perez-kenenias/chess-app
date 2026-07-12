/**
 * NotationGlossary.jsx — Modal de ayuda con el glosario de notación.
 *
 * Explica las letras de las piezas (inglés vs español), los símbolos del
 * SAN (x, +, #, O-O...) y los íconos de calificación del análisis.
 * Se abre desde el botón "❓ Notación" del header.
 */

import { GLOSSARY } from "../utils/notation";

export default function NotationGlossary({ open, onClose, spanish }) {
  if (!open) return null;

  return (
    <div className="glossary-overlay" onClick={onClose}>
      <div className="glossary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="glossary-header">
          <h3>❓ Glosario de notación</h3>
          <button className="glossary-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className="glossary-intro">
          Estás viendo la notación en <b>{spanish ? "español (C = Caballo)" : "inglés (N = Knight)"}</b>.
          Puedes cambiarla con el botón <b>{spanish ? "ES" : "EN"}</b> del encabezado.
        </p>

        <h4>Letras de las piezas</h4>
        <table className="glossary-table">
          <thead>
            <tr><th></th><th>Inglés</th><th>Español</th><th>Pieza</th></tr>
          </thead>
          <tbody>
            {GLOSSARY.piezas.map((p) => (
              <tr key={p.name}>
                <td className="glossary-symbol">{p.symbol}</td>
                <td className={!spanish ? "glossary-active" : ""}>{p.en}</td>
                <td className={spanish ? "glossary-active" : ""}>{p.es}</td>
                <td>{p.name}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Símbolos</h4>
        <table className="glossary-table">
          <tbody>
            {GLOSSARY.simbolos.map((s) => (
              <tr key={s.sym}>
                <td className="glossary-symbol">{s.sym}</td>
                <td>{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Calificación de jugadas (análisis)</h4>
        <table className="glossary-table">
          <tbody>
            {GLOSSARY.calificaciones.map((c) => (
              <tr key={c.sym}>
                <td className="glossary-symbol">{c.sym}</td>
                <td>{c.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Ejemplos</h4>
        <table className="glossary-table">
          <thead>
            <tr><th>Inglés</th><th>Español</th><th>Significado</th></tr>
          </thead>
          <tbody>
            {GLOSSARY.ejemplos.map((e) => (
              <tr key={e.en}>
                <td className={!spanish ? "glossary-active" : ""}>{e.en}</td>
                <td className={spanish ? "glossary-active" : ""}>{e.es}</td>
                <td>{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
