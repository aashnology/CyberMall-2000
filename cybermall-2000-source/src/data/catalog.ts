import type { Brand, Mood, Product, MoodId, Category } from '../types';

export const MOODS: Mood[] = [
  { id: 'jazz-club', title: '1990s Jazz-Club Elegance', blurb: 'Velvet, satin, low light.' },
  { id: 'corporate-chic', title: 'Corporate Chic', blurb: 'Sharp tailoring, quiet power.' },
  { id: 'dark-academia', title: 'Dark Academia', blurb: 'Tweed, libraries, candlelight.' },
  { id: 'minimalist', title: 'Minimalist Everyday', blurb: 'Clean lines, neutral tones.' },
  { id: 'vintage-parisian', title: 'Vintage Parisian', blurb: 'Stripes, trench coats, cafes.' },
];

export const FLOORS: { floor: number; label: string; wings: string }[] = [
  { floor: 1, label: 'Ground Promenade', wings: 'Apparel · Books · Accessories · Food · Wellness' },
  { floor: 2, label: 'Upper Mezzanine', wings: 'Tech · Living · Luxury · Cinema · Collectibles' },
];

const ALL = ['*'];
const b = (id: string, name: string, domain: string, url: string, floor: number, category: Category,
  moods: MoodId[], supportedPincodes: string[] = ALL): Brand =>
  ({ id, name, domain, url, floor, category, moods, supportedPincodes });

// Demo data: delivery coverage is invented to exercise the pincode engine. Verify URLs before publishing.
export const BRANDS: Brand[] = [
  b('zara', 'Zara', 'zara.com', 'https://www.zara.com/in/', 1, 'apparel', ['corporate-chic', 'minimalist']),
  b('mango', 'Mango', 'mango.com', 'https://shop.mango.com/in', 1, 'apparel', ['vintage-parisian', 'jazz-club'], ['400*', '110*', '560*']),
  b('nike', 'Nike', 'nike.com', 'https://www.nike.com/in/', 1, 'apparel', ['minimalist']),
  b('lifestyle', 'Lifestyle', 'lifestylestores.com', 'https://www.lifestylestores.com/in/en', 1, 'apparel', ['minimalist', 'corporate-chic'], ['4*', '5*']),
  b('marshalls', 'Marshalls', 'marshalls.com', 'https://www.marshalls.com/', 1, 'apparel', ['minimalist'], []),
  b('crossword', 'Crossword', 'crossword.in', 'https://www.crossword.in/', 1, 'books', ['dark-academia']),
  b('archies', 'Archies', 'archiesonline.com', 'https://www.archiesonline.com/', 1, 'books', ['vintage-parisian']),
  b('titan', 'Titan', 'titan.co.in', 'https://www.titan.co.in/', 1, 'accessories', ['corporate-chic', 'vintage-parisian']),
  b('rayban', 'Ray-Ban', 'ray-ban.com', 'https://www.ray-ban.com/india', 1, 'accessories', ['jazz-club']),
  b('fossil', 'Fossil', 'fossil.com', 'https://www.fossil.com/en-in/', 1, 'accessories', ['minimalist'], ['4*', '5*', '1*']),
  b('starbucks', 'Starbucks', 'starbucks.in', 'https://www.starbucks.in/', 1, 'food', ['dark-academia']),
  b('theobroma', 'Theobroma', 'theobroma.in', 'https://theobroma.in/', 1, 'food', ['vintage-parisian']),
  b('chaayos', 'Chaayos', 'chaayos.com', 'https://chaayos.com/', 1, 'food', ['minimalist']),
  b('ulta', 'Ulta Beauty', 'ulta.com', 'https://www.ulta.com/', 1, 'wellness', ['minimalist'], []),
  b('nykaa', 'Nykaa', 'nykaa.com', 'https://www.nykaa.com/', 1, 'wellness', ['minimalist']),
  b('forest', 'Forest Essentials', 'forestessentials.com', 'https://www.forestessentials.com/', 1, 'wellness', ['vintage-parisian', 'dark-academia']),
  b('sony', 'Sony', 'sony.co.in', 'https://www.sony.co.in/', 2, 'tech', ['minimalist', 'corporate-chic']),
  b('boat', 'boAt', 'boat-lifestyle.com', 'https://www.boat-lifestyle.com/', 2, 'tech', ['minimalist']),
  b('ikea', 'IKEA', 'ikea.com', 'https://www.ikea.com/in/en/', 2, 'living', ['dark-academia', 'jazz-club'], ['400*', '110*', '560*', '500*']),
  b('pepperfry', 'Pepperfry', 'pepperfry.com', 'https://www.pepperfry.com/', 2, 'living', ['dark-academia', 'vintage-parisian']),
  b('vogue', 'Vogue India', 'vogue.in', 'https://www.vogue.in/', 2, 'editorial', ['jazz-club', 'vintage-parisian']),
  b('sabyasachi', 'Sabyasachi', 'sabyasachi.com', 'https://www.sabyasachi.com/', 2, 'editorial', ['jazz-club'], ['400*', '110*']),
  b('pvr', 'PVR INOX', 'pvrcinemas.com', 'https://www.pvrcinemas.com/', 2, 'cinema', ['jazz-club']),
  b('bms', 'BookMyShow', 'bookmyshow.com', 'https://in.bookmyshow.com/', 2, 'cinema', ['jazz-club', 'vintage-parisian']),
  b('hamleys', 'Hamleys', 'hamleys.in', 'https://www.hamleys.in/', 2, 'hobby', ['minimalist']),
  b('lego', 'LEGO', 'lego.com', 'https://www.lego.com/en-in', 2, 'hobby', ['minimalist']),
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
