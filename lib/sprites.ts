// Character sprite configuration for different life stages

export interface SpriteConfig {
  path: string;
  label: string;
  minAge: number;
  maxAge: number;
}

export const SPRITE_STAGES: Record<string, SpriteConfig[]> = {
  male: [
    { path: "/sprites/baby.jpg", label: "Baby", minAge: 0, maxAge: 2 },
    { path: "/sprites/child_male.jpg", label: "Child", minAge: 3, maxAge: 12 },
    { path: "/sprites/teen_male.jpg", label: "Teen", minAge: 13, maxAge: 19 },
    { path: "/sprites/adult_male.jpg", label: "Adult", minAge: 20, maxAge: 64 },
    { path: "/sprites/elder_male.jpg", label: "Elder", minAge: 65, maxAge: 999 },
  ],
  female: [
    { path: "/sprites/baby.jpg", label: "Baby", minAge: 0, maxAge: 2 },
    { path: "/sprites/child_female.jpg", label: "Child", minAge: 3, maxAge: 12 },
    { path: "/sprites/teen_female.jpg", label: "Teen", minAge: 13, maxAge: 19 },
    { path: "/sprites/adult_female.jpg", label: "Adult", minAge: 20, maxAge: 64 },
    { path: "/sprites/elder_female.jpg", label: "Elder", minAge: 65, maxAge: 999 },
  ],
};

export function getSpriteForAge(gender: "male" | "female", age: number): SpriteConfig {
  const stages = SPRITE_STAGES[gender];
  for (const stage of stages) {
    if (age >= stage.minAge && age <= stage.maxAge) {
      return stage;
    }
  }
  // Fallback to adult
  return stages[3];
}

// Relationship character sprites (generic NPCs)
export const NPC_SPRITES = {
  mother: "/sprites/adult_female.jpg",
  father: "/sprites/adult_male.jpg",
  sibling_male: "/sprites/child_male.jpg",
  sibling_female: "/sprites/child_female.jpg",
  friend_male: "/sprites/teen_male.jpg",
  friend_female: "/sprites/teen_female.jpg",
  partner_male: "/sprites/adult_male.jpg",
  partner_female: "/sprites/adult_female.jpg",
  elder_male: "/sprites/elder_male.jpg",
  elder_female: "/sprites/elder_female.jpg",
};

// Get NPC sprite based on relationship type and context
export function getNpcSprite(relation: string, playerAge: number): string {
  const relationLower = relation.toLowerCase();
  
  if (relationLower.includes("mother") || relationLower.includes("mom")) {
    return playerAge > 40 ? NPC_SPRITES.elder_female : NPC_SPRITES.mother;
  }
  if (relationLower.includes("father") || relationLower.includes("dad")) {
    return playerAge > 40 ? NPC_SPRITES.elder_male : NPC_SPRITES.father;
  }
  if (relationLower.includes("wife") || relationLower.includes("girlfriend")) {
    return playerAge > 65 ? NPC_SPRITES.elder_female : NPC_SPRITES.partner_female;
  }
  if (relationLower.includes("husband") || relationLower.includes("boyfriend")) {
    return playerAge > 65 ? NPC_SPRITES.elder_male : NPC_SPRITES.partner_male;
  }
  if (relationLower.includes("child") || relationLower.includes("son") || relationLower.includes("daughter")) {
    return relationLower.includes("son") ? NPC_SPRITES.sibling_male : NPC_SPRITES.sibling_female;
  }
  if (relationLower.includes("friend")) {
    return Math.random() > 0.5 ? NPC_SPRITES.friend_male : NPC_SPRITES.friend_female;
  }
  
  // Default to same-age sprite
  if (playerAge < 13) return NPC_SPRITES.sibling_male;
  if (playerAge < 20) return NPC_SPRITES.friend_male;
  if (playerAge < 65) return NPC_SPRITES.partner_male;
  return NPC_SPRITES.elder_male;
}
