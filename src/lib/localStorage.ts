/** an alias for the localstorage object */
export const storage = {
  set: (key: string, value: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  },
  get: (key: string) => {
    if (typeof window !== "undefined") {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : item;
    }
  },
  remove: (key: string) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
  },
} satisfies {
  /** sets the item */
  set: (key: string, value: string) => void;
  /** returns the item */
  get: (key: string) => string | null | undefined;
  /** removes the item */
  remove: (key: string) => void;
};
