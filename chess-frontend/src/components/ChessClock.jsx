/**
 * ChessClock.jsx — Reloj de ajedrez para ambos jugadores.
 *
 * Props:
 *   whiteTime    {number|null} — segundos restantes blancas (null = sin límite)
 *   blackTime    {number|null} — segundos restantes negras
 *   activeColor  {string}      — "white" | "black" (quién está contando)
 *   gameOver     {boolean}     — si la partida terminó
 *   timeoutLoser {string|null} — "white" | "black" si alguien perdió por tiempo
 */

const formatTime = (seconds) => {
  if (seconds === null) return "∞";
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const ChessClock = ({ whiteTime, blackTime, activeColor, gameOver, timeoutLoser = null }) => {
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
          timeoutLoser === "black" ? "clock-flagged" : "",
        ].join(" ")}
      >
        <span className="clock-label">♚ Negras</span>
        <span className="clock-time">
          {timeoutLoser === "black" ? "🚩 " : ""}{formatTime(blackTime)}
        </span>
      </div>

      {/* Blancas abajo */}
      <div
        className={[
          "clock-face",
          isWhiteActive ? "clock-active" : "",
          whiteTime <= 10 ? "clock-low" : "",
          timeoutLoser === "white" ? "clock-flagged" : "",
        ].join(" ")}
      >
        <span className="clock-label">♔ Blancas</span>
        <span className="clock-time">
          {timeoutLoser === "white" ? "🚩 " : ""}{formatTime(whiteTime)}
        </span>
      </div>

      {/* Banner de derrota por tiempo */}
      {timeoutLoser && (
        <div className="clock-timeout-banner">
          ⏰ {timeoutLoser === "white" ? "Blancas" : "Negras"} perdieron por tiempo —
          ganan <b>{timeoutLoser === "white" ? "Negras" : "Blancas"}</b>
        </div>
      )}
    </div>
  );
};

export default ChessClock;
