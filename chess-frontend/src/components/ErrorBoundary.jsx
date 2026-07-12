/**
 * ErrorBoundary.jsx — Red de seguridad para errores de render.
 *
 * react-chessboard puede lanzar excepciones dentro de <Piece> cuando la
 * posición cambia muy rápido en plena animación. Sin boundary, un error así
 * desmonta TODA la app (pantalla en blanco). Con boundary, solo la vista
 * afectada muestra un aviso con botón de recuperación.
 */

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary capturó:", error, info?.componentStack);
  }

  handleReset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="boundary-fallback">
          <p>⚠ Algo falló al dibujar esta vista.</p>
          <button className="btn btn-newgame" onClick={this.handleReset}>
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
