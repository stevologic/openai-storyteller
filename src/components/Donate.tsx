import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import qrcode from 'qrcode-generator';
import './donate.css';

interface Wallet {
  name: string;
  symbol: string;
  glyph: string;
  color: string;
  address: string;
  uri: string;
}

const WALLETS: Wallet[] = [
  {
    name: 'Bitcoin',
    symbol: 'BTC',
    glyph: '₿',
    color: '#f7931a',
    address: '3M9PTxL15b6c8REcHMZCVPbfMomXNZ5AGR',
    uri: 'bitcoin:3M9PTxL15b6c8REcHMZCVPbfMomXNZ5AGR',
  },
  {
    name: 'Dogecoin',
    symbol: 'DOGE',
    glyph: 'Ð',
    color: '#c2a633',
    address: 'DTW2M5oEW97WbmYJRM71qD7uE6xfJs1MUK',
    uri: 'dogecoin:DTW2M5oEW97WbmYJRM71qD7uE6xfJs1MUK',
  },
];

function qrDataUrl(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(5, 2);
}

export function DonateButton({ label = 'Tip the maker', className = '' }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`donate-trigger ${className}`} onClick={() => setOpen(true)}>
        <span aria-hidden>♥</span> {label}
      </button>
      <AnimatePresence>{open && <DonateModal key="donate" onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function DonateModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const qrs = useMemo(() => Object.fromEntries(WALLETS.map((w) => [w.symbol, qrDataUrl(w.uri)])), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async (w: Wallet) => {
    try {
      await navigator.clipboard.writeText(w.address);
      setCopied(w.symbol);
      setTimeout(() => setCopied((c) => (c === w.symbol ? null : c)), 1600);
    } catch {
      /* clipboard blocked — the address is still selectable */
    }
  };

  return (
    <motion.div
      className="donate-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="donate-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="donate-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>Enjoying Tiny Book Buddies AI?</h3>
        <p className="donate-sub">
          It’s a free, open project. If it brought a little joy, a tiny tip helps keep it growing. 💜
        </p>
        <div className="donate-wallets">
          {WALLETS.map((w) => (
            <div className="donate-wallet" key={w.symbol}>
              <div className="donate-qr">
                <img src={qrs[w.symbol]} alt={`${w.name} donation address QR code`} />
              </div>
              <div className="donate-coin" style={{ color: w.color }}>
                <span className="donate-glyph">{w.glyph}</span> {w.name}
              </div>
              <button type="button" className="donate-addr" onClick={() => copy(w)} title="Copy address">
                <span className="donate-addr-text">{w.address}</span>
                <span className="donate-copy">{copied === w.symbol ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          ))}
        </div>
        <p className="donate-note">No account, no pressure — thank you for being here.</p>
      </motion.div>
    </motion.div>
  );
}
