import type { Brand, Mood, Product, MoodId, Category } from '../types';

export const MOODS: Mood[] = [
  { id: 'jazz-club', title: '1990s Jazz-Club Elegance', blurb: 'Velvet, satin, low light.' },
  { id: 'corporate-chic', title: 'Corporate Chic', blurb: 'Sharp tailoring, quiet power.' },
  { id: 'dark-academia', title: 'Dark Academia', blurb: 'Tweed, libraries, candlelight.' },
  { id: 'minimalist', title: 'Minimalist Everyday', blurb: 'Clean lines, neutral tones.' },
  { id: 'vintage-parisian', title: 'Vintage Parisian', blurb: 'Stripes, trench coats, cafes.' },
];

export const FLOORS: { floor: number; label: string; category: Category }[] = [
  { floor: 1, label: 'Apparel & Fashion', category: 'apparel' },
  { floor: 2, label: 'Tech & Audio', category: 'tech' },
  { floor: 3, label: 'Living & Furniture', category: 'living' },
  { floor: 4, label: 'Editorial Mood Archives', category: 'editorial' },
];

// Demo data: delivery coverage is invented to exercise the pincode engine.
export const BRANDS: Brand[] = [
  { id: 'zara', name: 'Zara', domain: 'zara.com', url: 'https://www.zara.com/in/', floor: 1, supportedPincodes: ['*'] },
  { id: 'mango', name: 'Mango', domain: 'mango.com', url: 'https://shop.mango.com/in', floor: 1, supportedPincodes: ['400*', '110*', '560*'] },
  { id: 'nike', name: 'Nike', domain: 'nike.com', url: 'https://www.nike.com/in/', floor: 1, supportedPincodes: ['*'] },
  { id: 'lifestyle', name: 'Lifestyle', domain: 'lifestylestores.com', url: 'https://www.lifestylestores.com/in/en', floor: 1, supportedPincodes: ['4*', '5*'] },
  { id: 'ulta', name: 'Ulta Beauty', domain: 'ulta.com', url: 'https://www.ulta.com/', floor: 1, supportedPincodes: [] },
  { id: 'marshalls', name: 'Marshalls', domain: 'marshalls.com', url: 'https://www.marshalls.com/', floor: 1, supportedPincodes: [] },
  { id: 'sony', name: 'Sony', domain: 'sony.co.in', url: 'https://www.sony.co.in/', floor: 2, supportedPincodes: ['*'] },
  { id: 'boat', name: 'boAt', domain: 'boat-lifestyle.com', url: 'https://www.boat-lifestyle.com/', floor: 2, supportedPincodes: ['*'] },
  { id: 'ikea', name: 'IKEA', domain: 'ikea.com', url: 'https://www.ikea.com/in/en/', floor: 3, supportedPincodes: ['400*', '110*', '560*', '500*'] },
  { id: 'pepperfry', name: 'Pepperfry', domain: 'pepperfry.com', url: 'https://www.pepperfry.com/', floor: 3, supportedPincodes: ['*'] },
  { id: 'vogue', name: 'Vogue India', domain: 'vogue.in', url: 'https://www.vogue.in/', floor: 4, supportedPincodes: ['*'] },
];

const brandUrl = (id: string): string => BRANDS.find((b) => b.id === id)?.url ?? '';
const p = (id: string, name: string, brandId: string, category: Category, price: number, colors: string[],
  moods: MoodId[], silhouette: string, styleTags: string[] = []): Product => ({
  id, name, brandId, category, price, currency: 'INR', colors, styleTags, moodAssociations: moods,
  silhouette, imagePath: '/images/placeholder.svg', externalUrl: brandUrl(brandId),
});

// Sample items only: brand pages are the real destinations, products are illustrative.
export const PRODUCTS: Product[] = [
  p('z1', 'Satin slip dress', 'zara', 'apparel', 4990, ['espresso', 'burgundy'], ['jazz-club'], 'bias-cut', ['evening']),
  p('z2', 'Structured wool blazer', 'zara', 'apparel', 7990, ['black', 'ivory'], ['corporate-chic', 'dark-academia'], 'tailored'),
  p('z3', 'Pleated midi skirt', 'zara', 'apparel', 3290, ['olive', 'espresso'], ['dark-academia', 'vintage-parisian'], 'a-line'),
  p('m1', 'Velvet wrap top', 'mango', 'apparel', 3590, ['burgundy'], ['jazz-club'], 'wrap', ['evening']),
  p('m2', 'Breton stripe knit', 'mango', 'apparel', 2790, ['ivory', 'black'], ['vintage-parisian', 'minimalist'], 'relaxed'),
  p('m3', 'Belted trench coat', 'mango', 'apparel', 8990, ['beige', 'espresso'], ['vintage-parisian', 'corporate-chic'], 'long'),
  p('n1', 'Clean court sneakers', 'nike', 'apparel', 7495, ['ivory', 'black'], ['minimalist'], 'low-profile'),
  p('l1', 'Linen straight trousers', 'lifestyle', 'apparel', 1999, ['ivory', 'beige'], ['minimalist', 'corporate-chic'], 'straight'),
  p('s1', 'Over-ear noise-cancelling headphones', 'sony', 'tech', 24990, ['black'], ['minimalist', 'corporate-chic'], 'over-ear'),
  p('b1', 'Wireless earbuds', 'boat', 'tech', 1799, ['black', 'rose'], ['minimalist'], 'in-ear'),
  p('i1', 'Brass reading lamp', 'ikea', 'living', 2999, ['gold', 'espresso'], ['dark-academia', 'jazz-club'], 'task-light'),
  p('pf1', 'Walnut bookshelf', 'pepperfry', 'living', 18999, ['espresso'], ['dark-academia', 'vintage-parisian'], 'tall'),
];
