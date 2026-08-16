import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

const CHARACTERS = [
  { id: 'hijo1', name: 'Lucio', avatar: '/hijo1.png' },
  { id: 'hijo2', name: 'Santino', avatar: '/hijo2.png' },
];

const GAME_DURATION = 60; // Tiempo total en segundos por partida

export default function App() {
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [gameState, setGameState] = useState('SELECT'); // 'SELECT' | 'PLAYING' | 'GAMEOVER' | 'TIMEUP'
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [message, setMessage] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);

  // Capturar evento de instalación / descarga de la App
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDownloadApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('Para instalar la App:\n• En Chrome/Edge: Haz clic en el ícono de instalación (📥) en la barra de direcciones.\n• En celular: Selecciona "Agregar a la pantalla principal".');
    }
  };

  // Temporizador del juego
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('TIMEUP');
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // Bucle principal de físicas e interacción
  useEffect(() => {
    if (gameState !== 'PLAYING' || !selectedCharacter) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const headImg = new Image();
    headImg.src = selectedCharacter.avatar;

    let x = 100;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let angle = 0;
    let angularVelocity = 0;
    let isGrounded = false;
    let currentLives = lives;
    let currentScore = score;

    // Lista de ítems recolectables (monedas/estrellas)
    let coins = [];

    const keys = {};

    const handleKeyDown = (e) => (keys[e.key] = true);
    const handleKeyUp = (e) => (keys[e.key] = false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const getTerrainHeight = (posX) => {
      return (
        canvas.height -
        120 +
        Math.sin(posX * 0.008) * 45 +
        Math.sin(posX * 0.02) * 20
      );
    };

    const getTerrainAngle = (posX) => {
      const delta = 5;
      const y1 = getTerrainHeight(posX - delta);
      const y2 = getTerrainHeight(posX + delta);
      return Math.atan2(y2 - y1, delta * 2);
    };

    // Generar monedas sobre el camino
    const spawnCoinInterval = setInterval(() => {
      const coinX = x + 300 + Math.random() * 200;
      const coinY = getTerrainHeight(coinX) - 30 - Math.random() * 40;
      coins.push({ x: coinX, y: coinY, radius: 10, collected: false });
    }, 1500);

    const loop = () => {
      const terrainY = getTerrainHeight(x);
      const targetAngle = getTerrainAngle(x);

      // --- CONTROLES DE ACELERACIÓN Y DIRECCIÓN ---
      if (keys['ArrowRight'] || keys['d']) {
        if (isGrounded) vx += 0.15;
        angularVelocity += 0.005;
      } else if (keys['ArrowLeft'] || keys['a']) {
        if (isGrounded) vx -= 0.1;
        angularVelocity -= 0.005;
      } else if (isGrounded) {
        vx *= 0.98;
      }

      // --- SALTO ---
      if ((keys[' '] || keys['ArrowUp'] || keys['w']) && isGrounded) {
        vy = -8.5;
        isGrounded = false;
      }

      vy += 0.35;
      y += vy;

      if (y >= terrainY - 15) {
        if (!isGrounded && vy > 0) isGrounded = true;
        y = terrainY - 15;
        vy = 0;
      } else {
        isGrounded = false;
      }

      vx = Math.max(-2, Math.min(vx, 8));

      x += vx;
      if (x < 50) {
        x = 50;
        vx = 0;
      }

      angle += angularVelocity;

      if (isGrounded) {
        angle += (targetAngle - angle) * 0.15;
        angularVelocity *= 0.7;
      } else {
        angularVelocity *= 0.95;
      }

      // --- RECOLECTAR MONEDAS / PUNTOS ---
      coins.forEach((coin) => {
        if (!coin.collected) {
          const dist = Math.hypot(x - coin.x, y - coin.y);
          if (dist < 30) {
            coin.collected = true;
            currentScore += 50;
            setScore(currentScore);
          }
        }
      });

      // --- COLISIÓN / VUELCO ---
      const angleDiff = Math.abs(angle - targetAngle);
      if (angleDiff > Math.PI / 2.1 && isGrounded) {
        currentLives -= 1;
        setLives(currentLives);

        if (currentLives > 0) {
          setMessage('¡Cuidado! Te volcaste (-1 Vida)');
          x = Math.max(100, x - 150);
          vx = 0;
          vy = 0;
          y = getTerrainHeight(x) - 15;
          angle = getTerrainAngle(x);
          angularVelocity = 0;
        } else {
          setGameState('GAMEOVER');
          return;
        }
      }

      // --- DIBUJAR PANTALLA ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cameraOffset = x - 150;

      // Cielo
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Terreno
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);

      for (let px = 0; px <= canvas.width + 10; px += 5) {
        const worldX = px + cameraOffset;
        const worldY = getTerrainHeight(worldX);
        ctx.lineTo(px, worldY);
      }

      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 4;
      ctx.stroke();

      // DIBUJAR MONEDAS / PUNTOS
      coins.forEach((coin) => {
        if (!coin.collected) {
          const screenCoinX = coin.x - cameraOffset;
          if (screenCoinX > -20 && screenCoinX < canvas.width + 20) {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(screenCoinX, coin.y, coin.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });

      // DIBUJAR BICICLETA Y PILOTO
      const screenX = x - cameraOffset;
      const screenY = y;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);

      // Ruedas
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(-20, 10, 10, 0, Math.PI * 2);
      ctx.arc(20, 10, 10, 0, Math.PI * 2);
      ctx.fill();

      // Cuadro
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, 10);
      ctx.lineTo(0, 10);
      ctx.lineTo(10, -5);
      ctx.lineTo(-10, -5);
      ctx.closePath();
      ctx.moveTo(0, 10);
      ctx.lineTo(-10, -5);
      ctx.moveTo(10, -5);
      ctx.lineTo(20, 10);
      ctx.stroke();

      // Cuerpo
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.lineTo(-2, -22);
      ctx.lineTo(8, -12);
      ctx.stroke();

      // Cabeza / Avatar
      if (headImg.complete) {
        ctx.drawImage(headImg, -20, -48, 35, 35);
      }

      ctx.restore();

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(gameLoopRef.current);
      clearInterval(spawnCoinInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, selectedCharacter]);

  const startGame = () => {
    setLives(3);
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setMessage('');
    setGameState('PLAYING');
  };

  return (
    <div style={styles.container}>
      {gameState === 'SELECT' && (
        <div style={styles.card}>
          <h1 style={styles.title}>🚴 Desafío por Tiempo y Puntos ⏱️</h1>
          <p>Suma la mayor cantidad de puntos antes de que el tiempo se agote:</p>
          <div style={styles.characterGrid}>
            {CHARACTERS.map((char) => (
              <div
                key={char.id}
                onClick={() => setSelectedCharacter(char)}
                style={{
                  ...styles.characterCard,
                  borderColor: selectedCharacter?.id === char.id ? '#2563eb' : '#e5e7eb',
                  backgroundColor: selectedCharacter?.id === char.id ? '#eff6ff' : '#ffffff',
                }}
              >
                <img src={char.avatar} alt={char.name} style={styles.avatar} />
                <h2>{char.name}</h2>
              </div>
            ))}
          </div>

          <div style={styles.actionButtons}>
            <button
              disabled={!selectedCharacter}
              onClick={startGame}
              style={{
                ...styles.button,
                opacity: selectedCharacter ? 1 : 0.5,
                cursor: selectedCharacter ? 'pointer' : 'not-allowed',
              }}
            >
              ¡Empezar Desafío!
            </button>

            <button onClick={handleDownloadApp} style={styles.downloadButton}>
              📥 Descargar App / Instalar Juego
            </button>
          </div>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div style={styles.gameArea}>
          <div style={styles.hud}>
            <span>Piloto: <strong>{selectedCharacter.name}</strong></span>
            <span>❤️ Vidas: <strong>{lives}</strong></span>
            <span>⏱️ Tiempo: <strong>{timeLeft}s</strong></span>
            <span>⭐ Puntos: <strong>{score}</strong></span>
          </div>

          {message && <div style={styles.alert}>{message}</div>}

          <canvas ref={canvasRef} width={600} height={350} style={styles.canvas} />

          <div style={styles.controlsHelp}>
            <p><strong>Controles:</strong></p>
            <p>🚀 <strong>Espacio / W / ⬆️:</strong> Saltar</p>
            <p>➡️ <strong>Flecha Derecha / D:</strong> Acelerar / Inclinar atrás</p>
            <p>⬅️ <strong>Flecha Izquierda / A:</strong> Frenar / Inclinar adelante</p>
          </div>

          <button onClick={() => setGameState('SELECT')} style={styles.backButton}>
            Cambiar Piloto
          </button>
        </div>
      )}

      {gameState === 'GAMEOVER' && (
        <div style={styles.card}>
          <h1 style={{ color: '#ef4444' }}>¡Te has volcado! 💥</h1>
          <p>Te quedaste sin vidas antes de completar el tiempo.</p>
          <h2>Puntaje final: {score} Puntos</h2>
          <button onClick={startGame} style={styles.button}>
            Intentar de Nuevo
          </button>
        </div>
      )}

      {gameState === 'TIMEUP' && (
        <div style={styles.card}>
          <h1 style={{ color: '#10b981' }}>¡Tiempo Agotado! 🎉</h1>
          <p>¡Has aguantado todo el tiempo sin volcarte!</p>
          <h2>Puntaje total de {selectedCharacter.name}: {score} Puntos</h2>
          <button onClick={startGame} style={styles.button}>
            Jugar otra Ronda
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'sans-serif' },
  card: { backgroundColor: '#fff', padding: '30px', borderRadius: '16px', textAlign: 'center', maxWidth: '450px' },
  title: { color: '#1e293b', marginTop: 0 },
  characterGrid: { display: 'flex', gap: '20px', justifyContent: 'center', margin: '20px 0' },
  characterCard: { border: '3px solid', borderRadius: '12px', padding: '15px', cursor: 'pointer', transition: 'all 0.2s' },
  avatar: { width: '100px', height: '100px', objectFit: 'contain' },
  actionButtons: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' },
  button: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', fontSize: '18px', borderRadius: '8px', cursor: 'pointer' },
  downloadButton: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  gameArea: { textAlign: 'center' },
  hud: { display: 'flex', justifyContent: 'space-between', width: '600px', margin: '0 auto 10px', fontSize: '18px', color: '#fff' },
  canvas: { borderRadius: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' },
  controlsHelp: { color: '#cbd5e1', fontSize: '14px', marginTop: '15px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', display: 'inline-block' },
  alert: { backgroundColor: '#fef08a', color: '#854d0e', padding: '8px', borderRadius: '6px', marginBottom: '10px', fontWeight: 'bold' },
  backButton: { backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginTop: '15px', display: 'block', margin: '15px auto 0' }
};