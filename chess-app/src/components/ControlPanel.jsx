/**
 * ControlPanel.jsx — Panel de configuración y controles
 *
 * ¿Qué hace este componente?
 * Muestra todos los controles del juego:
 *   1. Nivel del bot (slider 0-20)
 *   2. Color del jugador (blancas o negras)
 *   3. Settings del tablero:
 *      - Coordenadas en los bordes (a-h / 1-8)
 *      - Nombre algebraico dentro de cada casilla (a1, e4, etc.)
 *      - Última jugada en algebraico (muestra "e2 → e4 (e4)")
 *   4. Botón de pista
 *   5. Botón de nueva partida
 *
 * Props — datos que recibe de App.jsx:
 *   settings          {object}   — objeto con todos los toggles del tablero
 *   onSettingChange   {Function} — cuando el usuario cambia un toggle
 *   skillLevel        {number}   — nivel actual 0-20
 *   onSkillChange     {Function} — cuando mueve el slider
 *   playerColor       {string}   — "white" o "black"
 *   onColorChange     {Function} — cuando elige otro color
 *   onHint            {Function} — cuando presiona "Pedir pista"
 *   onNewGame         {Function} — cuando presiona "Nueva partida"
 *   gameStatus        {object}   — turno, jaque, si terminó
 *   hintMove          {object}   — pista actual { from_square, to_square }
 *   lastMoveSan       {string}   — última jugada en algebraico ej: "Nf3"
 */

/**
 * getLevelInfo — convierte el número 0-20 en texto descriptivo.
 * Así el jugador sabe contra qué nivel se enfrenta.
 */
const getLevelInfo = (level) => {
  if (level <= 4)  return { label: "Principiante", elo: "~500",  color: "#4ade80" };
  if (level <= 8)  return { label: "Casual",       elo: "~1000", color: "#a3e635" };
  if (level <= 13) return { label: "Intermedio",   elo: "~1600", color: "#facc15" };
  if (level <= 17) return { label: "Avanzado",     elo: "~2200", color: "#fb923c" };
  return             { label: "Maestro",            elo: "~3600", color: "#f87171" };
};

/**
 * Toggle — componente pequeño reutilizable para los switches on/off.
 * En React puedes crear componentes pequeños dentro del mismo archivo.
 *
 * Props:
 *   checked  {boolean}  — si está activado
 *   onChange {Function} — qué hacer cuando cambia
 */
const Toggle = ({ checked, onChange, disabled = false }) => (
  <div
    className={`toggle ${checked ? "toggle--on" : ""} ${disabled ? "toggle--disabled" : ""}`}
    onClick={() => !disabled && onChange(!checked)}
    role="switch"
    aria-checked={checked}
  >
    <div className="toggle-thumb" />
  </div>
);

/**
 * SettingRow — una fila de setting con label, descripción y toggle.
 * También reutilizable dentro de este archivo.
 */
const SettingRow = ({ label, description, checked, onChange, disabled }) => (
  <label className="setting-row">
    <div className="setting-info">
      <span className="setting-label">{label}</span>
      {description && (
        <span className="setting-desc">{description}</span>
      )}
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </label>
);

const CLOCK_OPTIONS = [
  { label: "1'",  minutes: 1  },
  { label: "3'",  minutes: 3  },
  { label: "5'",  minutes: 5  },
  { label: "10'", minutes: 10 },
  { label: "30'", minutes: 30 },
  { label: "∞",   minutes: 0  },
];

