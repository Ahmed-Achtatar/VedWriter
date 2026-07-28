import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Eraser, Undo2, Redo2, Trash2, Layers, Image as ImageIcon } from 'lucide-react';

const COLORS = [
  { name: 'Charcoal', value: '#1a1a1a' },
  { name: 'Graphite', value: '#4b5563' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Red', value: '#b91c1c' },
  { name: 'Gold Highlight', value: 'rgba(217, 119, 6, 0.35)' },
  { name: 'Green', value: '#15803d' }
];

const SIZES = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 5 },
  { label: 'Marker', value: 12 },
  { label: 'Highlighter', value: 24 }
];

export default function DraftSheetCanvas({
  isOpen,
  onClose,
  initialDataUrl,
  initialTitle,
  onSaveDraft,
  onDeleteDraft,
  onInsertToEditor,
  sheetIndex = 0
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#1a1a1a');
  const [strokeSize, setStrokeSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [title, setTitle] = useState(initialTitle || `Draft #${sheetIndex + 1}`);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle || `Draft #${sheetIndex + 1}`);
    }
  }, [isOpen, initialTitle, sheetIndex]);

  const drawPaperBackground = (ctx, w, h) => {
    ctx.fillStyle = '#FAF7EE';
    ctx.fillRect(0, 0, w, h);

    // Faint grid dots
    ctx.fillStyle = 'rgba(180, 170, 150, 0.25)';
    for (let x = 20; x < w; x += 24) {
      for (let y = 20; y < h; y += 24) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
  };

  // Setup canvas and load initial image
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Resize canvas for sharp display
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Draw background paper tone & grid
    drawPaperBackground(ctx, rect.width, rect.height);

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        saveState();
      };
      img.src = initialDataUrl;
    } else {
      saveState();
    }
  }, [isOpen, initialDataUrl]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(dataUrl);
      return next;
    });
    setHistoryIndex((prev) => prev + 1);
  };

  const autoSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveDraft(sheetIndex, { title: title || `Draft #${sheetIndex + 1}`, dataUrl });
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isEraser ? '#FAF7EE' : color;
    ctx.lineWidth = isEraser ? strokeSize * 4 : strokeSize;
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
      autoSave();
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIdx = historyIndex - 1;
      restoreState(history[targetIdx]);
      setHistoryIndex(targetIdx);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIdx = historyIndex + 1;
      restoreState(history[targetIdx]);
      setHistoryIndex(targetIdx);
    }
  };

  const restoreState = (dataUrl) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawPaperBackground(ctx, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      autoSave();
    };
    img.src = dataUrl;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawPaperBackground(ctx, rect.width, rect.height);
    saveState();
    autoSave();
  };

  const handleInsertIntoNote = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onInsertToEditor(dataUrl, `${(title || 'Draft').replace(/\s+/g, '_')}.png`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={() => { autoSave(); onClose(); }}
      style={{ zIndex: 1100, backdropFilter: 'blur(3px)', background: 'rgba(0,0,0,0.35)' }}
    >
      <div
        className="draft-canvas-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92%',
          maxWidth: '780px',
          height: '520px',
          background: '#FAF7EE',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-strong)',
          overflow: 'hidden'
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border)',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--accent)' }} />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this draft..."
              title="Click to rename this draft sheet"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px dashed var(--border)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                width: '150px'
              }}
            />
          </div>

          {/* Toolbar controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Pen / Eraser toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <button
                className={`toolbar-btn ${!isEraser ? 'active' : ''}`}
                onClick={() => setIsEraser(false)}
                title="Pen"
                style={{ padding: '4px 8px' }}
              >
                <Pencil size={14} />
              </button>
              <button
                className={`toolbar-btn ${isEraser ? 'active' : ''}`}
                onClick={() => setIsEraser(true)}
                title="Eraser"
                style={{ padding: '4px 8px' }}
              >
                <Eraser size={14} />
              </button>
            </div>

            {/* Colors */}
            {!isEraser && (
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: c.value,
                      border: color === c.value ? '2px solid var(--accent)' : '1px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      transform: color === c.value ? 'scale(1.2)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
              </div>
            )}

            {/* Stroke size */}
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              {SIZES.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setStrokeSize(s.value)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: strokeSize === s.value ? 'var(--accent-soft)' : 'transparent',
                    color: strokeSize === s.value ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: strokeSize === s.value ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="toolbar-divider" />

            {/* Actions */}
            <button className="toolbar-btn" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo">
              <Undo2 size={14} />
            </button>
            <button className="toolbar-btn" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo">
              <Redo2 size={14} />
            </button>
            <button className="toolbar-btn" onClick={handleClear} title="Clear canvas">
              <Trash2 size={14} />
            </button>

            <div className="toolbar-divider" />

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleInsertIntoNote}
              title="Embed drawing into page text"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '12px' }}
            >
              <ImageIcon size={13} />
              Insert
            </button>

            {onDeleteDraft && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: '#ef4444', padding: '4px 8px', fontSize: '12px' }}
                onClick={() => { onDeleteDraft(sheetIndex); onClose(); }}
                title="Delete draft sheet"
              >
                Delete
              </button>
            )}

            <button
              className="btn btn-primary btn-sm"
              onClick={() => { autoSave(); onClose(); }}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              Stow Sheet
            </button>
          </div>
        </div>

        {/* Canvas Drawing Area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isEraser ? 'crosshair' : 'crosshair' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              width: '100%',
              height: '100%',
              touchAction: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
}
