export type MoodId = 'jazz-club' | 'corporate-chic' | 'dark-academia' | 'minimalist' | 'vintage-parisian';
export type Category = 'apparel' | 'tech' | 'living' | 'editorial';

export interface Mood { id: MoodId; title: string; blurb: string }

export interface Brand {
  id: string; name: string;
  domain: string;               // used to fetch the real logo at runtime
  url: string;                  // verified outbound destination
  floor: number;
  /** exact "400001", prefix "400*", or "*" for everywhere */
  supportedPincodes: string[];
}

export interface Product {
  id: string; name: string; brandId: string; category: Category;
  price: number; currency: 'INR';
  colors: string[]; styleTags: string[]; moodAssociations: MoodId[];
  silhouette: string; imagePath: string; externalUrl: string;
}

export interface Budget { min: number; max: number }
export interface UserProfile {
  pincode: string | null; moods: MoodId[]; colors: string[];
  category: Category | null; budget: Budget | null;
}

export interface ScoreComponents { mood: number; color: number; category: number; budget: number; delivery: number }
export type Weights = ScoreComponents;

export interface Recommendation {
  product: Product; score: number; components: ScoreComponents; reasons: string[];
}
