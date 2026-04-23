// Shared helpers + small components

function formatINR(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

const SECTOR_COLORS = ['#2E2D7A','#4B48C2','#8684D4','#B8B6E4','#D5CEBF','#E7E1D6'];

function Delta({ v, suffix = '%', digits = 2 }) {
  const pos = v >= 0;
  return (
    <span className="mono tnum" style={{ color: pos ? 'var(--pos)' : 'var(--neg)', fontWeight: 500 }}>
      {pos ? '+' : '−'}{Math.abs(v).toFixed(digits)}{suffix}
    </span>
  );
}

Object.assign(window, { formatINR, SECTOR_COLORS, Delta });
