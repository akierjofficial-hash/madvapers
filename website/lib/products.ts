export type ProductTag = "NEW" | "ICE" | "BEST" | "LIMITED";

export type Product = {
  id: number;
  name: string;
  slug: string;
  jpName: string;
  category: "Disposable" | "Pod System" | "Pod Cartridge" | "E-Liquid" | "Accessories";
  flavorCategory: "Fruit" | "Dessert" | "Menthol" | "Tobacco" | "Mix";
  deviceType: "Disposable" | "Pod System" | "Pod Cartridge" | "Salt Nic" | "Freebase" | "Accessory";
  strength: string;
  notes: string;
  tags: ProductTag[];
  priceFrom: number;
  heroTone: "blue" | "yellow" | "ink";
  specs: Array<{ label: string; value: string }>;
  flavorNotes: string[];
  inBox: string[];
  faq: Array<{ question: string; answer: string }>;
};

export const products: Product[] = [
  {
    id: 1,
    name: "Mango Burst",
    slug: "mango-burst",
    jpName: "\u30DE\u30F3\u30B4\u30FC\u30FB\u30D0\u30FC\u30B9\u30C8",
    category: "Disposable",
    flavorCategory: "Fruit",
    deviceType: "Disposable",
    strength: "50mg",
    notes: "Juicy mango profile with crisp finish.",
    tags: ["NEW", "BEST"],
    priceFrom: 550,
    heroTone: "yellow",
    specs: [
      { label: "Puffs", value: "6000" },
      { label: "Battery", value: "Rechargeable 500mAh" },
      { label: "Liquid", value: "12ml" },
      { label: "Nicotine", value: "50mg" },
    ],
    flavorNotes: ["Ripe Mango", "Candy Sweet", "Cool Finish"],
    inBox: ["1 Disposable Device", "USB-C Charging Guide"],
    faq: [
      {
        question: "Is this refillable?",
        answer: "No. This product is a sealed disposable format.",
      },
      {
        question: "Does it include a charger?",
        answer: "Charging cable is not included. USB-C cable is required.",
      },
    ],
  },
  {
    id: 2,
    name: "Berry Storm Ice",
    slug: "berry-storm-ice",
    jpName: "\u30D9\u30EA\u30FC\u30FB\u30B9\u30C8\u30FC\u30E0\u30FB\u30A2\u30A4\u30B9",
    category: "Disposable",
    flavorCategory: "Menthol",
    deviceType: "Disposable",
    strength: "50mg",
    notes: "Dark berry blend with icy lift.",
    tags: ["ICE", "BEST"],
    priceFrom: 500,
    heroTone: "blue",
    specs: [
      { label: "Puffs", value: "5000" },
      { label: "Battery", value: "Rechargeable 450mAh" },
      { label: "Liquid", value: "10ml" },
      { label: "Nicotine", value: "50mg" },
    ],
    flavorNotes: ["Blueberry", "Blackberry", "Menthol"],
    inBox: ["1 Disposable Device"],
    faq: [
      {
        question: "What does ICE mean?",
        answer: "ICE indicates a cooling menthol sensation in the flavor blend.",
      },
    ],
  },
  {
    id: 3,
    name: "Ultra Pod Grape",
    slug: "ultra-pod-grape",
    jpName: "\u30A6\u30EB\u30C8\u30E9\u30FB\u30DD\u30C3\u30C9\u30FB\u30B0\u30EC\u30FC\u30D7",
    category: "Pod Cartridge",
    flavorCategory: "Fruit",
    deviceType: "Pod Cartridge",
    strength: "30mg",
    notes: "Snap-fit pod cartridge for Ultra Pod series.",
    tags: ["NEW"],
    priceFrom: 420,
    heroTone: "blue",
    specs: [
      { label: "Pods per pack", value: "3" },
      { label: "Pod size", value: "2ml" },
      { label: "Nicotine", value: "30mg" },
      { label: "Compatibility", value: "Ultra Pod Device" },
    ],
    flavorNotes: ["Concord Grape", "Soft Candy"],
    inBox: ["3 Pods", "Quick Start Card"],
    faq: [
      {
        question: "Will this fit other devices?",
        answer: "No. It is designed only for Ultra Pod hardware.",
      },
    ],
  },
  {
    id: 4,
    name: "Aero Device Black V2",
    slug: "aero-device-black-v2",
    jpName: "\u30A8\u30A2\u30ED\u30FB\u30C7\u30D0\u30A4\u30B9\u30FB\u30D6\u30E9\u30C3\u30AFV2",
    category: "Pod System",
    flavorCategory: "Mix",
    deviceType: "Pod System",
    strength: "0mg",
    notes: "Reusable pod system with quick charge and draw activation.",
    tags: ["LIMITED"],
    priceFrom: 750,
    heroTone: "ink",
    specs: [
      { label: "Battery", value: "1000mAh" },
      { label: "Charging", value: "USB-C Fast Charge" },
      { label: "Output", value: "Adjustable" },
      { label: "Material", value: "Aluminum Alloy" },
    ],
    flavorNotes: ["Depends on installed pod"],
    inBox: ["Aero Device", "1 Empty Pod", "USB-C Cable", "User Guide"],
    faq: [
      {
        question: "Is liquid included?",
        answer: "No, pods and liquids are sold separately.",
      },
    ],
  },
  {
    id: 5,
    name: "Tobacco Reserve Salt",
    slug: "tobacco-reserve-salt",
    jpName: "\u30BF\u30D0\u30B3\u30FB\u30EA\u30B6\u30FC\u30D6\u30FB\u30BD\u30EB\u30C8",
    category: "E-Liquid",
    flavorCategory: "Tobacco",
    deviceType: "Salt Nic",
    strength: "20mg",
    notes: "Smooth tobacco-forward salt e-liquid.",
    tags: ["BEST"],
    priceFrom: 390,
    heroTone: "yellow",
    specs: [
      { label: "Bottle", value: "30ml" },
      { label: "Type", value: "Salt Nic" },
      { label: "Nicotine", value: "20mg" },
      { label: "VG/PG", value: "50/50" },
    ],
    flavorNotes: ["Classic Tobacco", "Dry Finish"],
    inBox: ["1 x 30ml Bottle"],
    faq: [
      {
        question: "Can this be used in sub-ohm tanks?",
        answer: "Salt e-liquid is usually intended for low-wattage pod systems.",
      },
    ],
  },
  {
    id: 6,
    name: "Vanilla Donut Freebase",
    slug: "vanilla-donut-freebase",
    jpName: "\u30D0\u30CB\u30E9\u30FB\u30C9\u30FC\u30CA\u30C4",
    category: "E-Liquid",
    flavorCategory: "Dessert",
    deviceType: "Freebase",
    strength: "3mg",
    notes: "Dessert blend with creamy vanilla glaze profile.",
    tags: ["NEW"],
    priceFrom: 450,
    heroTone: "yellow",
    specs: [
      { label: "Bottle", value: "60ml" },
      { label: "Type", value: "Freebase" },
      { label: "Nicotine", value: "3mg" },
      { label: "VG/PG", value: "70/30" },
    ],
    flavorNotes: ["Vanilla", "Bakery", "Cream"],
    inBox: ["1 x 60ml Bottle"],
    faq: [
      {
        question: "Is this sweet?",
        answer: "Yes, this is a dessert-style profile with creamy notes.",
      },
    ],
  },
  {
    id: 7,
    name: "Mint Orbit Pod",
    slug: "mint-orbit-pod",
    jpName: "\u30DF\u30F3\u30C8\u30FB\u30AA\u30FC\u30D3\u30C3\u30C8",
    category: "Pod Cartridge",
    flavorCategory: "Menthol",
    deviceType: "Pod Cartridge",
    strength: "20mg",
    notes: "Cooling mint replacement pod pack.",
    tags: ["ICE"],
    priceFrom: 400,
    heroTone: "blue",
    specs: [
      { label: "Pods per pack", value: "2" },
      { label: "Pod size", value: "2ml" },
      { label: "Nicotine", value: "20mg" },
      { label: "Compatibility", value: "Orbit Pod Device" },
    ],
    flavorNotes: ["Peppermint", "Cool Breeze"],
    inBox: ["2 Pods"],
    faq: [
      {
        question: "How many pods in one pack?",
        answer: "Two prefilled pods per package.",
      },
    ],
  },
  {
    id: 8,
    name: "Lychee Pop",
    slug: "lychee-pop",
    jpName: "\u30E9\u30A4\u30C1\u30FB\u30DD\u30C3\u30D7",
    category: "Disposable",
    flavorCategory: "Fruit",
    deviceType: "Disposable",
    strength: "50mg",
    notes: "Bright lychee profile with candy sweetness.",
    tags: ["NEW"],
    priceFrom: 550,
    heroTone: "yellow",
    specs: [
      { label: "Puffs", value: "5500" },
      { label: "Battery", value: "Rechargeable 500mAh" },
      { label: "Liquid", value: "11ml" },
      { label: "Nicotine", value: "50mg" },
    ],
    flavorNotes: ["Lychee", "Candy"],
    inBox: ["1 Disposable Device"],
    faq: [
      {
        question: "Is this sweet or cool?",
        answer: "Primarily sweet fruit with mild cooling.",
      },
    ],
  },
  {
    id: 9,
    name: "Coil Kit 0.8 Ohm",
    slug: "coil-kit-08",
    jpName: "\u30B3\u30A4\u30EB\u30FB\u30AD\u30C3\u30C8 0.8",
    category: "Accessories",
    flavorCategory: "Mix",
    deviceType: "Accessory",
    strength: "0mg",
    notes: "Replacement coil accessory kit for pod systems.",
    tags: ["BEST"],
    priceFrom: 280,
    heroTone: "ink",
    specs: [
      { label: "Resistance", value: "0.8 ohm" },
      { label: "Pieces", value: "5" },
      { label: "Recommended Use", value: "Pod Device" },
      { label: "Material", value: "Mesh" },
    ],
    flavorNotes: ["N/A"],
    inBox: ["5 x Replacement Coils"],
    faq: [
      {
        question: "Does this include a pod?",
        answer: "No, this kit includes coils only.",
      },
    ],
  },
  {
    id: 10,
    name: "Cola Splash",
    slug: "cola-splash",
    jpName: "\u30B3\u30FC\u30E9\u30FB\u30B9\u30D7\u30E9\u30C3\u30B7\u30E5",
    category: "Disposable",
    flavorCategory: "Mix",
    deviceType: "Disposable",
    strength: "50mg",
    notes: "Fizz-inspired cola profile with smooth finish.",
    tags: ["LIMITED", "BEST"],
    priceFrom: 560,
    heroTone: "ink",
    specs: [
      { label: "Puffs", value: "6000" },
      { label: "Battery", value: "Rechargeable 500mAh" },
      { label: "Liquid", value: "12ml" },
      { label: "Nicotine", value: "50mg" },
    ],
    flavorNotes: ["Cola", "Brown Sugar", "Soft Chill"],
    inBox: ["1 Disposable Device"],
    faq: [
      {
        question: "Is this a mint flavor?",
        answer: "No. It has a soda profile with mild cooling.",
      },
    ],
  },
];

export const featuredProducts = products.filter((product) =>
  product.tags.some((tag) => tag === "NEW" || tag === "BEST"),
);

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
