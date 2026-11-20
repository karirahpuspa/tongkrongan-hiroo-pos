import React from 'react';
import { MenuItem } from '../types/pos';

interface MenuArtworkProps {
  menu: Pick<MenuItem, 'name' | 'category' | 'illustration_key' | 'image_url'>;
  className?: string;
}

const PALETTES: Record<string, { bg: string; accent: string }> = {
  kopi_susu: { bg: '#EFE3CE', accent: '#6B3E26' },
  americano: { bg: '#E7E1D8', accent: '#2E1F18' },
  cafe_latte: { bg: '#F4E8D6', accent: '#9A5B32' },
  kopi_tubruk: { bg: '#E8DAC8', accent: '#4A2C1D' },
  matcha: { bg: '#E3ECD7', accent: '#5A8B27' },
  lemon_tea: { bg: '#F8F0C9', accent: '#C68B19' },
  teh_manis: { bg: '#F3E1C8', accent: '#A8581E' },
  air_mineral: { bg: '#DFECEE', accent: '#2C6B7C' },
  pisang_goreng: { bg: '#F7E7C4', accent: '#B86614' },
  kentang_goreng: { bg: '#F8E6BF', accent: '#C97B18' },
  roti_bakar: { bg: '#F1DFC8', accent: '#7B3F1D' },
  mie_goreng: { bg: '#F5DFCA', accent: '#B9431C' },
  chicken_katsu: { bg: '#F3DFC6', accent: '#9B481B' },
};

export const MenuArtwork: React.FC<MenuArtworkProps> = ({ menu, className = '' }) => {
  if (menu.image_url) {
    return (
      <div className={`relative overflow-hidden bg-[#EFECE6] ${className}`}>
        <img
          src={menu.image_url}
          alt={menu.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const palette = PALETTES[menu.illustration_key] ?? {
    bg: '#EFE7DA',
    accent: '#8D3B19',
  };

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ backgroundColor: palette.bg }}
      aria-label={menu.name}
    >
      <svg
        viewBox="0 0 160 110"
        className="h-full w-full p-2"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="80" cy="55" r="42" fill="#FAF8F4" stroke="#141414" strokeWidth="1.5" />
        {renderMotif(menu.illustration_key, menu.category, palette.accent)}
      </svg>
    </div>
  );
};

function renderMotif(key: string, category: string, accent: string) {
  if (key === 'kopi_susu' || key === 'americano' || key === 'teh_manis' || key === 'lemon_tea') {
    return (
      <g>
        {/* Iced cup */}
        <path
          d="M58 34H102L96 86H64L58 34Z"
          fill="#FFFFFF"
          stroke="#141414"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M61 52H99L96 86H64L61 52Z"
          fill={accent}
          opacity="0.88"
        />
        <path
          d="M55 34H105"
          stroke="#141414"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M84 18L78 48"
          stroke="#141414"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect x="67" y="42" width="10" height="10" rx="2" fill="#FAF8F4" stroke="#141414" strokeWidth="1.5" />
        <rect x="81" y="44" width="9" height="9" rx="2" fill="#FAF8F4" stroke="#141414" strokeWidth="1.5" />
      </g>
    );
  }

  if (key === 'matcha') {
    return (
      <g>
        <path
          d="M58 36H102L96 86H64L58 36Z"
          fill="#FFFFFF"
          stroke="#141414"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M60 48H100L98 63H62L60 48Z" fill="#659826" />
        <path d="M62 63H98L96 86H64L62 63Z" fill="#EFE7D6" />
        <path d="M88 18L80 46" stroke="#141414" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }

  if (key === 'cafe_latte' || key === 'kopi_tubruk' || category === 'Kopi') {
    return (
      <g>
        <path
          d="M54 44H98V66C98 77 89 84 76 84C63 84 54 77 54 66V44Z"
          fill="#FFFFFF"
          stroke="#141414"
          strokeWidth="2"
        />
        <path
          d="M98 49H105C109 49 112 52 112 57C112 62 109 65 105 65H98"
          stroke="#141414"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse cx="76" cy="44" rx="22" ry="6" fill={accent} stroke="#141414" strokeWidth="2" />
        <path d="M68 44C72 41 80 41 84 44" stroke="#FAF8F4" strokeWidth="2" strokeLinecap="round" />
        <path d="M46 86H106" stroke="#141414" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }

  if (key === 'air_mineral') {
    return (
      <g>
        <rect x="68" y="26" width="24" height="58" rx="6" fill="#FFFFFF" stroke="#141414" strokeWidth="2" />
        <rect x="74" y="19" width="12" height="7" rx="2" fill={accent} stroke="#141414" strokeWidth="2" />
        <rect x="68" y="45" width="24" height="16" fill={accent} opacity="0.85" />
      </g>
    );
  }

  if (key === 'kentang_goreng') {
    return (
      <g>
        <path d="M63 30L67 54M72 26L74 54M81 25L81 54M90 27L88 54M97 32L93 54" stroke="#EAB308" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M58 50H102L95 84H65L58 50Z" fill="#C93B2B" stroke="#141414" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="80" cy="67" r="6" fill="#F5E74B" stroke="#141414" strokeWidth="1.5" />
      </g>
    );
  }

  if (key === 'pisang_goreng' || key === 'roti_bakar' || category === 'Cemilan') {
    return (
      <g>
        <ellipse cx="80" cy="74" rx="34" ry="10" fill="#FFFFFF" stroke="#141414" strokeWidth="2" />
        <rect x="56" y="44" width="22" height="22" rx="4" fill="#F4C77B" stroke="#141414" strokeWidth="2" />
        <rect x="76" y="38" width="24" height="24" rx="4" fill="#E39D46" stroke="#141414" strokeWidth="2" />
        <path d="M62 50H72M82 46H94" stroke="#4A2C1D" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }

  // Makanan (Mie Goreng / Chicken Katsu)
  return (
    <g>
      <path
        d="M48 56H112C110 74 96 84 80 84C64 84 50 74 48 56Z"
        fill="#FFFFFF"
        stroke="#141414"
        strokeWidth="2"
      />
      <path d="M54 56C60 44 100 44 106 56" fill={accent} stroke="#141414" strokeWidth="2" />
      <circle cx="80" cy="46" r="8" fill="#FFFDF5" stroke="#141414" strokeWidth="1.5" />
      <circle cx="80" cy="46" r="4" fill="#F59E0B" />
    </g>
  );
}
