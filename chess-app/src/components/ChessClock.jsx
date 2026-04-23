/**
 * ChessClock.jsx — Reloj de ajedrez para ambos jugadores.
 *
 * Props:
 *   whiteTime   {number|null} — segundos restantes blancas (null = sin límite)
 *   blackTime   {number|null} — segundos restantes negras
 *   activeColor {string}      — "white" | "black" (quién está contando)
 *   gameOver    {boolean}     — si la partida terminó
 */

const formatTime = (seconds) => {
  if (seconds === null) return "∞";
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const ChessClock = ({ whiteTime, blackTime, activeColor, gameOver }) => {
  if (whiteTime === null) return null;

  const isBlackActive = activeColor === "black" && !gameOver;
  const isWhiteActive = activeColor === "white" && !gameOver;

  return (
    <div className="chess-clock">
      {/* Negras arriba (orientación estándar) */}
      <div
        className={[
          "clock-face",
          isBlackActive ? "clock-active" : "",
          blackTime <= 10 ? "clock-low" : "",
        ].join(" ")}
      >
        <span className="clock-label">♚ Negras</span>
        <span className="clock-time">{formatTime(blackTime)}</span>
      </div>

      {/* Blancas abajo */}
      <div
        className={[
          "clock-face",
          isWhiteActive ? "clock-active" : "",
          whiteTime <= 10 ? "clock-low" : "",
        ].join(" ")}
      >
        <span className="clock-label">♔ Blancas</span>
        <span className="clock-time">{formatTime(whiteTime)}</span>
      </div>
    </div>
  );
};

export default ChessClock;
