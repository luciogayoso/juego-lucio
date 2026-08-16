import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

const CHARACTERS = [
  { id: 'hijo1', name: 'Lucio', avatar: '/hijo1.png' },
  { id: 'hijo2', name: 'Santino', avatar: '/hijo2.png' },
];

const GAME_DURATION = 60; // Tiempo en segundos

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

  // Guardar qué botones táctiles o teclas están presionadas
  const inputsRef = useRef({
    left: false,
    right: false,
    jump: false,
  });

  // Capturar evento para descargar la App
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
      alert('Para instalar la App:\n• En Chrome o Android: Toca los 3 puntos arriba a la derecha y elige "Agregar a la pantalla principal".\n• En Safari (iPhone): Toca "Compartir" y luego "Agregar a inicio".');
    }
  };

  // Temporizador de 60 segundos
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

  // Bucle de Física y Renderizado
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

    let coins = [];

    // Controles por teclado PC
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') inputsRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') inputsRef.current.right = true;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') inputsRef.current.jump = true;
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') inputsRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') inputsRef.current.right = false;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') inputsRef.current.jump = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const getTerrainHeight = (posX) => {
      return (
        canvas.height -
        100 +
        Math.sin(posX * 0.008) * 40 +
        Math.sin(posX * 0.02) * 20
      );
    };

    const getTerrainAngle = (posX) => {
      const delta = 5;
      const y1 = getTerrainHeight(posX - delta);
      const y2 = getTerrainHeight(posX + delta);
      return Math.atan2(y2 - y1, delta * 2);
    };

    // Crear monedas en el camino
    const spawnCoinInterval = setInterval(() => {
      const coinX = x + 300 + Math.random() * 200;
      const coinY = getTerrainHeight(coinX) - 30 - Math.random() * 30;
      coins.push({ x: coinX, y: coinY, radius: 10, collected: false });
    }, 1500);

    const loop = () => {
      const terrainY = getTerrainHeight(x);
      const targetAngle = getTerrainAngle(x);

      // --- MOVIMIENTO (TECLADO O BOTONES TÁCTILES) ---
      if (inputsRef.current.right) {
        if (isGrounded) vx += 0.15;
        angularVelocity += 0.005;
      } else if (inputsRef.current.left) {
        if (isGrounded) vx -= 0.1;
        angularVelocity -= 0.005;
      } else if (isGrounded) {
        vx *= 0.98;
      }

      // --- SALTO ---
      if (inputsRef.current.jump && isGrounded) {
        vy = -8.5;
        isGrounded = false;
        inputsRef.current.jump = false; // Requiere presionar de nuevo
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

      // Recolectar puntos/monedas
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

      // Detectar caídas/vuelcos
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

      // DIBUJAR PANTALLA
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

      // Dibujar monedas
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

      // Dibujar Bici y Personaje
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

      // Cabeza
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

  // Manejadores para eventos táctiles (celular)
  const setInput = (key, value) => {
    inputsRef.current[key] = value;
  };

  return (
    <div style={styles.container}>
      {gameState === 'SELECT' && (
        <div style={styles.card}>
          <h1 style={styles.title}>🚴 Carrera en Celular 📱</h1>
          <p>Selecciona qué hermano va a jugar:</p>
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
              ¡Empezar a Jugar!
            </button>

            <button onClick={handleDownloadApp} style={styles.downloadButton}>
              📥 Descargar App en el Celular
            </button>
          </div>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div style={styles.gameArea}>
          <div style={styles.hud}>
            <span>👤 <strong>{selectedCharacter.name}</strong></span>
            <span>❤️ <strong>{lives}</strong></span>
            <span>⏱️ <strong>{timeLeft}s</strong></span>
            <span>⭐ <strong>{score}</strong></span>
          </div>

          {message && <div style={styles.alert}>{message}</div>}

          <canvas ref={canvasRef} width={600} height={320} style={styles.canvas} />

          {/* CONTROLES TÁCTILES PARA CELULAR */}
          <div style={styles.touchControls}>
            <div style={styles.leftButtons}>
              <button
                onTouchStart={() => setInput('left', true)}
                onTouchEnd={() => setInput('left', false)}
                onMouseDown={() => setInput('left', true)}
                onMouseUp={() => setInput('left', false)}
                style={styles.touchButton}
              >
                🛑 Freno
              </button>
              <button
                onTouchStart={() => setInput('right', true)}
                onTouchEnd={() => setInput('right', false)}
                onMouseDown={() => setInput('right', true)}
                onMouseUp={() => setInput('right', false)}
                style={{ ...styles.touchButton, backgroundColor: '#10b981' }}
              >
                ⚡ Acelerar
              </button>
            </div>

            <button
              onTouchStart={() => setInput('jump', true)}
              onTouchEnd={() => setInput('jump', false)}
              onMouseDown={() => setInput('jump', true)}
              onMouseUp={() => setInput('jump', false)}
              style={styles.jumpButton}
            >
              🚀 SALTAR
            </button>
          </div>

          <button onClick={() => setGameState('SELECT')} style={styles.backButton}>
            Cambiar Piloto
          </button>
        </div>
      )}

      {gameState === 'GAMEOVER' && (
        <div style={styles.card}>
          <h1 style={{ color: '#ef4444' }}>¡Te has volcado! 💥</h1>
          <p>Te quedaste sin vidas antes de tiempo.</p>
          <h2>Puntaje: {score} Puntos</h2>
          <button onClick={startGame} style={styles.button}>
            Intentar de Nuevo
          </button>
        </div>
      )}

      {gameState === 'TIMEUP' && (
        <div style={styles.card}>
          <h1 style={{ color: '#10b981' }}>¡Tiempo Agotado! 🎉</h1>
          <p>¡Aguantaste todo el tiempo!</p>
          <h2>Puntaje final de {selectedCharacter.name}: {score} Puntos</h2>
          <button onClick={startGame} style={styles.button}>
            Jugar otra Vez
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'sans-serif', userSelect: 'none' },
  card: { backgroundColor: '#fff', padding: '25px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px', width: '90%' },
  title: { color: '#1e293b', marginTop: 0 },
  characterGrid: { display: 'flex', gap: '15px', justifyContent: 'center', margin: '15px 0' },
  characterCard: { border: '3px solid', borderRadius: '12px', padding: '10px', cursor: 'pointer', flex: 1 },
  avatar: { width: '80px', height: '80px', objectFit: 'contain' },
  actionButtons: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' },
  button: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px', fontSize: '18px', borderRadius: '8px', cursor: 'pointer' },
  downloadButton: { backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px', fontSize: '14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  gameArea: { textAlign: 'center', maxWidth: '600px', width: '100%' },
  hud: { display: 'flex', justifyContent: 'space-around', margin: '0 auto 8px', fontSize: '16px', color: '#fff' },
  canvas: { borderRadius: '12px', width: '100%', height: 'auto', backgroundColor: '#87CEEB', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' },
  touchControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', gap: '10px' },
  leftButtons: { display: 'flex', gap: '10px' },
  touchButton: { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '15px 20px', fontSize: '16px', fontWeight: 'bold', borderRadius: '10px', cursor: 'pointer', touchAction: 'manipulation' },
  jumpButton: { backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '15px 25px', fontSize: '16px', fontWeight: 'bold', borderRadius: '10px', cursor: 'pointer', touchAction: 'manipulation' },
  alert: { backgroundColor: '#fef08a', color: '#854d0e', padding: '6px', borderRadius: '6px', marginBottom: '8px', fontWeight: 'bold' },
  backButton: { backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginTop: '15px' }
};