const ControlPanel = ({
  settings = {},
  onSettingChange,
  skillLevel = 10,
  onSkillChange,
  playerColor = "white",
  onColorChange,
  onHint,
  onNewGame,
  analysisMode = false,
  onToggleAnalysis,
  gameStatus = {},
  hintMove = null,
  lastMoveSan = null,
  clockMinutes = 0,
  onClockChange,
  gmCommentaryEnabled = true,
  onToggleGmCommentary,
}) => {
  const { label, elo, color } = getLevelInfo(skillLevel);
  const { turn, inCheck, gameOver, isThinking } = gameStatus;

  /**
   * Determina el texto de estado de la partida.
   * Orden de prioridad: game over > pensando > jaque > turno normal
   */
  const statusText = gameOver
    ? "Partida terminada"
    : isThinking
    ? "Stockfish pensando..."
    : inCheck
    ? `¡Jaque! Turno: ${turn === "w" ? "Blancas" : "Negras"}`
    : `Turno: ${turn === "w" ? "Blancas" : "Negras"}`;

  const statusClass = gameOver
    ? "status--over"
    : inCheck
    ? "status--check"
    : isThinking
    ? "status--thinking"
    : "status--ok";

  return (
    <div className="control-panel">

      {/* ── 1. Estado de la partida ── */}
      <div className={`game-status ${statusClass}`}>
        <div className="status-dot" />
        <span className="status-text">{statusText}</span>
      </div>

      {/* ── 2. Última jugada en algebraico ── */}
      {/*
        Aquí mostramos la última jugada en notación algebraica.
        Si settings.showLastMoveSan es true y hay una jugada,
        la mostramos como: ♟ e4   (o Nf3, O-O, etc.)

        {lastMoveSan && (...)} es la forma de React de decir
        "solo renderiza esto si lastMoveSan existe"
      */}
      {settings.showLastMoveSan && lastMoveSan && (
        <div className="last-move-display">
          <span className="last-move-label">Última jugada</span>
          <span className="last-move-san">{lastMoveSan}</span>
        </div>
      )}

      {/* ── 3. Nivel del bot ── */}
      <div className="panel-section">
        <div className="section-header">
          <span className="section-title">Nivel del bot</span>
          <span className="level-badge" style={{ color }}>
            {label} · {elo} Elo
          </span>
        </div>

        {/*
          input type="range" = slider de HTML nativo.
          min, max, value: rango y valor actual.
          onChange: se ejecuta cada vez que el usuario mueve el slider.
          e.target.value devuelve string, por eso Number() lo convierte.
        */}
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={skillLevel}
          onChange={(e) => onSkillChange(Number(e.target.value))}
          className="level-slider"
          disabled={isThinking}
          style={{
            // Actualiza el gradiente del slider según el valor actual
            background: `linear-gradient(to right, ${color} 0%, ${color} ${(skillLevel / 20) * 100}%, #2a2a2a ${(skillLevel / 20) * 100}%)`,
          }}
        />

        <div className="level-scale">
          <span>Fácil</span>
          <span className="level-value">{skillLevel} / 20</span>
          <span>Maestro</span>
        </div>
      </div>

      {/* ── 4. Color del jugador ── */}
      <div className="panel-section">
        <div className="section-header">
          <span className="section-title">Juegas con</span>
        </div>

        <div className="color-picker">
          {/*
            Los botones de color llaman a onColorChange con "white" o "black".
            La clase --active se agrega cuando el color coincide con playerColor.
            className={`color-btn ${condition ? "active-class" : ""}`}
            es la forma estándar de clases condicionales en React.
          */}
          <button
            className={`color-btn ${playerColor === "white" ? "color-btn--active" : ""}`}
            onClick={() => onColorChange("white")}
            disabled={isThinking}
          >
            <span className="piece-icon piece-white">♔</span>
            <span>Blancas</span>
          </button>
          <button
            className={`color-btn ${playerColor === "black" ? "color-btn--active" : ""}`}
            onClick={() => onColorChange("black")}
            disabled={isThinking}
          >
            <span className="piece-icon piece-black">♚</span>
            <span>Negras</span>
          </button>
        </div>
      </div>

      {/* ── 5. Settings del tablero ── */}
      <div className="panel-section">
        <div className="section-header">
          <span className="section-title">Tablero</span>
        </div>

        {/*
          Cada SettingRow corresponde a un toggle en el objeto 'settings'.
          onSettingChange("showCoordinates", nuevoValor) le avisa a App.jsx
          que cambió ese setting específico.
        */}

        {/* Toggle 1: Coordenadas en los bordes (a-h y 1-8) */}
        <SettingRow
          label="Coordenadas en bordes"
          description="Muestra a-h y 1-8 en los bordes del tablero"
          checked={settings.showCoordinates ?? true}
          onChange={(val) => onSettingChange("showCoordinates", val)}
        />

        {/* Toggle 2: Nombre de casilla dentro de cada celda */}
        <SettingRow
          label="Nombre de casilla"
          description="Muestra e4, d5, etc. dentro de cada casilla"
          checked={settings.showSquareLabels ?? false}
          onChange={(val) => onSettingChange("showSquareLabels", val)}
        />

        {/* Toggle 3: Última jugada en algebraico (en el panel) */}
        <SettingRow
          label="Jugada en algebraico"
          description="Muestra la última jugada: e4, Nf3, O-O..."
          checked={settings.showLastMoveSan ?? true}
          onChange={(val) => onSettingChange("showLastMoveSan", val)}
        />

        {/* Toggle 4: Comentario GM (consume tokens de la API de Anthropic) */}
        <SettingRow
          label="🎓 Comentario GM"
          description="Análisis IA de cada jugada — usa tokens de Anthropic"
          checked={gmCommentaryEnabled}
          onChange={() => onToggleGmCommentary?.()}
        />

      </div>

      {/* ── 6. Pista activa ── */}
      {/*
        Este bloque SOLO se renderiza si hintMove existe.
        En React, {condition && <JSX>} no renderiza nada si condition es falso.
      */}
      {hintMove && (
        <div className="hint-box">
          <span className="hint-icon">💡</span>
          <div className="hint-content">
            <span className="hint-label">Pista de Stockfish</span>
            <span className="hint-move">
              {hintMove.from_square?.toUpperCase()} → {hintMove.to_square?.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* ── 6b. Selector de reloj ── */}
      <div className="panel-section">
        <div className="section-header">
          <span className="section-title">Reloj</span>
          {clockMinutes > 0 && (
            <span style={{ fontSize: 10, color: "var(--gold)" }}>{clockMinutes} min</span>
          )}
        </div>
        <div className="clock-opts">
          {CLOCK_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              className={`clock-opt-btn ${clockMinutes === opt.minutes ? "clock-opt-active" : ""}`}
              onClick={() => onClockChange?.(opt.minutes)}
              disabled={isThinking}
              title={opt.minutes === 0 ? "Sin límite de tiempo" : `${opt.minutes} minutos por jugador`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 7. Botones de acción ── */}
      <div className="action-btns">
        <button
          className="btn btn-hint"
          onClick={onHint}
          disabled={isThinking || gameOver || analysisMode}
        >
          💡 Pedir pista
        </button>

        <button
          className={`btn btn-analysis${analysisMode ? " btn-analysis--active" : ""}`}
          onClick={onToggleAnalysis}
          title="Modo análisis: mueves ambos colores tú mismo. Las sugerencias aparecen en cada turno para que puedas seguir partidas de GM."
        >
          {analysisMode ? "⚡ Análisis activo" : "⚡ Modo análisis"}
        </button>

        <button
          className="btn btn-newgame"
          onClick={onNewGame}
        >
          ♟ Nueva partida
        </button>
      </div>

    </div>
  );
};

export default ControlPanel;
